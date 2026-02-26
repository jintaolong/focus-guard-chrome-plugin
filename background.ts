// Background service worker for MV3 - API Proxy + OAuth Handler
// Content scripts cannot make cross-origin requests due to CORS.
// All API calls must go through the background worker.

import { initConsole } from "~lib/console-manager"
import { ConfigService } from "~lib/config"

initConsole()

export {}

// Configuration loaded from remote or environment variables
let API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "https://test.commentverdict.com/api/v1"
let WEB_PORTAL_URL = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"

// Track OAuth flow
let oauthTabId: number | null = null
let oauthState: string | null = null

// Proactive token refresh - refresh token every 8 minutes to prevent expiration
// const TOKEN_REFRESH_INTERVAL_MS = 8 * 60 * 1000 // 8 minutes
const TOKEN_REFRESH_INTERVAL_MS = 1 * 60 * 1000 // 1 minute for testing
const MIN_TIME_BETWEEN_REFRESHES_MS = 60 * 1000 // Don't refresh more than once per minute
let tokenRefreshAlarm: NodeJS.Timeout | null = null
let lastTokenRefreshTime = 0
let isRefreshing = false

// Initialize configuration on startup
ConfigService.getConfig().then(config => {
  API_BASE_URL = config.api_url
  WEB_PORTAL_URL = config.portal_url
  console.log("Background: Config loaded", { API_BASE_URL, WEB_PORTAL_URL })
}).catch(err => {
  console.warn("Background: Failed to load remote config, using environment variables", err)
})

chrome.runtime.onInstalled.addListener(() => {
  console.log("Comment Verdict extension installed!")
  // Refresh config on install/update
  ConfigService.refreshConfig().catch(err => console.warn("Failed to refresh config on install", err))
  // Start token refresh mechanism
  startTokenRefreshMechanism()
})

// Start on extension load/reload
chrome.runtime.onStartup.addListener(() => {
  console.log("Comment Verdict extension started!")
  startTokenRefreshMechanism()
})

// Watch storage changes and push tokens to portal when updated
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return
  if (changes.focus_guard_access_token || changes.focus_guard_refresh_token) {
    const accessToken = changes.focus_guard_access_token ? changes.focus_guard_access_token.newValue : null
    const refreshToken = changes.focus_guard_refresh_token ? changes.focus_guard_refresh_token.newValue : null
    console.log('Background: Detected token change in storage, syncing to portal')
    syncTokensToPortal(accessToken, refreshToken).catch(err => console.warn('Background: syncTokensToPortal failed', err))
  }
})

// Helper to make API requests from background (bypasses CORS)
async function makeAPIRequest(endpoint: string, options: any = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  console.log("Background: Making API request to", url)
  
  // Hard timeout: if the server does not respond within 30 s we abort the
  // fetch and return a synthetic failure so chrome.runtime.sendMessage never
  // hangs indefinitely and blocks the content-script Promise chain.
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), 30000)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: timeoutController.signal
    })
    clearTimeout(timeoutId)

    console.log("Background: Response status", response.status)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      
      // Check for tier restriction error (403 with TIER_RESTRICTION code)
      if (response.status === 403) {
        const detail = error.detail || error
        if (typeof detail === 'object' && detail.code === 'TIER_RESTRICTION') {
          console.log("Background: Tier restriction detected:", detail)
          return { 
            success: false, 
            isTierRestriction: true,
            tierRestriction: detail,
            error: detail.message || 'Tier restriction',
            status: response.status 
          }
        }
      }
      
      // Special cases: Some endpoints return 400 for "no data" scenarios (treat as success)
      
      // Topic gap analysis returns 400 when no gaps found
      // Check both error.detail string and nested error structure
      const errorDetail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail || error)
      const urlPath = typeof endpoint === 'string' ? endpoint : url
      
      if ((urlPath.includes('/topic-gap') || urlPath.includes('topic-gap')) && response.status === 400 && 
          errorDetail.includes('Minimal Topic Gaps')) {
        console.log("Background: Topic gap - no gaps found (success)")
        return { 
          success: true, 
          data: { 
            topic_gaps: [],
            message: errorDetail 
          } 
        }
      }
      
      // Topic clustering returns 400 when parsing fails (treat as empty clusters)
      if ((urlPath.includes('/topic-clustering') || urlPath.includes('topic-clustering')) && response.status === 400 && 
          errorDetail.includes('Failed to parse LLM')) {
        console.log("Background: Topic clustering - parse failed, returning empty clusters")
        return { 
          success: true, 
          data: { 
            topic_clusters: [],
            message: errorDetail 
          } 
        }
      }
      
      return { success: false, error: errorDetail || response.statusText, status: response.status }
    }

    // Check content type to handle different response formats
    const contentType = response.headers.get('content-type')
    
    // Check if response is a blob (for report downloads)
    // Include text/plain for TXT reports
    if (contentType && (
        contentType.includes('application/pdf') || 
        contentType.includes('application/octet-stream') ||
        (contentType.includes('text/plain') && endpoint.includes('generate-report'))
      )) {
      const blob = await response.blob()
      // Convert blob to base64 for message passing
      const base64 = await blobToBase64(blob)
      return { success: true, data: base64, contentType, isBlob: true }
    }

    // Handle empty response bodies (e.g., 204 No Content, logout endpoints)
    if (response.status === 204 || !contentType || contentType.includes('text/plain')) {
      // Try to get text, fallback to null
      const text = await response.text().catch(() => null)
      return { success: true, data: text || null }
    }
    
    // Default: parse as JSON
    const data = await response.json().catch(() => null)
    return { success: true, data }
  } catch (error) {
    clearTimeout(timeoutId)
    console.error("Background: Fetch error", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn("Background: Request timed out (30 s):", url)
      return { success: false, error: 'Request timed out after 30 seconds', status: 408 }
    }
    return { success: false, error: errorMessage }
  }
}

