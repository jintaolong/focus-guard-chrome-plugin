// Background service worker for MV3 - API Proxy + OAuth Handler
// Content scripts cannot make cross-origin requests due to CORS.
// All API calls must go through the background worker.

export {}

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "https://test.commentverdict.com/api/v1"
const WEB_PORTAL_URL = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"

// Track OAuth flow
let oauthTabId: number | null = null
let oauthState: string | null = null

chrome.runtime.onInstalled.addListener(() => {
  console.log("Focus Guard extension installed!")
})

// Helper to make API requests from background (bypasses CORS)
async function makeAPIRequest(endpoint: string, options: any = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  console.log("Background: Making API request to", url)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    console.log("Background: Response status", response.status)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      
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
    if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/octet-stream'))) {
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
    console.error("Background: Fetch error", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
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
