# Production Release Workflow - Quick Reference

## 🎯 What Was Added

### Automated Release Pipeline
A complete GitHub Actions workflow that handles:
- ✅ Automated testing
- ✅ Intelligent version bumping based on commit messages
- ✅ Git tag creation and pushing
- ✅ Production build generation
- ✅ GitHub release creation with downloadable artifacts
- ✅ Optional Chrome Web Store auto-publishing

## 🚀 How to Use

### Option 1: Automatic (Recommended)

**Simply merge to main:**
```bash
git commit -m "feat: add new analytics feature"
git push origin your-branch
# Create PR → Merge to main
# → Workflow runs automatically
# → v1.1.0 released!
```

### Option 2: Manual Trigger

1. Go to **Actions** > **Production Release**
2. Click **Run workflow**
3. Configure:
   - Skip version bump? ☐ No
   - Version type: `auto`
   - Skip Chrome Web Store? ☐ No
4. Click **Run workflow**

## 📋 Version Bumping Rules

| Commit Message | Version Change | Example |
|----------------|----------------|---------|
| `feat!:` or `breaking:` | **Major** | 1.0.0 → 2.0.0 |
| `feat:` or `feature:` | **Minor** | 1.0.0 → 1.1.0 |
| `fix:`, `chore:`, `docs:` | **Patch** | 1.0.0 → 1.0.1 |

## 📦 What Gets Created

After merging to main, you get:

1. **Git Tag**: `v1.2.3` pushed to repository
2. **GitHub Release**: With release notes and changelog
3. **Downloadable ZIP**: `comment-verdict-chrome-extension-v1.2.3.zip`
4. **Chrome Web Store Upload**: Automatic (if configured)

## ⚙️ Chrome Web Store Setup (Optional)

To enable automated Chrome Web Store publishing:

1. **Read the guide**: [.github/CHROME_WEB_STORE_SETUP.md](.github/CHROME_WEB_STORE_SETUP.md)
2. **Add GitHub Secrets**:
   - `CHROME_EXTENSION_ID`
   - `CHROME_CLIENT_ID`
   - `CHROME_CLIENT_SECRET`
   - `CHROME_REFRESH_TOKEN`

**Without setup:** Workflow still works! You just download the .zip and upload manually.

## 🔍 Example Workflow Run

```
1. Test Job
   ✅ Checkout code
   ✅ Install dependencies
   ✅ Run tests (if any)

2. Version Bump Job
   ✅ Analyze commits: "feat: add analytics"
   ✅ Determine bump type: MINOR
   ✅ Update package.json: 1.0.0 → 1.1.0
   ✅ Create tag: v1.1.0
   ✅ Push tag to repository

3. Build & Release Job
   ✅ Checkout at tag v1.1.0
   ✅ Build production bundle
   ✅ Create ZIP file
   ✅ Create GitHub release
   ✅ Upload to Chrome Web Store (if configured)
   ✅ Upload artifacts

Result: v1.1.0 released! 🎉
```

## 🛠️ Files Added

```
.github/
├── workflows/
│   ├── build-production.yml         # Main workflow
│   └── README.md                     # Workflow documentation
├── CHROME_WEB_STORE_SETUP.md        # OAuth setup guide
BUILD_GUIDE.md                        # Updated build guide
package.json                          # Added test script
```

## 📚 Documentation

- **Workflow Guide**: [.github/workflows/README.md](.github/workflows/README.md)
- **Chrome Web Store Setup**: [.github/CHROME_WEB_STORE_SETUP.md](.github/CHROME_WEB_STORE_SETUP.md)
- **Build Guide**: [BUILD_GUIDE.md](BUILD_GUIDE.md)

## ⚡ Quick Tips

1. **Use conventional commits** for automatic version detection
2. **Skip version bump** when needed via manual workflow dispatch
3. **Test locally first**: `pnpm build:prod` before pushing
4. **Monitor workflow runs** in the Actions tab
5. **Manual publishing**: Download .zip from Releases if auto-publish fails

## 🎓 Next Steps

1. ✅ Review the workflow file: `.github/workflows/build-production.yml`
2. ✅ Try a test release: Merge a commit with `feat:` prefix
3. ⚙️ Set up Chrome Web Store auto-publishing (optional)
4. 🧪 Add tests to the test suite (optional)

## 🆘 Need Help?

- **Workflow fails?** Check [.github/workflows/README.md#troubleshooting](.github/workflows/README.md)
- **Chrome setup?** See [.github/CHROME_WEB_STORE_SETUP.md](.github/CHROME_WEB_STORE_SETUP.md)
- **Build issues?** Refer to [BUILD_GUIDE.md](BUILD_GUIDE.md)