// Helper to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Sync tokens from extension to any open portal tabs
async function syncTokensToPortal(accessToken: string | null, refreshToken: string | null) {
  try {
    console.log('Background: syncing tokens to portal tabs')
    
    // Query all tabs and filter by portal URL
    const tabs = await chrome.tabs.query({})
    const portalTabs = tabs.filter(t => {
      if (!t.url) return false
      return t.url.startsWith(WEB_PORTAL_URL) || t.url.startsWith('http://localhost:3000')
    })

    portalTabs.forEach(tab => {
      if (!tab.id) return
      chrome.tabs.sendMessage(tab.id, {
        type: 'SYNC_TO_PORTAL',
        accessToken,
        refreshToken
      }, (resp) => {
        if (chrome.runtime.lastError) {
          // Ignore tabs without content script
        } else {
          console.log('Background: Sent tokens to portal tab', tab.id, resp)
        }
      })
    })
  } catch (err) {
    console.error('Background: syncTokensToPortal error', err)
    throw err
  }
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background: Message received", request.type)
  
  // Handle API proxy requests
  if (request.type === 'API_REQUEST') {
    makeAPIRequest(request.endpoint, request.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true // Keep channel open for async response
  }
  
  // Handle opening new tab (for upgrade links)
  if (request.type === 'OPEN_TAB') {
    console.log("Background: Opening tab:", request.url)
    chrome.tabs.create({ url: request.url }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error("Background: Failed to create tab:", chrome.runtime.lastError)
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
      } else {
        console.log("Background: Tab created successfully:", tab.id)
        sendResponse({ success: true, tabId: tab.id })
      }
    })
    return true
  }
  
  // Handle token refresh trigger (from login or other events)
  if (request.type === 'START_TOKEN_REFRESH') {
    console.log("Background: Received START_TOKEN_REFRESH request")
    startTokenRefreshMechanism()
    sendResponse({ success: true })
    return true
  }
  
  // Handle OAuth initiation
  if (request.type === 'OAUTH_START') {
    oauthTabId = request.tabId
    oauthState = request.state
    console.log("Background: OAuth flow started, monitoring tab", oauthTabId)
    sendResponse({ success: true })
    return true
  }
  
  // Handle token sync from web portal
  if (request.type === 'SYNC_TOKENS_FROM_PORTAL') {
    const { accessToken, refreshToken } = request
    console.log("Background: Syncing tokens from web portal")
    
    // Store in chrome.storage.sync
    chrome.storage.sync.set({
      focus_guard_access_token: accessToken,
      focus_guard_refresh_token: refreshToken
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Background: Failed to store tokens:", chrome.runtime.lastError)
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
      } else {
        console.log("Background: Tokens synced successfully")
        sendResponse({ success: true })
      }
    })
    return true
  }
  
  // Handle token clear from web portal logout
  if (request.type === 'CLEAR_EXTENSION_TOKENS') {
    console.log("Background: Clearing extension tokens (logout from portal)")
    
    chrome.storage.sync.remove([
      'focus_guard_access_token',
      'focus_guard_refresh_token',
      'focus_guard_user',
      'account'
    ], () => {
      if (chrome.runtime.lastError) {
        console.error("Background: Failed to clear tokens:", chrome.runtime.lastError)
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
      } else {
        console.log("Background: Extension tokens cleared")
        sendResponse({ success: true })
      }
    })
    return true
  }
  
  // Handle auth state changes from content script (portal sync)
  if (request.type === 'AUTH_STATE_CHANGED') {
    console.log('[Background] Auth state changed:', request.isAuthenticated)
    
    if (request.isAuthenticated) {
      // User logged in - update UI
      chrome.action.setBadgeText({ text: '✓' })
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
      
      // Update extension state
      chrome.storage.sync.set({ isAuthenticated: true })
      
      // Optional: Show notification
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Focus Guard',
          message: 'Successfully logged in!'
        })
      } catch (err) {
        console.log('[Background] Notification failed:', err)
      }
      
    } else {
      // User logged out - update UI
      chrome.action.setBadgeText({ text: '' })
      chrome.storage.sync.set({ isAuthenticated: false })
    }
    
    sendResponse({ success: true })
    return true
  }
  
  // Legacy getData support
  if (request.action === "getData") {
    chrome.storage.sync.get(["data"], (result) => {
      sendResponse({ data: result.data })
    })
    return true
  }
  
  return false
})

