// Constants for Focus Guard Chrome Extension
// These are configuration values that should not be hardcoded in source files

// Storage keys used across the extension
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'focus_guard_access_token',
  REFRESH_TOKEN: 'focus_guard_refresh_token',
  USER: 'focus_guard_user',
  ACCOUNT: 'account',
  SETTINGS: 'settings',
  IS_AUTHENTICATED: 'isAuthenticated'
} as const

// Message types for extension communication
export const MESSAGE_TYPES = {
  // Extension <-> Background
  API_REQUEST: 'API_REQUEST',
  OPEN_TAB: 'OPEN_TAB',
  START_TOKEN_REFRESH: 'START_TOKEN_REFRESH',
  OAUTH_START: 'OAUTH_START',
  OAUTH_COMPLETE: 'OAUTH_COMPLETE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Portal <-> Extension
  SYNC_TOKENS_FROM_PORTAL: 'SYNC_TOKENS_FROM_PORTAL',
  SYNC_TO_PORTAL: 'SYNC_TO_PORTAL',
  CLEAR_EXTENSION_TOKENS: 'CLEAR_EXTENSION_TOKENS',
  CLEAR_PORTAL_TOKENS: 'CLEAR_PORTAL_TOKENS',
  FG_EXTENSION_LOGOUT: 'FG_EXTENSION_LOGOUT',
  FG_GET_PORTAL_TOKENS: 'FG_GET_PORTAL_TOKENS',
  AUTH_STATE_CHANGED: 'AUTH_STATE_CHANGED',
  PORTAL_LOGOUT: 'PORTAL_LOGOUT',
  
  // Window postMessage types
  GET_AUTH_TOKENS: 'GET_AUTH_TOKENS',
  SET_AUTH_TOKENS: 'SET_AUTH_TOKENS',
  AUTH_TOKENS_RESPONSE: 'AUTH_TOKENS_RESPONSE',
  CLEAR_AUTH_TOKENS: 'CLEAR_AUTH_TOKENS'
} as const

// Message sources for validation
export const MESSAGE_SOURCES = {
  WEB_PORTAL: 'focus-guard-web-portal',
  CHROME_EXTENSION: 'focus-guard-chrome-extension'
} as const

// Content script match patterns (required to be static for Chrome manifest)
// Note: These must be defined at build time and cannot be dynamic
// Defaults to commentverdict.com domains + localhost for development
export const CONTENT_SCRIPT_MATCHES = {
  // All portal matches combined
  ALL: [
    // Production
    "https://app.commentverdict.com/*",
    // Staging
    "https://staging.commentverdict.com/*",
    // Wildcard
    "https://*.commentverdict.com/*",
    // Development - localhost
    "http://localhost:3000/*",
    "http://localhost:*/*"
  ]
}

// Custom events dispatched by portal
export const CUSTOM_EVENTS = {
  // Extension -> Portal events
  AUTH_LOGOUT: 'focus_guard_logout',
  REQUEST_TOKENS: 'focus_guard_request_tokens',
  SET_TOKENS: 'focus_guard_set_tokens',
  CLEAR_TOKENS: 'focus_guard_clear_tokens',
  
  // Portal -> Extension events
  LOGIN: 'focus_guard_login',
  LOGOUT: 'focus_guard_logout',
  TOKENS_UPDATED: 'focus_guard_tokens_updated',
  LOGGED_OUT: 'focus_guard_logged_out',
  TOKENS_RESPONSE: 'focus_guard_tokens_response'
} as const
