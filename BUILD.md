# Build Instructions

## Development Build

For local development with localhost support:

```bash
pnpm run build:dev
```

This creates a build in `build/chrome-mv3-dev/` that includes:
- ✅ Localhost portal support (`http://localhost:3000/*`, `http://localhost:*/*`)
- ✅ Debug mode enabled
- ✅ Uses `.env` file for configuration

## Production Build

For production release (no localhost):

```bash
pnpm run build:prod
```

This creates a build in `build/chrome-mv3-prod/` that:
- ❌ Excludes localhost from content script matches
- ✅ Uses production API and portal URLs
- ✅ Debug mode disabled (uses remote config)
- ✅ Optimized for Chrome Web Store submission

## Creating a Release Package

To create a `.zip` file ready for Chrome Web Store:

```bash
pnpm run package:prod
```

This creates `build/chrome-mv3-prod.zip` ready for upload.

## Environment Variables

### Development (`.env`)
```env
PLASMO_PUBLIC_API_URL=https://test.commentverdict.com/api/v1
PLASMO_PUBLIC_WEB_PORTAL_URL=http://localhost:3000
COMMENT_VERDICT_DEBUG=1
```

### Production (`.env.production`)
```env
PLASMO_PUBLIC_API_URL=https://commentverdict.com/api/v1
PLASMO_PUBLIC_WEB_PORTAL_URL=https://app.commentverdict.com
COMMENT_VERDICT_DEBUG=0
```

## Content Script Matches

### Development Build
Content script runs on:
- `https://app.commentverdict.com/*`
- `https://staging.commentverdict.com/*`
- `https://*.commentverdict.com/*`
- `http://localhost:3000/*` ← **Dev only**
- `http://localhost:*/*` ← **Dev only**

### Production Build
Content script runs on:
- `https://app.commentverdict.com/*`
- `https://staging.commentverdict.com/*`
- `https://*.commentverdict.com/*`

## GitHub Actions

The repository includes automated builds via GitHub Actions:

### Automatic Production Builds

Triggered on:
- Push to `main` or `production` branch
- Creating a version tag (e.g., `v1.0.0`)
- Manual workflow dispatch

### Release Process

1. Update version in `package.json`
2. Commit and push changes
3. Create a git tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
4. GitHub Actions will:
   - Build production extension
   - Create release with `.zip` file
   - Upload artifacts

### Manual Trigger

You can also trigger a production build manually from GitHub Actions tab.

## Chrome Web Store Submission

1. Build production package: `pnpm run package:prod`
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload `build/chrome-mv3-prod.zip`
4. Fill in store listing details
5. Submit for review

## Configuration Philosophy

- **Build-time config**: Content script matches, manifest settings (baked into build)
- **Runtime config**: API URLs, feature flags (loaded from remote in production, `.env` in debug mode)

This hybrid approach allows:
- Chrome security requirements met (static manifest)
- Flexibility for API endpoints and features (dynamic config)
- Different builds for different environments