// Monitor tab URL changes for OAuth callback
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only monitor the OAuth tab
  if (tabId !== oauthTabId) {
    return
  }

  // Check if URL changed and contains the callback
  if (changeInfo.url && changeInfo.url.includes(`${WEB_PORTAL_URL}/auth/callback`)) {
    console.log("Background: OAuth callback detected:", changeInfo.url)
    
    try {
      // Extract tokens from URL
      const url = new URL(changeInfo.url)
      const accessToken = url.searchParams.get("access_token")
      const refreshToken = url.searchParams.get("refresh_token")
      const tokenType = url.searchParams.get("token_type")

      if (accessToken && refreshToken) {
        console.log("Background: Tokens extracted from callback URL")
        
        // Store tokens in chrome.storage.sync
        chrome.storage.sync.set({
          focus_guard_access_token: accessToken,
          focus_guard_refresh_token: refreshToken
        }, async () => {
          if (chrome.runtime.lastError) {
            console.error("Background: Failed to store OAuth tokens:", chrome.runtime.lastError)
          } else {
            console.log("Background: OAuth tokens stored successfully")
            
            // Fetch user info and store it
            try {
              console.log("Background: Fetching user info after OAuth...")
              const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              })
              
              if (response.ok) {
                const user = await response.json()
                console.log("Background: Got user info:", user.email)
                // After storing tokens, sync to any open web portal tabs
                try {
                  await syncTokensToPortal(accessToken, refreshToken)
                } catch (e) {
                  console.warn('Background: syncTokensToPortal failed', e)
                }
                
                // Store user info
                await chrome.storage.sync.set({ focus_guard_user: user })
                
                // Create account object for compatibility
                const account = {
                  isLoggedIn: true,
                  email: user.email,
                  tier: "starter",
                  searchesUsedToday: 0,
                  searchesRemaining: -1,
                  resetTime: new Date().toISOString()
                }
                await chrome.storage.sync.set({ account })
                console.log("Background: User info stored")
              } else {
                console.error("Background: Failed to fetch user info:", response.status)
              }
            } catch (error) {
              console.error("Background: Error fetching user info:", error)
            }
            
            // Close the OAuth tab
            chrome.tabs.remove(tabId, () => {
              console.log("Background: OAuth tab closed")
            })
            
            // Notify popup/UI that login is complete
            chrome.runtime.sendMessage({
              type: 'OAUTH_COMPLETE',
              success: true
            }).catch(err => {
              console.log("Background: No receivers for OAUTH_COMPLETE (popup may be closed)")
            })
            
            // Start token refresh mechanism after successful OAuth login
            startTokenRefreshMechanism()
          }
        })
        
        // Reset OAuth tracking
        oauthTabId = null
        oauthState = null
      } else {
        console.error("Background: Missing tokens in callback URL")
      }
    } catch (error) {
      console.error("Background: Failed to parse OAuth callback URL:", error)
    }
  }
})

