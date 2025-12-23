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

You need to obtain a refresh token by going through the OAuth flow once. Use this Node.js script:

```javascript
// get-refresh-token.js
const https = require('https');
const { exec } = require('child_process');

const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

// Step 1: Generate authorization URL
const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code&` +
  `scope=https://www.googleapis.com/auth/chromewebstore`;

console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Authorize the application');
console.log('3. Copy the authorization code from the response\n');

// Open browser automatically (works on most systems)
const open = process.platform === 'darwin' ? 'open' :
             process.platform === 'win32' ? 'start' : 'xdg-open';
exec(`${open} "${authUrl}"`);

// Step 2: Exchange code for tokens
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('Enter the authorization code: ', (code) => {
  const postData = `code=${code}&` +
    `client_id=${CLIENT_ID}&` +
    `client_secret=${CLIENT_SECRET}&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `grant_type=authorization_code`;

  const options = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const tokens = JSON.parse(data);
      console.log('\n✅ Success! Your credentials:\n');
      console.log('CHROME_CLIENT_ID:', CLIENT_ID);
      console.log('CHROME_CLIENT_SECRET:', CLIENT_SECRET);
      console.log('CHROME_REFRESH_TOKEN:', tokens.refresh_token);
      console.log('\nAdd these as GitHub Secrets in your repository.\n');
      readline.close();
    });
  });

  req.on('error', (e) => {
    console.error('Error:', e);
    readline.close();
  });

  req.write(postData);
  req.end();
});
```

**Or use this simpler curl method:**

1. Open this URL in your browser (replace `YOUR_CLIENT_ID`):
```
https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/chromewebstore
```

2. Authorize and copy the authorization code

3. Exchange the code for a refresh token:
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=YOUR_AUTH_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" \
  -d "grant_type=authorization_code"
```

4. Save the `refresh_token` from the response

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
