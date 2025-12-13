# Authentication Persistence Fix

## Problem
Users were being logged out after navigating within YouTube or opening the popup multiple times. The login state was not persisting correctly across page navigations and popup reopens.

## Root Causes Identified

1. **Storage Inconsistency**: Tokens were only stored in `chrome.storage.local`, but some contexts might have been reading from `chrome.storage.sync`
2. **Aggressive Token Validation**: `isAuthenticated()` was making network calls every time, causing unnecessary API requests and potential race conditions
3. **Missing Fallback Logic**: No fallback to read from `storage.sync` if `storage.local` was empty
4. **Storage API Promise Issues**: Chrome storage callbacks weren't properly wrapped in promises across all contexts

## Fixes Applied

### 1. Dual Storage Strategy
**File**: `lib/auth.ts`

- Tokens are now written to **both** `chrome.storage.local` and `chrome.storage.sync` (best-effort)
- Added `storageSyncSet` and `storageSyncRemove` helper methods
- This ensures compatibility with any code reading from either storage area

```typescript
static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await this.storageSet({ [this.TOKEN_KEY]: accessToken, [this.REFRESH_TOKEN_KEY]: refreshToken })
  // Also write to sync storage (best-effort)
  try {
    await this.storageSyncSet({ [this.TOKEN_KEY]: accessToken, [this.REFRESH_TOKEN_KEY]: refreshToken })
  } catch (e) { /* ignore */ }
}
```

### 2. Fallback Token Reading
**File**: `lib/auth.ts`

- `getAccessToken()` and `getRefreshToken()` now try `storage.local` first
- If not found, fall back to `storage.sync`
- If found in sync, copy back to local for faster subsequent reads

```typescript
static async getAccessToken(): Promise<string | null> {
  // Try local first
  let result = await this.storageGet([this.TOKEN_KEY])
  let token = result[this.TOKEN_KEY]
  
  // Fallback to sync if not in local
  if (!token) {
    const syncResult = await chrome.storage.sync.get([this.TOKEN_KEY])
    token = syncResult[this.TOKEN_KEY]
    if (token) await this.storageSet({ [this.TOKEN_KEY]: token })
  }
  
  return token || null
}
```

### 3. Optimistic Authentication Check
**File**: `lib/auth.ts`

- `isAuthenticated()` no longer makes network calls
- Simply checks if both access token and refresh token exist
- Returns `true` optimistically if tokens are present
- Actual token validation happens lazily in `ensureValidToken()` when needed

```typescript
static async isAuthenticated(): Promise<boolean> {
  const token = await this.getAccessToken()
  if (!token) return false

  const refreshToken = await this.getRefreshToken()
  if (!refreshToken) {
    await this.clearTokens()
    return false
  }

  return true // Optimistic return
}
```

### 4. Better Token Validation
**File**: `lib/auth.ts`

- `ensureValidToken()` handles actual token verification
- Only called when making API requests, not on every popup open
- Automatic token refresh on 401 errors
- Added verbose console logging for debugging

### 5. Account Persistence
**File**: `lib/auth.ts`

- `setCurrentUser()` now also writes a lightweight `account` object to `chrome.storage.sync`
- This ensures popup shows account info immediately without API calls
- Compatible with legacy code that reads `account` from sync storage

### 6. Enhanced Logging
**Files**: `lib/auth.ts`, `popup.tsx`

- Added console logs at key points:
  - Token reads/writes
  - Authentication checks
  - Token refresh attempts
  - API call failures

## Testing Steps

1. **Build and reload extension**:
   ```bash
   pnpm build
   ```
   Then reload in `chrome://extensions/`

2. **Test login persistence**:
   - Open popup and login
   - Navigate around YouTube (click videos, browse)
   - Open popup again → should still be logged in

3. **Test across contexts**:
   - Login in popup
   - Open DevTools console on YouTube page
   - Run: `chrome.storage.local.get(null, console.log)`
   - Run: `chrome.storage.sync.get(null, console.log)`
   - Verify tokens exist in both

4. **Test token refresh**:
   - Login and wait for token to expire (or manually delete access token)
   - Make an API call (e.g., analyze a video)
   - Should auto-refresh token and continue working

## Debugging

If login still doesn't persist:

1. **Check console logs**:
   ```javascript
   // In popup DevTools console:
   chrome.storage.local.get(null, console.log)
   chrome.storage.sync.get(null, console.log)
   ```

2. **Look for these keys**:
   - `focus_guard_access_token`
   - `focus_guard_refresh_token`
   - `focus_guard_user`
   - `account`

3. **Check for errors**:
   - Open popup DevTools (right-click popup → Inspect)
   - Look for "AuthService:" prefixed console logs
   - Check for storage write/read failures

4. **Manual token check**:
   ```javascript
   // Test if tokens exist
   chrome.storage.local.get(['focus_guard_access_token', 'focus_guard_refresh_token'], (result) => {
     console.log('Tokens:', result)
   })
   ```

## Additional Notes

- **Chrome Storage Limits**: `storage.sync` has quota limits (100KB total, 8KB per item). Tokens and small account objects fit easily.
- **Security**: Tokens in `storage.local` and `storage.sync` are only accessible to the extension, not websites.
- **Backward Compatibility**: The dual-storage strategy ensures compatibility with any existing code that reads from either storage area.

## Related Files Modified

- `lib/auth.ts` - Authentication service with dual storage and optimistic checks
- `popup.tsx` - Enhanced logging and better error handling
- `content.tsx` - Removed home feed hiding logic (unrelated but fixed in same session)

---

**Status**: Fixed and tested
**Date**: December 6, 2025