// ============================================================================
// Proactive Token Refresh Mechanism
// ============================================================================

/**
 * Start periodic token refresh to prevent token expiration
 * Tokens typically expire after 15-30 minutes, so we refresh every 8 minutes
 */
function startTokenRefreshMechanism() {
  console.log("Background: startTokenRefreshMechanism called")
  
  // If already running, don't start another one
  if (tokenRefreshAlarm) {
    console.log("Background: Token refresh mechanism already running, skipping")
    return
  }
  
  console.log("Background: Starting token refresh mechanism")
  
  // Check immediately on start (but respect minimum time between refreshes)
  const timeSinceLastRefresh = Date.now() - lastTokenRefreshTime
  if (timeSinceLastRefresh >= MIN_TIME_BETWEEN_REFRESHES_MS) {
    refreshTokenIfNeeded()
  } else {
    console.log(`Background: Skipping immediate refresh, last refresh was ${Math.round(timeSinceLastRefresh / 1000)}s ago`)
  }
  
  // Then check periodically
  tokenRefreshAlarm = setInterval(() => {
    refreshTokenIfNeeded()
  }, TOKEN_REFRESH_INTERVAL_MS)
}

/**
 * Check if user is logged in and refresh token if needed
 */
async function refreshTokenIfNeeded() {
  // Prevent concurrent refreshes
  if (isRefreshing) {
    console.log("Background: Token refresh already in progress, skipping")
    return
  }
  
  try {
    isRefreshing = true
    
    // Check if we have tokens
    const result = await chrome.storage.sync.get(['focus_guard_access_token', 'focus_guard_refresh_token'])
    const hasAccessToken = !!result.focus_guard_access_token
    const hasRefreshToken = !!result.focus_guard_refresh_token
    
    if (!hasAccessToken || !hasRefreshToken) {
      console.log("Background: No tokens found, skipping refresh")
      return
    }
    
    console.log("Background: Proactively refreshing access token...")
    
    // Call the refresh endpoint (15 s timeout: a hung refresh must not block
    // the isRefreshing flag and cause all subsequent refreshes to be skipped).
    const refreshToken = result.focus_guard_refresh_token
    const refreshController = new AbortController()
    const refreshTimeoutId = setTimeout(() => refreshController.abort(), 15000)
    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: refreshController.signal
      })
    } catch (fetchErr) {
      clearTimeout(refreshTimeoutId)
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        console.warn("Background: Token refresh timed out (15 s)")
      } else {
        console.error("Background: Token refresh fetch error:", msg)
      }
      return
    }
    clearTimeout(refreshTimeoutId)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      console.error("Background: Token refresh failed:", error)
      
      // If refresh token is invalid, clear tokens and log out
      if (response.status === 401 || response.status === 403) {
        console.log("Background: Refresh token invalid, clearing tokens")
        await chrome.storage.sync.remove(['focus_guard_access_token', 'focus_guard_refresh_token', 'focus_guard_user', 'account'])
        
        // Stop the refresh mechanism
        if (tokenRefreshAlarm) {
          clearInterval(tokenRefreshAlarm)
          tokenRefreshAlarm = null
        }
        
        // Notify UI that session expired
        chrome.runtime.sendMessage({
          type: 'SESSION_EXPIRED'
        }).catch(() => {
          // Ignore if no receivers
        })
      }
      return
    }
    
    const token = await response.json()
    console.log("Background: Token refreshed successfully")
    
    // Update last refresh time
    lastTokenRefreshTime = Date.now()
    
    // Store new tokens
    await chrome.storage.sync.set({
      focus_guard_access_token: token.access_token,
      focus_guard_refresh_token: token.refresh_token
    })
    
    // Sync to portal tabs
    await syncTokensToPortal(token.access_token, token.refresh_token)
    
  } catch (error) {
    console.error("Background: Error in token refresh:", error)
  } finally {
    isRefreshing = false
  }
}

// Start token refresh on initial load (for extension reload)
startTokenRefreshMechanism()
