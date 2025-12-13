# Google OAuth Integration for Focus Guard Chrome Extension

## Overview
This document describes the complete Google OAuth integration for the Focus Guard Chrome extension, enabling users to sign in with their Google account and maintain synchronized authentication state between the web portal and the extension.

## Architecture

### Components

1. **AuthService (`lib/auth.ts`)** - OAuth methods
2. **Background Script (`background.ts`)** - OAuth flow monitoring and token management
3. **LoginForm (`components/popup/LoginForm.tsx`)** - Google sign-in button
4. **Portal Sync Content Script (`portal-sync.ts`)** - Token synchronization with web portal
5. **Package Manifest (`package.json`)** - Permissions and content script registration

## OAuth Flow

### Step 1: Initiate Google Login

**User Action:** Clicks "Continue with Google" button in extension popup

**Code Flow:**
```typescript
// In LoginForm.tsx
const { tabId, state } = await AuthService.initiateGoogleLogin()
```

**Backend Request:**
- **Method:** `GET`
- **Endpoint:** `/auth/google/login`
- **Headers:** None (public endpoint)
- **Response:**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "random_state_string_for_csrf_protection"
}
```

**What Happens:**
1. Extension calls backend to get Google OAuth URL
2. Backend generates OAuth URL with state parameter for CSRF protection
3. Extension opens the `auth_url` in a new browser tab using `chrome.tabs.create()`
4. Extension notifies background script to monitor this tab

### Step 2: User Authenticates with Google

**User Action:** Completes Google OAuth consent flow in the opened tab

**What Happens:**
1. User logs in with Google account
2. User grants permissions to Focus Guard
3. Google redirects to backend callback URL with authorization code
4. Backend exchanges code for user info, creates/updates user account
5. Backend generates JWT access and refresh tokens

### Step 3: Callback Redirect

**Backend Redirects to:**
```
http://localhost:3000/auth/callback?access_token=<jwt>&refresh_token=<jwt>&token_type=Bearer
```

**For Production:**
```
https://app.focus-guard.com/auth/callback?access_token=<jwt>&refresh_token=<jwt>&token_type=Bearer
```

### Step 4: Extension Captures Tokens

**Code Flow:**
```typescript
// In background.ts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.includes('/auth/callback')) {
    // Extract tokens from URL
    const accessToken = url.searchParams.get("access_token")
    const refreshToken = url.searchParams.get("refresh_token")
    
    // Store in chrome.storage.sync
    chrome.storage.sync.set({
      focus_guard_access_token: accessToken,
      focus_guard_refresh_token: refreshToken
    })
    
    // Close OAuth tab
    chrome.tabs.remove(tabId)
    
    // Notify popup
    chrome.runtime.sendMessage({ type: 'OAUTH_COMPLETE' })
  }
})
```

**What Happens:**
1. Background script monitors the OAuth tab URL changes via `chrome.tabs.onUpdated`
2. When callback URL is detected, tokens are extracted from query parameters
3. Tokens are stored in `chrome.storage.sync` (persists across sessions)
4. OAuth tab is automatically closed
5. Popup is notified to refresh UI

### Step 5: UI Updates

**Code Flow:**
```typescript
// In LoginForm.tsx - listening for completion
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'OAUTH_COMPLETE') {
    window.location.reload() // Refresh popup to show logged-in state
  }
})
```

## Token Synchronization Between Web Portal and Extension

### Problem
Chrome extensions cannot directly access web page `localStorage` due to security isolation. The web portal stores tokens in `localStorage`, but the extension needs its own copy in `chrome.storage.sync`.

### Solution
Use a **content script** (`portal-sync.ts`) that runs on the web portal domain to bridge the two storage systems.

### Portal → Extension Sync (User logs in on web portal)

**Flow:**
1. User logs in on web portal (via Google or email/password)
2. Web portal stores tokens in `localStorage`
3. Content script detects tokens in `localStorage`
4. Content script sends tokens to background script via `chrome.runtime.sendMessage()`
5. Background script stores tokens in `chrome.storage.sync`
6. Extension is now authenticated

**Code:**
```typescript
// In portal-sync.ts
function syncTokensToExtension() {
  const accessToken = localStorage.getItem('focus_guard_access_token')
  const refreshToken = localStorage.getItem('focus_guard_refresh_token')

  if (accessToken && refreshToken) {
    chrome.runtime.sendMessage({
      type: 'SYNC_TOKENS_FROM_PORTAL',
      accessToken,
      refreshToken
    })
  }
}

// Run on load and on storage changes
syncTokensToExtension()
window.addEventListener('storage', syncTokensToExtension)
```

### Extension → Portal Sync (User logs out in extension)

**Flow:**
1. User clicks logout in extension
2. Extension clears `chrome.storage.sync` tokens
3. Extension sends message to all open portal tabs via `chrome.tabs.sendMessage()`
4. Content script receives message and clears portal `localStorage`
5. Portal page reloads to show logged-out state

**Code:**
```typescript
// In lib/auth.ts
private static async notifyWebPortalLogout() {
  const tabs = await chrome.tabs.query({ url: `${PORTAL_URL}/*` })
  
  for (const tab of tabs) {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'FG_EXTENSION_LOGOUT'
    })
  }
}

