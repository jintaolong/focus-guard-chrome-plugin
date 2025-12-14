// Content script for syncing authentication state between web portal and extension
// This script runs on the web portal domain to enable bidirectional token sync

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "http://localhost:3000/*",
    "https://app.focus-guard.com/*"
  ],
  run_at: "document_start"
}

const PORTAL_STORAGE_KEYS = {
  ACCESS_TOKEN: 'focus_guard_access_token',
  REFRESH_TOKEN: 'focus_guard_refresh_token'
}

console.log("Focus Guard: Portal sync content script loaded")

// Listen for messages from the extension (background or popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Portal sync: Received message from extension:", message.type)

  // Handle logout request from extension
  if (message.type === 'FG_EXTENSION_LOGOUT') {
    console.log("Portal sync: Extension logged out, clearing portal tokens")
    
    // Clear tokens from web portal's localStorage
    try {
      localStorage.removeItem(PORTAL_STORAGE_KEYS.ACCESS_TOKEN)
      localStorage.removeItem(PORTAL_STORAGE_KEYS.REFRESH_TOKEN)
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
  if (message.type === 'FG_GET_PORTAL_TOKENS') {
    console.log("Portal sync: Extension requesting portal tokens")
    
    try {
      const accessToken = localStorage.getItem(PORTAL_STORAGE_KEYS.ACCESS_TOKEN)
      const refreshToken = localStorage.getItem(PORTAL_STORAGE_KEYS.REFRESH_TOKEN)
      
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
  const accessToken = localStorage.getItem(PORTAL_STORAGE_KEYS.ACCESS_TOKEN)
  const refreshToken = localStorage.getItem(PORTAL_STORAGE_KEYS.REFRESH_TOKEN)

  if (accessToken && refreshToken) {
    console.log("Portal sync: Tokens found in portal storage, syncing to extension")
    
    // Send tokens to extension background script
    chrome.runtime.sendMessage({
      type: 'SYNC_TOKENS_FROM_PORTAL',
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
  if (event.key === PORTAL_STORAGE_KEYS.ACCESS_TOKEN || 
      event.key === PORTAL_STORAGE_KEYS.REFRESH_TOKEN) {
    console.log("Portal sync: Token storage changed, syncing to extension")
    syncTokensToExtension()
  }
})

// Also monitor for custom events dispatched by the portal app
window.addEventListener('focus_guard_login', () => {
  console.log("Portal sync: Login event detected, syncing to extension")
  syncTokensToExtension()
})

window.addEventListener('focus_guard_logout', () => {
  console.log("Portal sync: Logout event detected, clearing extension tokens")
  
  chrome.runtime.sendMessage({
    type: 'CLEAR_EXTENSION_TOKENS'
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
  if (message.type === 'SYNC_TO_PORTAL') {
    const { accessToken, refreshToken } = message
    console.log('Portal sync: Forwarding tokens to portal via window.postMessage')
    window.postMessage({
      type: 'SET_AUTH_TOKENS',
      source: 'focus-guard-chrome-extension',
      accessToken,
      refreshToken,
      isAuthenticated: !!accessToken
    }, '*')
    sendResponse({ success: true })
    return true
  }

  if (message.type === 'CLEAR_PORTAL_TOKENS') {
    console.log('Portal sync: Forwarding clear tokens to portal')
    window.postMessage({ type: 'CLEAR_AUTH_TOKENS', source: 'focus-guard-chrome-extension' }, '*')
    sendResponse({ success: true })
    return true
  }

  return false
})

// Helpers used by window message handler
function requestTokensFromPortal() {
  try {
    console.log('[Extension] Requesting tokens from portal via window.postMessage')
    window.postMessage({ type: 'GET_AUTH_TOKENS', source: 'focus-guard-chrome-extension' }, '*')
  } catch (err) {
    console.warn('Portal sync: requestTokensFromPortal failed', err)
  }
}

async function sendTokensToPortal() {
  try {
    const items = await chrome.storage.sync.get(['focus_guard_access_token', 'focus_guard_refresh_token'])
    const accessToken = items.focus_guard_access_token
    const refreshToken = items.focus_guard_refresh_token

    if (accessToken && refreshToken) {
      console.log('[Extension] Sending tokens to portal')
      window.postMessage({
        type: 'SET_AUTH_TOKENS',
        source: 'focus-guard-chrome-extension',
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
      chrome.runtime.sendMessage({ type: 'SYNC_TOKENS_FROM_PORTAL', accessToken, refreshToken }, (resp) => {
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
        focus_guard_access_token: accessToken,
        focus_guard_refresh_token: refreshToken
      })
      
      // Fetch and store user info
      try {
        const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || 'https://test.commentverdict.com/api/v1'
        
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
              focus_guard_user: user,
              account: {
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
        type: 'AUTH_STATE_CHANGED',
        isAuthenticated: true,
        accessToken,
        refreshToken
      })
      
    } else {
      // 🎯 User logged out on portal - clear extension storage
      console.log('[Extension] Clearing tokens from portal logout')
      
      await chrome.storage.sync.remove([
        'focus_guard_access_token',
        'focus_guard_refresh_token',
        'focus_guard_user',
        'account'
      ])
      
      // Notify background script of logout
      chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
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
    if (source !== 'focus-guard-web-portal') return
    console.log('Portal sync: Received window message from portal:', type, data)

    switch (type) {
      case 'GET_AUTH_TOKENS':
        await sendTokensToPortal()
        break
      case 'SET_AUTH_TOKENS':
      case 'AUTH_TOKENS_RESPONSE':
        await handleTokensFromPortal(data)
        break
      case 'AUTH_STATE_CHANGED':
        await handleAuthStateChanged(data)
        break
      case 'CLEAR_AUTH_TOKENS':
        console.log('Portal sync: Portal requested clearing tokens')
        chrome.runtime.sendMessage({ type: 'CLEAR_EXTENSION_TOKENS' })
        break
      default:
        break
    }
  } catch (err) {
    console.error('Portal sync: error handling window message', err)
  }
})
