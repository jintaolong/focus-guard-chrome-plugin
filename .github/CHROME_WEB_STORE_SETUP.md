# Chrome Web Store Publishing Setup

This guide explains how to configure automated Chrome Web Store publishing for the production release workflow.

## Prerequisites

1. A [Chrome Web Store Developer Account](https://chrome.google.com/webstore/devconsole) ($5 one-time fee)
2. Your extension already published on Chrome Web Store (or a draft created)
3. Repository admin access to configure GitHub Secrets

## Step 1: Get Chrome Web Store Credentials

### 1.1 Get Extension ID
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Find your extension and click on it
3. The URL will contain your extension ID: `chrome.google.com/webstore/devconsole/.../EXTENSION_ID_HERE`
4. Copy this ID

### 1.2 Create OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Chrome Web Store API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Chrome Web Store API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Desktop app" or "Web application"
   - Name it "Chrome Extension Publishing"
   - Click "Create"
   - **Save the Client ID and Client Secret**

5. Configure OAuth consent screen if prompted:
   - User Type: Internal (if using Google Workspace) or External
   - Add scopes: `https://www.googleapis.com/auth/chromewebstore`

### 1.3 Get Refresh Token

You need to obtain a refresh token by authorizing the OAuth client once. Below are two recommended methods: the local-redirect (recommended) and the OAuth 2.0 Playground.

Local redirect (recommended)

1. In Google Cloud Console → APIs & Services → Credentials → Edit your OAuth client and add an Authorized Redirect URI, e.g.:

   `http://localhost:8080/oauth2callback`

2. Build this authorization URL (exactly matching the redirect URI):

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8080/oauth2callback&response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&prompt=consent
```

3. Open the URL in your browser and sign in using the Google account that owns (or is a developer on) your Chrome extension. After approval Google will redirect to the local URL, for example:

```
http://localhost:8080/oauth2callback?code=AUTH_CODE
```

4. Capture `AUTH_CODE` (copy from the browser address bar or run a tiny local HTTP listener to print the query string). Then exchange the code for tokens (make sure `redirect_uri` matches exactly):

```bash
curl -s -X POST https://oauth2.googleapis.com/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=AUTH_CODE \
  -d redirect_uri=http://localhost:8080/oauth2callback \
  -d grant_type=authorization_code | jq .
```

5. Save the `refresh_token` from the JSON response and add it to GitHub Secrets as `CHROME_REFRESH_TOKEN`.

OAuth 2.0 Playground (no local server)

1. Open the OAuth 2.0 Playground: https://developers.google.com/oauthplayground
2. Click settings (gear) in the top-right and enable “Use your own OAuth credentials” — paste your `CLIENT ID` and `CLIENT SECRET`.
3. In Step 1, check the scope: `https://www.googleapis.com/auth/chromewebstore` then click “Authorize APIs”.
4. Sign in with the extension-owner account, then click “Exchange authorization code for tokens”. Copy the `refresh_token` from the response.

Notes and troubleshooting

- Use `access_type=offline&prompt=consent` to ensure a `refresh_token` is returned.
- If you see: "Access blocked: ... not completed the Google verification process" → add the publishing account as an OAuth test user or publish the consent screen.
- If you see `redirect_uri_mismatch` → make sure the `redirect_uri` in the authorization URL exactly matches one of the authorized redirect URIs on the OAuth client.
- Always use the Google account that is an owner/developer of the Chrome Web Store extension when generating the refresh token; otherwise CWS API calls will return 403.

Token expiry and rotation

- Refresh tokens may be revoked or expire. If the refresh token becomes invalid, the publish workflow will fail with a clear message pointing you to this document to re-run the steps above.
- We recommend rotating the publishing refresh token periodically (e.g. every 90 days) and storing the new token in `CHROME_REFRESH_TOKEN`.

Where to look when the pipeline fails

- If the publish workflow fails due to token issues it will include a link to this document (`.github/CHROME_WEB_STORE_SETUP.md`) in the logs and/or create a reminder issue (see the scheduled monitor workflow). Follow the "Local redirect" or "OAuth Playground" steps above to regenerate the refresh token.

## Step 2: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `CHROME_EXTENSION_ID` | Extension ID from Step 1.1 | Your Chrome Web Store extension ID |
| `CHROME_CLIENT_ID` | OAuth Client ID from Step 1.2 | Google OAuth Client ID |
| `CHROME_CLIENT_SECRET` | OAuth Client Secret from Step 1.2 | Google OAuth Client Secret |
| `CHROME_REFRESH_TOKEN` | Refresh token from Step 1.3 | OAuth refresh token |

## Step 3: Test the Workflow

### Automatic Release (on merge to main)
```bash
git checkout main
git merge your-feature-branch
git push origin main
```

The workflow will:
1. ✅ Run tests
2. ✅ Bump version based on commit messages
3. ✅ Create a git tag
4. ✅ Build production bundle
5. ✅ Create GitHub release with .zip
6. ✅ Upload to Chrome Web Store (if configured)

### Manual Release (workflow dispatch)
1. Go to Actions > Production Release
2. Click "Run workflow"
3. Configure options:
   - **Skip version bump**: Keep current version
   - **Version type**: Choose auto/patch/minor/major
   - **Skip publish**: Don't upload to Chrome Web Store
4. Click "Run workflow"

## Commit Message Convention for Version Bumping

The workflow uses conventional commits to determine version bumps:

| Commit Pattern | Version Bump | Example |
|----------------|--------------|---------|
| `feat!:` or `breaking:` | **Major** (1.0.0 → 2.0.0) | `feat!: redesign authentication system` |
| `feat:` or `feature:` | **Minor** (1.0.0 → 1.1.0) | `feat: add dark mode support` |
| `fix:`, `chore:`, etc. | **Patch** (1.0.0 → 1.0.1) | `fix: resolve login bug` |

### Examples:
```bash
# Patch version bump (1.0.0 → 1.0.1)
git commit -m "fix: resolve token refresh issue"

# Minor version bump (1.0.0 → 1.1.0)
git commit -m "feat: add content gaps analysis"

# Major version bump (1.0.0 → 2.0.0)
git commit -m "feat!: complete UI overhaul with breaking changes"
```

## Troubleshooting

### Error: "Invalid credentials"
- Verify all four secrets are correctly set in GitHub
- Re-generate the refresh token using Step 1.3
- Make sure the Chrome Web Store API is enabled in Google Cloud Console

### Error: "Extension not found"
- Verify the extension ID is correct
- Make sure the extension is published (at least as a draft) in Chrome Web Store
- Check that the OAuth client has access to the Chrome Web Store API

### Publishing fails but release succeeds
- The GitHub release will still be created
- Download the .zip from the release
- Manually upload to Chrome Web Store Developer Dashboard

### Want to skip auto-publishing temporarily?
Use workflow dispatch with "Skip publish" option enabled:
1. Go to Actions > Production Release
2. Click "Run workflow"
3. Check "Skip Chrome Web Store publishing"
4. Download the artifact manually

## Manual Publishing Process

If you prefer to always publish manually:

1. Wait for the workflow to complete
2. Go to the [Releases page](../../releases)
3. Download `comment-verdict-chrome-extension-vX.X.X.zip`
4. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
5. Click on your extension
6. Click "Upload new package"
7. Upload the ZIP file
8. Submit for review

## Security Best Practices

1. **Never commit credentials** to the repository
2. **Use GitHub Secrets** for all sensitive values
3. **Rotate tokens periodically** (every 90 days recommended)
4. **Limit access** to the Google Cloud project
5. **Enable 2FA** on your Chrome Web Store Developer account
6. **Use branch protection** on main branch to require reviews

## Resources

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/api/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
