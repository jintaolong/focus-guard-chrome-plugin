# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the Comment Verdict Chrome Extension.

## Available Workflows

### 1. Production Release (`build-production.yml`)

**Purpose:** Automated production builds and releases

**Triggers:**
- Push to `main` branch (automatic)
- Manual dispatch via GitHub Actions UI

**What it does:**
1. **Test** - Runs test suite (if configured)
2. **Version Bump** - Automatically determines version based on commit messages:
   - `feat!:` or `breaking:` → Major (1.0.0 → 2.0.0)
   - `feat:` → Minor (1.0.0 → 1.1.0)
   - `fix:`, `chore:` → Patch (1.0.0 → 1.0.1)
3. **Tag** - Creates and pushes git tag (e.g., `v1.2.3`)
4. **Build** - Compiles production extension bundle
5. **Release** - Creates GitHub release with downloadable .zip
6. **Publish** - Uploads to Chrome Web Store (if configured)

**Manual Options:**
- Skip version bump (use current version)
- Override version type (patch/minor/major)
- Skip Chrome Web Store publishing

**Artifacts:**
- GitHub Release with `comment-verdict-chrome-extension-vX.X.X.zip`
- Build artifacts retained for 90 days

## Quick Start

### Automatic Release Flow

```bash
# Make your changes
git add .
git commit -m "feat: add new feature"
git push origin your-branch

# Create PR and merge to main
# → Workflow automatically triggers
# → Version bump, build, and release created
```

### Manual Release Flow

1. Go to **Actions** tab in GitHub
2. Select **Production Release** workflow
3. Click **Run workflow**
4. Configure options:
   - Branch: `main`
   - Skip version bump: ☐
   - Version type: `auto`
   - Skip publish: ☐
5. Click **Run workflow**

## Setup Instructions

### Basic Setup (GitHub Releases only)

No additional setup required! The workflow will:
- Create releases on GitHub
- Generate downloadable .zip files
- You manually upload to Chrome Web Store

### Advanced Setup (Automated Chrome Web Store Publishing)

See [CHROME_WEB_STORE_SETUP.md](./CHROME_WEB_STORE_SETUP.md) for detailed instructions.

**Required secrets:**
- `CHROME_EXTENSION_ID` - Your Chrome extension ID
- `CHROME_CLIENT_ID` - Google OAuth client ID
- `CHROME_CLIENT_SECRET` - Google OAuth client secret
- `CHROME_REFRESH_TOKEN` - Google OAuth refresh token

## Workflow Status

Check workflow runs:
1. Go to **Actions** tab
2. See all workflow runs with status
3. Click on a run to see detailed logs

## Troubleshooting

### Workflow fails on version bump
- **Cause:** Git push failed
- **Fix:** Ensure `GITHUB_TOKEN` has write permissions

### Build succeeds but release fails
- **Cause:** Tag already exists
- **Fix:** Delete tag and re-run: `git tag -d vX.X.X && git push origin :refs/tags/vX.X.X`

### Chrome Web Store upload fails
- **Cause:** Missing or invalid credentials
- **Fix:** Verify all four secrets are correctly set
- **Workaround:** Download .zip from GitHub release and upload manually

### "No tests found" message
- **Status:** This is normal if no test suite is configured
- **Action:** Tests are optional; workflow continues anyway

## Adding Tests

To enable test running:

1. Install test framework (example: Jest)
```bash
pnpm add -D jest @types/jest
```

2. Add test script to `package.json`:
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

3. Create test files:
```javascript
// lib/__tests__/auth.test.ts
describe('AuthService', () => {
  it('should authenticate user', () => {
    // Test code
  });
});
```

The workflow will automatically run tests before building.

## Best Practices

1. **Use conventional commits** for automatic version bumping
2. **Squash merge PRs** to keep clean commit history
3. **Test locally** before pushing to main
4. **Review releases** before manually uploading to Chrome Web Store
5. **Monitor workflow runs** for any failures

## Commit Message Examples

```bash
# Patch version (1.0.0 → 1.0.1)
git commit -m "fix: resolve token refresh issue"
git commit -m "chore: update dependencies"

# Minor version (1.0.0 → 1.1.0)
git commit -m "feat: add content gaps analysis"
git commit -m "feature: implement dark mode"

# Major version (1.0.0 → 2.0.0)
git commit -m "feat!: redesign authentication system"
git commit -m "breaking: remove deprecated API endpoints"
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/api/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
