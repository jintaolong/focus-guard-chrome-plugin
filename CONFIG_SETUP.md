# Configuration Setup Guide

## Overview

Focus Guard uses a hybrid configuration approach:
- **Development Mode** (Debug): Uses `.env` file only
- **Production Mode**: Fetches configuration from remote JSON file

## Configuration Modes

### Debug/Development Mode

When `FOCUS_GUARD_DEBUG=1`, the extension uses **only** the `.env` file values.

**`.env` file:**
```dotenv
PLASMO_PUBLIC_API_URL=http://localhost:8000/api/v1
PLASMO_PUBLIC_WEB_PORTAL_URL=http://localhost:3000
FOCUS_GUARD_DEBUG=1
```

### Production Mode

When `FOCUS_GUARD_DEBUG=0`, the extension fetches configuration from:
```
https://focus-guard.github.io/focus-guard-config/config.json
```

If remote fetch fails, it falls back to `.env` values.

**`.env` file for production:**
```dotenv
PLASMO_PUBLIC_API_URL=https://commentverdict.com/api/v1
PLASMO_PUBLIC_WEB_PORTAL_URL=https://app.focus-guard.com
FOCUS_GUARD_DEBUG=0
```

## Remote Configuration File

### Location
Host your `config.json` at a public URL. Recommended options:
- **GitHub Pages** (free): `https://yourusername.github.io/focus-guard-config/config.json`
- **AWS S3 + CloudFront**: `https://config.focus-guard.com/config.json`
- **Cloudflare Workers**: `https://config.focus-guard.workers.dev/config.json`

### Format

**Minimal config.json:**
```json
{
  "version": "1.0.0",
  "api_url": "https://commentverdict.com/api/v1",
  "portal_url": "https://app.focus-guard.com"
}
```

**Extended config.json with features:**
```json
{
  "version": "1.0.0",
  "api_url": "https://commentverdict.com/api/v1",
  "portal_url": "https://app.focus-guard.com",
  "features": {
    "video_analysis": true,
    "bot_detection": true,
    "premium_reports": true,
    "sentiment_analysis": true
  },
  "rate_limits": {
    "free_tier_daily": 10,
    "pro_tier_daily": 100,
    "enterprise_tier_daily": 1000
  },
  "ui_config": {
    "theme": "light",
    "show_onboarding": true
  }
}
```

## Configuration Priority

The ConfigService follows this priority order:

```
Production Mode:
1. Remote config from GitHub Pages (cached for 1 hour)
2. Cached config from chrome.storage.local
3. Environment variables from .env file

Debug Mode:
1. Environment variables from .env file (only)
```

## Implementation Details

### Files Using Configuration

1. **[lib/config.ts](lib/config.ts)** - ConfigService with debug mode detection
2. **[background.ts](background.ts)** - Background service worker
3. **[lib/api.ts](lib/api.ts)** - API service layer
4. **[lib/auth.ts](lib/auth.ts)** - Authentication service
5. **[popup.tsx](popup.tsx)** - Extension popup UI
6. **[contents/portal-sync.ts](contents/portal-sync.ts)** - Portal synchronization

### Debug Mode Detection

```typescript
const isDebugMode = () => {
  const debugEnv = process.env.FOCUS_GUARD_DEBUG
  return debugEnv === "1" || debugEnv === "true" || process.env.NODE_ENV === "development"
}
```

### Config Loading Example

```typescript
import { ConfigService } from "~lib/config"

// Get current configuration
const config = await ConfigService.getConfig()
console.log("API URL:", config.api_url)
console.log("Portal URL:", config.portal_url)

// Force refresh from remote
const freshConfig = await ConfigService.refreshConfig()

// Clear cached configuration
ConfigService.clearCache()
```

## Deployment Checklist

### For Local Development

- [ ] Set `FOCUS_GUARD_DEBUG=1` in `.env`
- [ ] Set `PLASMO_PUBLIC_API_URL` to local backend (e.g., `http://localhost:8000/api/v1`)
- [ ] Set `PLASMO_PUBLIC_WEB_PORTAL_URL` to local portal (e.g., `http://localhost:3000`)
- [ ] Run `pnpm dev`

### For Production Release

- [ ] Set `FOCUS_GUARD_DEBUG=0` in `.env` (or remove from build)
- [ ] Update remote `config.json` with production URLs
- [ ] Verify remote config is accessible (test URL in browser)
- [ ] Set production fallback values in `.env`:
  - `PLASMO_PUBLIC_API_URL=https://commentverdict.com/api/v1`
  - `PLASMO_PUBLIC_WEB_PORTAL_URL=https://app.focus-guard.com`
- [ ] Build production version: `pnpm build`
- [ ] Test extension with remote config
- [ ] Test extension with network disabled (should use fallback)

## Benefits of This Approach

1. **Flexibility**: Update URLs without releasing new extension version
2. **Safety**: Always has fallback to `.env` values if remote fails
3. **Development-Friendly**: Debug mode bypasses remote config entirely
4. **Performance**: Config cached for 1 hour to minimize network requests
5. **Reliability**: Multiple fallback layers ensure extension always works

## Updating Configuration

### During Development
Just edit `.env` file and restart dev server.

### In Production
1. Update remote `config.json` file
2. Changes take effect within 1 hour (cache duration)
3. New extension installs get fresh config immediately
4. Existing installs refresh config on browser restart or cache expiration

## Troubleshooting

### Config not updating in development
- Check `FOCUS_GUARD_DEBUG=1` is set
- Restart dev server after `.env` changes

### Config not loading in production
- Verify remote config.json URL is accessible
- Check browser console for ConfigService logs
- Verify CORS headers allow extension access
- Ensure fallback values in `.env` are correct

### Extension using wrong URLs
- Check `FOCUS_GUARD_DEBUG` value
- Clear cached config: `ConfigService.clearCache()`
- Check browser console for config loading logs