// In portal-sync.ts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FG_EXTENSION_LOGOUT') {
    localStorage.removeItem('focus_guard_access_token')
    localStorage.removeItem('focus_guard_refresh_token')
    window.location.reload()
  }
})
```

## Storage Keys

### Extension Storage (`chrome.storage.sync`)
- `focus_guard_access_token` - JWT access token
- `focus_guard_refresh_token` - JWT refresh token
- `focus_guard_user` - User object with email, id, etc.
- `account` - Legacy compatibility object

### Web Portal Storage (`localStorage`)
- `focus_guard_access_token` - JWT access token
- `focus_guard_refresh_token` - JWT refresh token

**Important:** Keys must match exactly for sync to work!

## Authorization Headers

All authenticated API requests automatically include:
```typescript
Authorization: Bearer <access_token>
```

This is handled by `AuthService.fetchWithAuth()` and `FocusGuardAPI.fetchWithAuth()`.

## Token Refresh on 401

**Flow:**
1. API request returns 401 Unauthorized
2. `AuthService.ensureValidToken()` catches the error
3. Calls `/auth/refresh` with refresh token
4. Stores new tokens
5. Retries original request with new token

**Code:**
```typescript
// In lib/auth.ts
static async ensureValidToken(): Promise<string> {
  try {
    await this.getMe() // Validate token
    return accessToken
  } catch (error) {
    // Token expired, try refresh
    const token = await this.refreshAccessToken()
    return token.access_token
  }
}
```

## Environment Variables

### `.env` file
```bash
# Backend API URL
PLASMO_PUBLIC_API_URL=https://test.commentverdict.com/api/v1

# Web Portal URL (for OAuth callbacks)
PLASMO_PUBLIC_WEB_PORTAL_URL=http://localhost:3000

# Debug mode
FOCUS_GUARD_DEBUG=0
```

### For Production
```bash
PLASMO_PUBLIC_WEB_PORTAL_URL=https://app.focus-guard.com
```

## Permissions Required

### In `package.json` manifest:
```json
{
  "host_permissions": [
    "https://*/*",
    "http://localhost:3000/*"
  ],
  "permissions": [
    "storage",
    "tabs"
  ],
  "content_scripts": [
    {
      "matches": [
        "http://localhost:3000/*",
        "https://app.focus-guard.com/*"
      ],
      "js": ["portal-sync.ts"],
      "run_at": "document_start"
    }
  ]
}
```

**Why Each Permission:**
- `storage` - Store tokens in `chrome.storage.sync`
- `tabs` - Monitor OAuth tab URL changes, close tabs, send messages to portal tabs
- `host_permissions` - Make API requests to backend and portal
- `content_scripts` - Run `portal-sync.ts` on portal pages for token sync

## Testing

### Test OAuth Flow
1. Click "Continue with Google" in extension popup
2. Verify new tab opens with Google OAuth consent
3. Complete Google sign-in
4. Verify redirect to `localhost:3000/auth/callback?access_token=...`
5. Verify OAuth tab closes automatically
6. Verify popup shows logged-in state
7. Verify tokens in extension storage: `chrome.storage.sync.get(['focus_guard_access_token'])`

### Test Portal → Extension Sync
1. Open web portal in browser
2. Log in via Google on the portal
3. Open extension popup
4. Verify extension shows logged-in state (without separate login)

### Test Extension → Portal Sync
1. Log out in extension popup
2. Verify web portal (if open) also logs out and reloads

### Test Token Refresh
1. Wait for access token to expire (or manually delete it from storage)
2. Make an API request
3. Verify 401 error triggers token refresh
4. Verify new tokens are stored
5. Verify request succeeds with new token

## Security Considerations

1. **State Parameter:** Backend generates CSRF protection state parameter
2. **Token Storage:** Tokens stored in `chrome.storage.sync` (encrypted by Chrome)
3. **HTTPS Only:** Production OAuth callbacks use HTTPS
4. **HttpOnly Cookies:** Not used (tokens in URL for extension to capture)
5. **Token Expiration:** Short-lived access tokens, long-lived refresh tokens
6. **Automatic Refresh:** Tokens refreshed automatically on 401

## Troubleshooting

### OAuth tab doesn't close
- Check background script console for errors
- Verify callback URL matches `WEB_PORTAL_URL/auth/callback`

### Tokens not syncing from portal
- Check content script is loaded: Open portal, inspect page, check for "Portal sync initialized" log
- Verify content script matches in manifest match portal URL
- Check portal uses exact same storage keys

### Extension → Portal logout not working
- Verify portal tab is open when logout happens
- Check content script receives `FG_EXTENSION_LOGOUT` message
- Verify portal clears localStorage on message

### API requests fail with 401
- Check tokens exist: `chrome.storage.sync.get(['focus_guard_access_token'])`
- Verify token refresh is working (check logs)
- Try manual logout and re-login

## Implementation Checklist

- [x] Add Google OAuth method to AuthService
- [x] Update background script with OAuth monitoring
- [x] Add Google login button to LoginForm
- [x] Create portal sync content script
- [x] Update manifest for new permissions
- [x] Add environment variable for portal URL
- [x] Implement token extraction from callback URL
- [x] Implement bidirectional token sync
- [x] Handle logout synchronization
- [x] Add token refresh on 401
- [x] Document complete flow

## Next Steps

1. **Backend:** Ensure `/auth/google/login` endpoint returns `{ auth_url, state }`
2. **Backend:** Ensure callback redirects to portal with tokens in URL query params
3. **Portal:** Add callback route `/auth/callback` to handle OAuth completion
4. **Portal:** Store tokens in localStorage with exact key names
5. **Portal:** Dispatch custom events on login/logout for extension sync
6. **Testing:** End-to-end testing of OAuth flow and token sync
