// DEVELOPMENT ONLY: Portal sync content script with localhost support
// This file is used during development builds
// For production, see: portal-sync.ts

import { ConfigService } from "~lib/config"
import { STORAGE_KEYS, MESSAGE_TYPES, MESSAGE_SOURCES, CUSTOM_EVENTS } from "~lib/constants"

export const config = {
  matches: [
    "https://test.commentverdict.com/*",
    "http://localhost:3000/*",
    "http://localhost:*/*"
  ],
  run_at: "document_start" as const
}

// Runtime config loading for dynamic URL handling
let runtimePortalUrl: string

// Load config from remote source (or fallback to .env)
ConfigService.getConfig().then(config => {
  runtimePortalUrl = config.portal_url
  console.log("Portal sync (DEV): Runtime config loaded, portal_url =", runtimePortalUrl)
}).catch(err => {
  console.warn("Portal sync (DEV): Failed to load remote config, using .env fallback", err)
})

console.log("Comment Verdict: Portal sync content script loaded (DEV with localhost)")

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
