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

### Option 1: Automatic Release (Recommended)

**Simply merge to main:**
```bash
git commit -m "feat: add new analytics feature"
git push origin your-branch
# Create PR → Merge to main
# → Production Release workflow runs
# → v1.1.0 released on GitHub!
```

**Then publish to Chrome Web Store:**
1. Go to **Actions** → **Publish to Chrome Web Store**
2. Click **Run workflow**
3. Enter version: `1.1.0`
4. Click **Run workflow**
5. ✅ Published!

### Option 2: Manual Trigger

**Build and Release:**
1. Go to **Actions** > **Production Release**
2. Click **Run workflow**
3. Configure:
   - Skip version bump? ☐ No
   - Version type: `auto`
4. Click **Run workflow**

**Then Publish (when ready):**
1. Go to **Actions** > **Publish to Chrome Web Store**
2. Click **Run workflow**
3. Enter the version number
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

**Then manually publish when ready:**
- Use the "Publish to Chrome Web Store" workflow
- Or download ZIP and upload manually
the "Publish to Chrome Web Store" workflow:

1. **Read the guide**: [.github/CHROME_WEB_STORE_SETUP.md](.github/CHROME_WEB_STORE_SETUP.md)
2. **Add GitHub Secrets**:
   - `CHROME_EXTENSION_ID`
   - `CHROME_CLIENT_ID`
   - `CHROME_CLIENT_SECRET`
   - `CHROME_REFRESH_TOKEN`

**Without setup:** You can still download the .zip from GitHub releases
   - `CHROME_REFRESH_TOKEN`

**Without setup:** Workflow still works! You just download the .zip and upload manually.

## 🔍 Example Workflow Run

```
1. Production Release Workflow
   ├─ Test Job
   │  ✅ Run tests (if any)
   ├─ Version Bump Job
   │  ✅ Analyze commits: "feat: add analytics"
   │  ✅ Determine bump type: MINOR
   │  ✅ Update package.json: 1.0.0 → 1.1.0
   │  ✅ Create tag: v1.1.0
   │  └─ Push tag to repository
   └─ Build & Release Job
      ✅ Build production bundle
      ✅ Create ZIP file
      ✅ Create GitHub release
      └─ Upload artifacts

   Result: v1.1.0 ready on GitHub! 🎉

2. Publish to Chrome Web Store Workflow (Manual)
   ├─ Download ZIP from GitHub release
   ├─ Verify extension package
   └─ Publish to Chrome Web Store
   
   Result: v1.1.0 published to CWS! 🚀
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
