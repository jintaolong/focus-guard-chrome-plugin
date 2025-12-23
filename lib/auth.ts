// Authentication service for CommentVerdict API integration
import { ConfigService } from "./config"
import type {
  Token,
  TokenRefresh,
  UserCreate,
  UserResponse,
  UserUpdate,
  VerifyEmailResponse,
  ResendVerificationResponse
} from "~types/backend"

let API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "https://test.commentverdict.com/api/v1"

// Load config on module initialization
ConfigService.getConfig().then(config => {
  API_BASE_URL = config.api_url
  console.log("AuthService: Config loaded, API_BASE_URL =", API_BASE_URL)
}).catch(err => {
  console.warn("AuthService: Failed to load config, using environment variable", err)
})

export class AuthService {
  private static TOKEN_KEY = "focus_guard_access_token"
  private static REFRESH_TOKEN_KEY = "focus_guard_refresh_token"
  private static USER_KEY = "focus_guard_user"
  private static lastTokenValidation: number = 0
  private static TOKEN_VALIDATION_CACHE_MS = 30000 // Cache token validation for 30 seconds

  // Test function to verify storage is working
  static async testStorage(): Promise<void> {
    console.log("=== STORAGE TEST START ===")
    try {
      // Test write
      console.log("Testing write...")
      await this.storageSet({ test_key: "test_value_" + Date.now() })
      console.log("Write successful")
      
      // Test read
      console.log("Testing read...")
      const result = await this.storageGet(["test_key"])
      console.log("Read successful:", result)
      
      // Test delete
      console.log("Testing delete...")
      await this.storageRemove(["test_key"])
      console.log("Delete successful")
      
      // Verify all storage
      console.log("Fetching all storage items...")
      const all = await this.storageGet(null as any)
      console.log("All storage items:", Object.keys(all))
      
      console.log("=== STORAGE TEST PASSED ===")
    } catch (error) {
      console.error("=== STORAGE TEST FAILED ===", error)
      throw error
    }
  }

  // Small storage helpers to support both callback and promise-based chrome API
  // Use sync storage as primary - it persists across browser sessions
  private static storageGet(keys: string[] | string | null) {
    return new Promise<Record<string, any>>((resolve, reject) => {
      try {
        if (!chrome?.storage?.sync) {
          console.error("chrome.storage.sync not available!")
          return reject(new Error("chrome.storage.sync not available"))
        }
        
        const keysToGet = keys === null ? null : (keys as any)
        chrome.storage.sync.get(keysToGet, (items) => {
          const err = chrome.runtime?.lastError
          if (err) {
            // Check if it's an extension context invalidation error
            const errorMsg = err.message || String(err)
            if (errorMsg.includes("Extension context invalidated")) {
              // Silent fail - extension was reloaded, return empty
              return resolve({})
            }
            console.error("Storage get error:", err)
            return reject(err)
          }
          resolve(items || {})
        })
      } catch (e) {
        // Check if it's an extension context invalidation error
        const errorMsg = e instanceof Error ? e.message : String(e)
        if (errorMsg.includes("Extension context invalidated")) {
          // Silent fail - extension was reloaded, return empty
          return resolve({})
        }
        console.error("Storage get exception:", e)
        reject(e)
      }
    })
  }

  private static storageSet(items: Record<string, any>) {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!chrome?.storage?.sync) {
          console.error("chrome.storage.sync not available!")
          return reject(new Error("chrome.storage.sync not available"))
        }
        
