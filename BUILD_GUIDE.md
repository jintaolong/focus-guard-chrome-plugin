# Build Guide

## Environment-Specific Builds

The extension has separate portal sync configurations for development and production to prevent token sync conflicts.

### Development Build
**For testing with localhost and test backend**

```bash
pnpm build
# or explicitly:
pnpm build:dev
```

**Portal sync URLs:**
- `https://test.commentverdict.com/*`
- `http://localhost:3000/*`
- `http://localhost:*/*`

**API endpoint:** `https://test.commentverdict.com/api/v1`

### Production Build
**For deployment to Chrome Web Store**

```bash
pnpm build:prod
```

**Portal sync URLs:**
- `https://app.commentverdict.com/*`
- `https://staging.commentverdict.com/*`

**API endpoint:** `https://api.commentverdict.com/api/v1`

### Package for Distribution

```bash
pnpm package:prod
```

This creates a production build and generates a ZIP file in `build/chrome-mv3-prod.zip` ready for Chrome Web Store upload.

## Important Notes

1. **Never use development build in production** - It will sync tokens with localhost and test backend, causing auth conflicts
2. **The `build:prod` command automatically swaps back to dev** after building to prevent accidental commits of production config
3. **Default `pnpm build` uses development config** for safety during development

## Verifying Your Build

After building, check the manifest to verify the correct URLs:

**Development:**
```powershell
(Get-Content "build\chrome-mv3-dev\manifest.json" | ConvertFrom-Json).content_scripts[0].matches
```

**Production:**
```powershell
(Get-Content "build\chrome-mv3-prod\manifest.json" | ConvertFrom-Json).content_scripts[0].matches
```
