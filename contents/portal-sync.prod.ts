// PRODUCTION: Portal sync content script (no localhost)
// For development builds with localhost, see: portal-sync.dev.ts

import { ConfigService } from "~lib/config"
import { STORAGE_KEYS, MESSAGE_TYPES, MESSAGE_SOURCES, CUSTOM_EVENTS } from "~lib/constants"

export const config = {
  matches: [
    "https://app.commentverdict.com/*",
    "https://staging.commentverdict.com/*"
  ],
  run_at: "document_start" as const
}

// Runtime config loading for dynamic URL handling
let runtimePortalUrl: string

// Load config from remote source (or fallback to .env)
ConfigService.getConfig().then(config => {
  runtimePortalUrl = config.portal_url
  console.log("Portal sync (PROD): Runtime config loaded, portal_url =", runtimePortalUrl)
}).catch(err => {
  console.warn("Portal sync (PROD): Failed to load remote config, using .env fallback", err)
})

console.log("Comment Verdict: Portal sync content script loaded (PRODUCTION)")

// Listen for messages from the extension (background or popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Portal sync: Received message from extension:", message.type)

  // Handle logout request from extension
  if (message.type === MESSAGE_TYPES.FG_EXTENSION_LOGOUT) {
    console.log("Portal sync: Extension requested logout, posting to portal")
    
    // Send logout event to portal
    window.postMessage(
      {
        type: CUSTOM_EVENTS.AUTH_LOGOUT,
        source: MESSAGE_SOURCES.CHROME_EXTENSION
      },
      "*"
    )
    
    sendResponse({ success: true })
    return true
  }

  // Handle token fetch request from extension
  if (message.type === MESSAGE_TYPES.GET_AUTH_TOKENS) {
    console.log("Portal sync: Extension requested tokens, posting to portal")
    
    // Request tokens from the portal
    window.postMessage(
      {
        type: CUSTOM_EVENTS.REQUEST_TOKENS,
        source: MESSAGE_SOURCES.CHROME_EXTENSION
      },
      "*"
    )
    
    sendResponse({ success: true })
    return true
  }

  // Handle token update from extension (extension → portal sync)
  if (message.type === MESSAGE_TYPES.SET_AUTH_TOKENS) {
    console.log("Portal sync: Extension sending tokens to portal")
    
    // Send tokens to portal
    window.postMessage(
      {
        type: CUSTOM_EVENTS.SET_TOKENS,
        source: MESSAGE_SOURCES.CHROME_EXTENSION,
        payload: {
          access_token: message.access_token,
          refresh_token: message.refresh_token
        }
      },
      "*"
    )
    
    sendResponse({ success: true })
    return true
  }

  // Handle token clear from extension
  if (message.type === MESSAGE_TYPES.CLEAR_AUTH_TOKENS) {
    console.log("Portal sync: Extension clearing tokens in portal")
    
    // Clear tokens in portal
    window.postMessage(
      {
        type: CUSTOM_EVENTS.CLEAR_TOKENS,
        source: MESSAGE_SOURCES.CHROME_EXTENSION
      },
      "*"
    )
    
    sendResponse({ success: true })
    return true
  }
})

// Listen for messages from the web portal (portal → extension sync)
window.addEventListener("message", async (event) => {
  // Validate message source
  if (event.source !== window) return
  if (!event.data.source || event.data.source !== MESSAGE_SOURCES.WEB_PORTAL) return

  const { type, payload } = event.data

  console.log("Portal sync: Received message from portal:", type)

  // Handle tokens from portal (portal login)
  if (type === CUSTOM_EVENTS.TOKENS_UPDATED) {
    console.log("Portal sync: Portal provided tokens, syncing to extension")
    
    const { access_token, refresh_token } = payload
    
    // Store tokens in extension storage
    await chrome.storage.sync.set({
      [STORAGE_KEYS.ACCESS_TOKEN]: access_token,
      [STORAGE_KEYS.REFRESH_TOKEN]: refresh_token
    })
    
    // Notify background script about token update
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SYNC_TOKENS_FROM_PORTAL,
      access_token,
      refresh_token
    })
    
    console.log("Portal sync: Tokens synced from portal to extension")
  }

  // Handle logout from portal
  if (type === CUSTOM_EVENTS.LOGGED_OUT) {
    console.log("Portal sync: Portal logged out, clearing extension storage")
    
    // Clear all auth data from extension storage
    await chrome.storage.sync.remove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.ACCOUNT
    ])
    
    // Notify background script about logout
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PORTAL_LOGOUT
    })
    
    console.log("Portal sync: Extension storage cleared after portal logout")
  }

  // Handle token request response from portal
  if (type === CUSTOM_EVENTS.TOKENS_RESPONSE) {
    console.log("Portal sync: Portal responded with tokens")
    
    if (payload.access_token && payload.refresh_token) {
      // Store tokens in extension storage
      await chrome.storage.sync.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: payload.access_token,
        [STORAGE_KEYS.REFRESH_TOKEN]: payload.refresh_token
      })
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SYNC_TOKENS_FROM_PORTAL,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token
      })
      
      console.log("Portal sync: Tokens from portal request stored in extension")
    } else {
      console.log("Portal sync: Portal has no tokens available")
    }
  }
})