        console.log("Storage set called for keys:", Object.keys(items))
        chrome.storage.sync.set(items, () => {
          const err = chrome.runtime?.lastError
          if (err) {
            console.error("Storage set error:", err)
            return reject(err)
          }
          console.log("Storage set success for keys:", Object.keys(items))
          resolve()
        })
      } catch (e) {
        console.error("Storage set exception:", e)
        reject(e)
      }
    })
  }

  private static storageRemove(keys: string[] | string) {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!chrome?.storage?.sync) {
          console.error("chrome.storage.sync not available!")
          return reject(new Error("chrome.storage.sync not available"))
        }
        
        console.log("Storage remove called for keys:", keys)
        chrome.storage.sync.remove(keys as any, () => {
          const err = chrome.runtime?.lastError
          if (err) {
            console.error("Storage remove error:", err)
            return reject(err)
          }
          console.log("Storage remove success for keys:", keys)
          resolve()
        })
      } catch (e) {
        console.error("Storage remove exception:", e)
        reject(e)
      }
    })
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  static async getAccessToken(): Promise<string | null> {
    try {
      const result = await this.storageGet([this.TOKEN_KEY])
      const token = result[this.TOKEN_KEY] || null
      if (!token) {
        console.log("AuthService: No access token in storage")
      }
      return token
    } catch (error) {
      console.error("Failed to get access token:", error)
      return null
    }
  }

  static async getRefreshToken(): Promise<string | null> {
    try {
      const result = await this.storageGet([this.REFRESH_TOKEN_KEY])
      const token = result[this.REFRESH_TOKEN_KEY] || null
      if (token) {
        console.log("AuthService: Found refresh token in storage")
      } else {
        console.log("AuthService: No refresh token in storage")
      }
      return token
    } catch (error) {
      console.error("Failed to get refresh token:", error)
      return null
    }
  }

  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      console.log("AuthService: Setting tokens in storage")
      await this.storageSet({
        [this.TOKEN_KEY]: accessToken,
        [this.REFRESH_TOKEN_KEY]: refreshToken
      })
      console.log("AuthService: Tokens saved successfully")
    } catch (error) {
      console.error("Failed to set tokens:", error)
      throw error
    }
  }

  static async clearTokens(): Promise<void> {
    try {
      console.log("AuthService: Clearing tokens from storage")
      await this.storageRemove([this.TOKEN_KEY, this.REFRESH_TOKEN_KEY, this.USER_KEY, "account"])
      console.log("AuthService: Tokens cleared successfully")
    } catch (error) {
      console.error("Failed to clear tokens:", error)
    }
  }

  static async getCurrentUser(): Promise<UserResponse | null> {
    try {
      const result = await this.storageGet([this.USER_KEY])
      return result[this.USER_KEY] || null
    } catch (error) {
      console.error("Failed to get current user:", error)
      return null
    }
  }

  static async setCurrentUser(user: UserResponse): Promise<void> {
    try {
      console.log("AuthService: Setting current user in storage")
      await this.storageSet({ [this.USER_KEY]: user })
      // Also write a lightweight `account` object for compatibility
      const account = {
        isLoggedIn: true,
        email: user.email,
        tier: "starter",
        searchesUsedToday: 0,
        searchesRemaining: -1,
        resetTime: new Date().toISOString()
      }
      await this.storageSet({ account })
      console.log("AuthService: User saved successfully")
    } catch (error) {
      console.error("Failed to set current user:", error)
      throw error
    }
  }

  // ============================================================================
  // API Methods
  // ============================================================================

  private static async fetchAPI<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    // Use background worker to make the request (bypasses CORS for content scripts)
    console.log("AuthService: Sending API request via background worker:", endpoint)
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        endpoint,
        options: {
          method: options?.method || 'GET',
          headers: options?.headers || {},
          body: options?.body
        }
      })

      console.log("AuthService: Background response:", response?.success ? 'success' : 'failed')

      if (!response?.success) {
        throw new Error(response?.error || 'API request failed')
      }

      return response.data as T
    } catch (error) {
      console.error("AuthService: API request error:", error)
      throw error
    }
  }

  private static async fetchWithAuth<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const accessToken = await this.getAccessToken()
    if (!accessToken) {
      throw new Error("No access token available")
    }

    const headers = {
      ...options?.headers,
      Authorization: `Bearer ${accessToken}`
    }

    return this.fetchAPI<T>(endpoint, {
      ...options,
      headers
    })
  }

  /**
   * Register a new user
   */
  static async register(data: UserCreate): Promise<UserResponse> {
    const user = await this.fetchAPI<UserResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data)
    })
    return user
  }

  /**
   * Login with email and password (OAuth2 Password Flow)
   */
  static async login(email: string, password: string): Promise<Token> {
    console.log("AuthService: login() called for email:", email)
    console.log("AuthService: API_BASE_URL:", API_BASE_URL)
    
    const formData = new URLSearchParams()
    formData.append("username", email)
    formData.append("password", password)

    const token = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    }).then(async (response) => {
      console.log("AuthService: login response status:", response.status)
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }))
        console.error("AuthService: login failed:", error)
        throw new Error(error.detail || `Login failed: ${response.statusText}`)
      }
      const data = await response.json()
      console.log("AuthService: login successful, got token")
      return data
    })

    // Store tokens
    console.log("AuthService: Storing tokens...")
    await this.setTokens(token.access_token, token.refresh_token)
    console.log("AuthService: Tokens stored successfully")

    // Fetch and store user info (best-effort)
    try {
      console.log("AuthService: Fetching user info...")
      const user = await this.getMe()
      if (user) {
        console.log("AuthService: Got user info:", user.email)
        await this.setCurrentUser(user)
      }
    } catch (e) {
      console.warn("AuthService: Failed to fetch user info:", e)
      // ignore; user will be fetched lazily later
    }
    
    // Notify background to start token refresh mechanism
    try {
      chrome.runtime.sendMessage({ type: 'START_TOKEN_REFRESH' }).catch(() => {
        // Ignore if background isn't ready
      })
    } catch (e) {
      // Ignore messaging errors
    }

    console.log("AuthService: login() completed successfully")
    return token
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(): Promise<Token> {
    const refreshToken = await this.getRefreshToken()
    if (!refreshToken) {
      throw new Error("No refresh token available")
    }

    const data: TokenRefresh = { refresh_token: refreshToken }
    const token = await this.fetchAPI<Token>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(data)
    })

    // Store new tokens
    await this.setTokens(token.access_token, token.refresh_token)

    return token
  }

  /**
   * Logout (client-side token removal)
   */
  static async logout(): Promise<void> {
    // Clear local tokens first
    await this.clearTokens()
    
    // Try to call the backend logout endpoint (best effort, ignore errors)
    try {
      await this.fetchWithAuth("/auth/logout", { method: "POST" })
    } catch (error) {
      // Ignore backend logout errors - tokens already cleared
      console.log("Backend logout skipped or failed (tokens already cleared):", error)
    }
    
    // Notify web portal to clear its tokens too
    try {
      await this.notifyWebPortalLogout()
    } catch (error) {
      console.warn("Failed to notify web portal of logout:", error)
    }
  }

  // ============================================================================
  // Google OAuth Methods
  // ============================================================================

  /**
   * Initiate Google OAuth login flow
   * Opens the Google OAuth URL in a new tab and returns the tab ID for monitoring
   */
  static async initiateGoogleLogin(): Promise<{ tabId: number; state: string }> {
    console.log("AuthService: Initiating Google OAuth login")
    
    try {
      // Step 1: Get the Google OAuth URL from backend
      const response = await this.fetchAPI<{ auth_url: string; state: string }>(
        "/auth/google/login",
        { method: "GET" }
      )

      console.log("AuthService: Got OAuth URL from backend")

      // Step 2: Open the auth URL in a new tab
      const tab = await chrome.tabs.create({ url: response.auth_url })
      
      if (!tab.id) {
        throw new Error("Failed to create tab for OAuth")
      }

      console.log("AuthService: Opened OAuth tab:", tab.id)

      return {
        tabId: tab.id,
        state: response.state
      }
    } catch (error) {
      console.error("AuthService: Failed to initiate Google login:", error)
      throw error
    }
  }

  /**
   * Extract tokens from OAuth callback URL
   */
  static extractTokensFromUrl(url: string): { accessToken: string; refreshToken: string } | null {
    try {
      const urlObj = new URL(url)
      const accessToken = urlObj.searchParams.get("access_token")
      const refreshToken = urlObj.searchParams.get("refresh_token")

      if (accessToken && refreshToken) {
        return { accessToken, refreshToken }
      }
      
      return null
    } catch (error) {
      console.error("AuthService: Failed to parse callback URL:", error)
      return null
    }
  }

  /**
   * Handle OAuth callback - store tokens and fetch user info
   */
  static async handleOAuthCallback(accessToken: string, refreshToken: string): Promise<void> {
    console.log("AuthService: Handling OAuth callback")

    // Store tokens
    await this.setTokens(accessToken, refreshToken)
    console.log("AuthService: OAuth tokens stored")

    // Fetch and store user info
    try {
      const user = await this.getMe()
      await this.setCurrentUser(user)
      console.log("AuthService: User info stored:", user.email)
    } catch (error) {
      console.warn("AuthService: Failed to fetch user info after OAuth:", error)
    }
  }

  /**
   * Sync tokens from web portal to extension
   * Called when extension detects user is logged in on web portal
   */
  static async syncTokensFromWebPortal(accessToken: string, refreshToken: string): Promise<void> {
    console.log("AuthService: Syncing tokens from web portal")
    await this.handleOAuthCallback(accessToken, refreshToken)
  }

  /**
   * Notify web portal of logout (via content script message)
   */
  private static async notifyWebPortalLogout(): Promise<void> {
    const portalUrl = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"
    
    // Query for tabs matching the portal URL
    const tabs = await chrome.tabs.query({ url: `${portalUrl}/*` })
    
    if (tabs.length > 0) {
      // Send logout message to all portal tabs
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "FG_EXTENSION_LOGOUT"
            })
            console.log("AuthService: Notified portal tab of logout:", tab.id)
          } catch (error) {
            console.warn("AuthService: Failed to notify portal tab:", tab.id, error)
          }
        }
      }
    } else {
      console.log("AuthService: No portal tabs open to notify")
    }
  }

  /**
   * Get current user info
   */
  static async getMe(): Promise<UserResponse> {
    return this.fetchWithAuth<UserResponse>("/auth/me")
  }

  /**
   * Update current user
   */
  static async updateMe(data: UserUpdate): Promise<UserResponse> {
    const user = await this.fetchWithAuth<UserResponse>("/users/me", {
      method: "PUT",
      body: JSON.stringify(data)
    })
    await this.setCurrentUser(user)
    return user
  }

  /**
   * Delete current user account
   */
  static async deleteMe(): Promise<void> {
    await this.fetchWithAuth("/users/me", { method: "DELETE" })
    await this.clearTokens()
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    return this.fetchAPI<VerifyEmailResponse>(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "POST"
    })
  }

  /**
   * Resend verification email
   */
  static async resendVerification(): Promise<ResendVerificationResponse> {
    return this.fetchWithAuth<ResendVerificationResponse>("/auth/resend-verification", {
      method: "POST"
    })
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    console.log("AuthService: isAuthenticated() called")
    const token = await this.getAccessToken()
    if (!token) {
      console.log("AuthService: No access token found - NOT authenticated")
      return false
    }

    console.log("AuthService: Found access token:", token.substring(0, 20) + "...")

    // First try to use the token without hitting the network
    // Just check if we have both tokens
    const refreshToken = await this.getRefreshToken()
    if (!refreshToken) {
      console.log("AuthService: No refresh token found, clearing tokens")
      await this.clearTokens()
      return false
    }

    console.log("AuthService: Found refresh token - IS authenticated")
    // Return true optimistically - let ensureValidToken handle verification when needed
    return true
  }
  /**
   * Ensure valid access token, refreshing if needed
   */
  static async ensureValidToken(): Promise<string> {
    let accessToken = await this.getAccessToken()
    
    if (!accessToken) {
      console.log("AuthService: ensureValidToken - no token")
      throw new Error("Not authenticated")
    }

    // Use cached validation if recent (within 30 seconds)
    const now = Date.now()
    const timeSinceLastValidation = now - this.lastTokenValidation
    if (timeSinceLastValidation < this.TOKEN_VALIDATION_CACHE_MS) {
      const remainingCacheTime = ((this.TOKEN_VALIDATION_CACHE_MS - timeSinceLastValidation) / 1000).toFixed(1)
      console.log(`AuthService: ✅ Using cached token validation (${remainingCacheTime}s remaining)`)
      return accessToken
    }

    console.log("AuthService: ⏳ Token validation cache expired, verifying token...")

    // Try to use the token
    try {
      await this.getMe()
      console.log("AuthService: Token valid")
      this.lastTokenValidation = now // Cache successful validation
      return accessToken
    } catch (error) {
      console.log("AuthService: Token invalid/expired, attempting refresh...")
      // Token might be expired, try to refresh
      try {
        const token = await this.refreshAccessToken()
        console.log("AuthService: Token refreshed successfully")
        this.lastTokenValidation = Date.now() // Cache successful refresh
        return token.access_token
      } catch (refreshError) {
        console.error("AuthService: Refresh failed, clearing tokens:", refreshError)
        await this.clearTokens()
        throw new Error("Session expired, please login again")
      }
    }
  }
}
