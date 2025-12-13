# Google OAuth Integration - Quick Summary

## What Was Implemented

✅ Complete Google OAuth login flow for Chrome extension  
✅ Bidirectional token synchronization between web portal and extension  
✅ Automatic token refresh on 401 errors  
✅ Synchronized logout across portal and extension  

## Key Endpoint

### Initiate Google Login
```
GET /api/v1/auth/google/login
```

**Response:**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "random_state_csrf_token"
}
```

### Backend Callback Redirect Format
```
http://localhost:3000/auth/callback?access_token=<jwt>&refresh_token=<jwt>&token_type=Bearer
```

## Files Modified/Created

1. **`.env`** - Added `PLASMO_PUBLIC_WEB_PORTAL_URL` variable
2. **`lib/auth.ts`** - Added OAuth methods:
   - `initiateGoogleLogin()` - Calls backend and opens OAuth tab
   - `extractTokensFromUrl()` - Parses callback URL
   - `handleOAuthCallback()` - Stores tokens and fetches user
   - `syncTokensFromWebPortal()` - Syncs from portal localStorage
   - `notifyWebPortalLogout()` - Notifies portal of logout

3. **`background.ts`** - Added OAuth monitoring:
   - Monitors OAuth tab URL via `chrome.tabs.onUpdated`
   - Extracts tokens from callback URL
   - Stores tokens in `chrome.storage.sync`
   - Closes OAuth tab automatically
   - Handles `SYNC_TOKENS_FROM_PORTAL` message
   - Handles `CLEAR_EXTENSION_TOKENS` message

4. **`components/popup/LoginForm.tsx`** - Added:
   - "Continue with Google" button with Google logo
   - OAuth flow initiation on button click
   - Listener for OAuth completion
   - Auto-reload on successful login

5. **`portal-sync.ts`** - NEW content script for token sync:
   - Runs on portal domain (`localhost:3000` and `app.focus-guard.com`)
   - Syncs tokens from portal → extension on login
   - Clears portal tokens when extension logs out
   - Monitors localStorage changes
   - Listens for custom events

6. **`package.json`** - Updated manifest:
   - Added `http://localhost:3000/*` to host_permissions
   - Added content_scripts entry for `portal-sync.ts`

7. **`GOOGLE_OAUTH_INTEGRATION.md`** - Complete documentation

## How It Works (High-Level)

### OAuth Login Flow
1. User clicks "Continue with Google"
2. Extension calls `GET /auth/google/login`
3. Opens Google OAuth in new tab
4. Backend handles callback, redirects to portal with tokens
5. Extension monitors tab, extracts tokens from URL
6. Extension closes OAuth tab and stores tokens
7. UI refreshes to show logged-in state

### Token Sync (Portal → Extension)
1. User logs in on web portal
2. Portal stores tokens in localStorage
3. Content script detects tokens
4. Content script sends tokens to background script
5. Background stores in chrome.storage.sync
6. Extension is authenticated

### Logout Sync (Extension → Portal)
1. User logs out in extension
2. Extension clears chrome.storage.sync
3. Extension sends message to portal tabs
4. Content script clears portal localStorage
5. Portal reloads to show logged-out state

## Storage Keys (MUST MATCH)

### Extension
- `focus_guard_access_token`
- `focus_guard_refresh_token`
- `focus_guard_user`

### Web Portal
- `focus_guard_access_token`
- `focus_guard_refresh_token`

## Testing Checklist

- [ ] Click "Continue with Google" opens OAuth tab
- [ ] OAuth tab shows Google login
- [ ] After Google login, redirects to portal callback
- [ ] OAuth tab closes automatically
- [ ] Extension popup shows logged-in state
- [ ] Login on portal syncs to extension (no separate login needed)
- [ ] Logout in extension also logs out portal (if tab open)
- [ ] API requests include Bearer token
- [ ] 401 errors trigger automatic token refresh

## Backend Requirements

The backend needs to implement:

1. **GET /auth/google/login**
   - Returns `{ auth_url, state }`
   
2. **OAuth Callback Handler**
   - Exchanges Google code for user info
   - Creates/updates user in database
   - Generates JWT tokens
   - Redirects to: `${WEB_PORTAL_URL}/auth/callback?access_token=<jwt>&refresh_token=<jwt>&token_type=Bearer`

## Web Portal Requirements

1. **Route:** `/auth/callback`
   - Extracts tokens from URL params
   - Stores in localStorage with correct keys
   - Redirects to dashboard/home

2. **Optional:** Dispatch custom events for better sync:
   ```javascript
   window.dispatchEvent(new Event('focus_guard_login'))
   window.dispatchEvent(new Event('focus_guard_logout'))
   ```

## Environment Setup

### Development
```bash
PLASMO_PUBLIC_API_URL=https://test.commentverdict.com/api/v1
PLASMO_PUBLIC_WEB_PORTAL_URL=http://localhost:3000
```

### Production
```bash
PLASMO_PUBLIC_API_URL=https://api.focus-guard.com/api/v1
PLASMO_PUBLIC_WEB_PORTAL_URL=https://app.focus-guard.com
```

## Run the Extension

```bash
# Development mode
pnpm dev

# Production build
pnpm build
```

Then load the `build/chrome-mv3-dev` or `build/chrome-mv3-prod` folder in Chrome as an unpacked extension.

---

**Status:** ✅ Implementation Complete  
**Next Step:** Backend to implement `/auth/google/login` endpoint and callback redirect
