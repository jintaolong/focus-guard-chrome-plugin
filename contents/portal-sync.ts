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