console.log("Comment Verdict: Portal sync message listeners registered")


// Listen for messages from the extension (background or popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Portal sync: Received message from extension:", message.type)

  // Handle logout request from extension
  if (message.type === MESSAGE_TYPES.FG_EXTENSION_LOGOUT) {
    console.log("Portal sync: Extension logged out, clearing portal tokens")
    
    // Clear tokens from web portal's localStorage
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
      console.log("Portal sync: Portal tokens cleared")
      
      // Reload the page to update UI
      window.location.reload()
    } catch (error) {
      console.error("Portal sync: Failed to clear portal tokens:", error)
    }
    
    sendResponse({ success: true })
    return true
  }

  // Handle request to get portal tokens
  if (message.type === MESSAGE_TYPES.FG_GET_PORTAL_TOKENS) {
    console.log("Portal sync: Extension requesting portal tokens")
    
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
      
      if (accessToken && refreshToken) {
        console.log("Portal sync: Found tokens in portal storage")
        sendResponse({
          success: true,
          accessToken,
          refreshToken
        })
      } else {
        console.log("Portal sync: No tokens found in portal storage")
        sendResponse({ success: false, reason: 'no_tokens' })
      }
    } catch (error) {
      console.error("Portal sync: Failed to get portal tokens:", error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      sendResponse({ success: false, error: errorMessage })
    }
    
    return true
  }

  return false
})

// Monitor localStorage changes and sync to extension when tokens are updated
// This handles the case when user logs in on the web portal
function syncTokensToExtension() {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)

  if (accessToken && refreshToken) {
    console.log("Portal sync: Tokens found in portal storage, syncing to extension")
    
    // Send tokens to extension background script
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SYNC_TOKENS_FROM_PORTAL,
      accessToken,
      refreshToken
    }).then((response) => {
      if (response?.success) {
        console.log("Portal sync: Tokens synced to extension successfully")
      } else {
        console.error("Portal sync: Failed to sync tokens to extension:", response?.error)
      }
    }).catch((error) => {
      console.error("Portal sync: Error syncing tokens to extension:", error)
    })
  }
}

// Check for tokens on initial load
syncTokensToExtension()

// Monitor for storage events (when tokens change in another tab)
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEYS.ACCESS_TOKEN || 
      event.key === STORAGE_KEYS.REFRESH_TOKEN) {
    console.log("Portal sync: Token storage changed, syncing to extension")
    syncTokensToExtension()
  }
})

// Also monitor for custom events dispatched by the portal app
window.addEventListener(CUSTOM_EVENTS.LOGIN, () => {
  console.log("Portal sync: Login event detected, syncing to extension")
  syncTokensToExtension()
})

window.addEventListener(CUSTOM_EVENTS.LOGOUT, () => {
  console.log("Portal sync: Logout event detected, clearing extension tokens")
  
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CLEAR_EXTENSION_TOKENS
  }).then(() => {
    console.log("Portal sync: Extension tokens cleared")
  }).catch((error) => {
    console.error("Portal sync: Error clearing extension tokens:", error)
  })
})

console.log("Focus Guard: Portal sync initialized")

// Request tokens from portal on load
try {
  requestTokensFromPortal()
} catch (e) {
  console.warn('Portal sync: requestTokensFromPortal failed on init', e)
}

// Listen for messages from background to forward to portal
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false

  // Forward token sync to portal
  if (message.type === MESSAGE_TYPES.SYNC_TO_PORTAL) {
    const { accessToken, refreshToken } = message
    console.log('Portal sync: Forwarding tokens to portal via window.postMessage')
    window.postMessage({
      type: MESSAGE_TYPES.SET_AUTH_TOKENS,
      source: MESSAGE_SOURCES.CHROME_EXTENSION,
      accessToken,
      refreshToken,
      isAuthenticated: !!accessToken
    }, '*')
    sendResponse({ success: true })
    return true
  }

  if (message.type === MESSAGE_TYPES.CLEAR_PORTAL_TOKENS) {
    console.log('Portal sync: Forwarding clear tokens to portal')
    window.postMessage({ type: MESSAGE_TYPES.CLEAR_AUTH_TOKENS, source: MESSAGE_SOURCES.CHROME_EXTENSION }, '*')
    sendResponse({ success: true })
    return true
  }

  return false
})

// Helpers used by window message handler
function requestTokensFromPortal() {
  try {
    console.log('[Extension] Requesting tokens from portal via window.postMessage')
    window.postMessage({ type: MESSAGE_TYPES.GET_AUTH_TOKENS, source: MESSAGE_SOURCES.CHROME_EXTENSION }, '*')
  } catch (err) {
    console.warn('Portal sync: requestTokensFromPortal failed', err)
  }
}

