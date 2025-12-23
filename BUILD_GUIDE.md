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

## Automated Production Releases

The repository includes a GitHub Actions workflow for automated production releases.

### Automatic Release (Recommended)

**Trigger:** Merge to `main` branch

The workflow automatically:
1. ✅ Runs tests
2. ✅ Analyzes commit messages to determine version bump (major/minor/patch)
3. ✅ Updates version in package.json
4. ✅ Creates and pushes a git tag
5. ✅ Builds production bundle
6. ✅ Creates GitHub release with downloadable .zip
7. ✅ Uploads to Chrome Web Store (if configured)

**Commit message convention:**
- `feat!:` or `breaking:` → Major version bump (1.0.0 → 2.0.0)
- `feat:` → Minor version bump (1.0.0 → 1.1.0)
- `fix:`, `chore:` → Patch version bump (1.0.0 → 1.0.1)

Example:
```bash
git commit -m "feat: add content gaps analysis"
git push origin main
# Automatically creates v1.1.0 release
```

### Manual Release

**Trigger:** GitHub Actions > Production Release > Run workflow

Options:
- **Skip version bump**: Use current version without bumping
- **Version type**: Choose auto/patch/minor/major
- **Skip publish**: Don't upload to Chrome Web Store

**Use cases:**
- Hotfix releases without waiting for merge
- Custom version control
- Testing the release process

### Chrome Web Store Auto-Publishing

To enable automated Chrome Web Store publishing, see [.github/CHROME_WEB_STORE_SETUP.md](.github/CHROME_WEB_STORE_SETUP.md)

Required GitHub Secrets:
- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

**If not configured:** The workflow still creates the release with a downloadable .zip that you can manually upload to Chrome Web Store.

## Important Notes

1. **Never use development build in production** - It will sync tokens with localhost and test backend, causing auth conflicts
2. **The `build:prod` command automatically swaps back to dev** after building to prevent accidental commits of production config
3. **Default `pnpm build` uses development config** for safety during development
4. **Version bumps are automatic** based on commit messages when using the CI/CD pipeline
5. **Releases are immutable** - Once a version tag is pushed, it cannot be changed (create a new version instead)

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