async function sendTokensToPortal() {
  try {
    const items = await chrome.storage.sync.get([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN])
    const accessToken = items[STORAGE_KEYS.ACCESS_TOKEN]
    const refreshToken = items[STORAGE_KEYS.REFRESH_TOKEN]

    if (accessToken && refreshToken) {
      console.log('[Extension] Sending tokens to portal')
      window.postMessage({
        type: MESSAGE_TYPES.SET_AUTH_TOKENS,
        source: MESSAGE_SOURCES.CHROME_EXTENSION,
        accessToken,
        refreshToken,
        isAuthenticated: true
      }, '*')
    } else {
      console.log('[Extension] No tokens to send to portal')
    }
  } catch (error) {
    console.error('[Extension] Failed to read tokens from storage', error)
  }
}

async function handleTokensFromPortal(data: any) {
  try {
    const { accessToken, refreshToken, isAuthenticated } = data || {}
    if (isAuthenticated && accessToken && refreshToken) {
      console.log('Portal sync: Received tokens from portal, storing in extension')
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SYNC_TOKENS_FROM_PORTAL, accessToken, refreshToken }, (resp) => {
        console.log('Portal sync: background store response', resp)
      })
    } else {
      console.log('Portal sync: Received token payload from portal but missing tokens or not authenticated')
    }
  } catch (err) {
    console.error('Portal sync: handleTokensFromPortal error', err)
  }
}

async function handleAuthStateChanged(data: any) {
  try {
    const { accessToken, refreshToken, isAuthenticated } = data || {}
    
    console.log('[Extension] Auth state changed from portal:', { isAuthenticated })
    
    if (isAuthenticated && accessToken && refreshToken) {
      // 🎯 User logged in on portal - store tokens in extension
      console.log('[Extension] Storing tokens from portal login')
      
      await chrome.storage.sync.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
        [STORAGE_KEYS.REFRESH_TOKEN]: refreshToken
      })
      
      // Fetch and store user info
      try {
        // Get API URL from config
        const config = await ConfigService.getConfig()
        const API_BASE_URL = config.api_url
        
        const response = await fetch(`${API_BASE_URL}/users/me`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        
        if (response.ok) {
          const user = await response.json()
          console.log('[Extension] Got user info:', user.email)
          
          // Fetch subscription data
          const [subscriptionRes, usageRes] = await Promise.all([
            fetch(`${API_BASE_URL}/subscriptions/`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            fetch(`${API_BASE_URL}/subscriptions/usage`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            })
          ])
          
          if (subscriptionRes.ok && usageRes.ok) {
            const subscription = await subscriptionRes.json()
            const usage = await usageRes.json()
            
            // Store complete account data
            await chrome.storage.sync.set({
              [STORAGE_KEYS.USER]: user,
              [STORAGE_KEYS.ACCOUNT]: {
                email: user.email,
                isLoggedIn: true,
                tier: usage.tier.toLowerCase(), // 'free', 'starter', or 'pro'
                searchesUsedToday: usage.daily_searches_used,
                searchesRemaining: usage.searches_remaining,
                resetTime: subscription.last_reset_date
              }
            })
            
            console.log('[Extension] User info and subscription synced from portal')
          }
        }
      } catch (error) {
        console.error('[Extension] Failed to fetch user info:', error)
      }
      
      // Notify background script of login
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.AUTH_STATE_CHANGED,
        isAuthenticated: true,
        accessToken,
        refreshToken
      })
      
    } else {
      // 🎯 User logged out on portal - clear extension storage
      console.log('[Extension] Clearing tokens from portal logout')
      
      await chrome.storage.sync.remove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.ACCOUNT
      ])
      
      // Notify background script of logout
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.AUTH_STATE_CHANGED,
        isAuthenticated: false
      })
    }
  } catch (err) {
    console.error('Portal sync: handleAuthStateChanged error', err)
  }
}

// Listen for messages from the web portal via window.postMessage
window.addEventListener('message', async (event) => {
  try {
    if (event.source !== window) return
    const data = event.data || {}
    const { type, source } = data
    if (source !== MESSAGE_SOURCES.WEB_PORTAL) return
    console.log('Portal sync: Received window message from portal:', type, data)

    switch (type) {
      case MESSAGE_TYPES.GET_AUTH_TOKENS:
        await sendTokensToPortal()
        break
      case MESSAGE_TYPES.SET_AUTH_TOKENS:
      case MESSAGE_TYPES.AUTH_TOKENS_RESPONSE:
        await handleTokensFromPortal(data)
        break
      case MESSAGE_TYPES.AUTH_STATE_CHANGED:
        await handleAuthStateChanged(data)
        break
      case MESSAGE_TYPES.CLEAR_AUTH_TOKENS:
        console.log('Portal sync: Portal requested clearing tokens')
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_EXTENSION_TOKENS })
        break
      default:
        break
    }
  } catch (err) {
    console.error('Portal sync: error handling window message', err)
  }
})
