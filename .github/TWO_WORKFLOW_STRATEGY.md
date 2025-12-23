# Two-Workflow Publishing Strategy

## 📋 Overview

The extension now uses a **two-step workflow approach** for better control over Chrome Web Store publishing:

1. **Production Release** - Builds and creates GitHub release (automatic)
2. **Publish to Chrome Web Store** - Publishes to CWS (manual, when ready)

## 🔄 Workflow Diagram

```
┌─────────────────────────────────────────────────┐
│         Merge to Main Branch                    │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  🏗️  Production Release Workflow (Automatic)    │
│                                                  │
│  1. Run Tests                                   │
│  2. Bump Version (analyze commits)              │
│  3. Create Git Tag                              │
│  4. Build Production Bundle                     │
│  5. Create GitHub Release                       │
│  6. Upload ZIP Artifact                         │
│                                                  │
│  Output: ✅ v1.2.3 on GitHub                    │
└─────────────────┬───────────────────────────────┘
                  │
                  │ (Manual decision point)
                  │ "Ready to publish to CWS?"
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  🚀  Publish to CWS Workflow (Manual)           │
│                                                  │
│  Trigger: GitHub Actions → Run workflow         │
│  Input: Version number (e.g., 1.2.3)            │
│                                                  │
│  1. Download ZIP from GitHub Release            │
│  2. Verify Package Integrity                    │
│  3. Upload to Chrome Web Store                  │
│                                                  │
│  Output: ✅ v1.2.3 published to CWS             │
└─────────────────────────────────────────────────┘
```

## 🎯 Why Two Workflows?

### Before (Single Workflow)
❌ Auto-publish on every release (risky)
❌ Hard to skip publishing for draft releases
❌ Difficult to re-publish if failed
❌ Publishing errors block the entire workflow

### After (Two Workflows)
✅ **Control**: Publish only when ready
✅ **Flexibility**: Can re-publish any version
✅ **Safety**: Test releases before publishing
✅ **Independence**: Build failures don't affect publishing

## 📖 Usage Examples

### Example 1: Standard Release

```bash
# 1. Develop and merge
git commit -m "feat: add dark mode"
git push origin feature-branch
# → Merge PR to main

# 2. Production Release runs automatically
# → Creates v1.2.0 on GitHub ✅

# 3. Test the release locally
# Download ZIP and test in Chrome

# 4. Publish to Chrome Web Store (when ready)
# Actions → Publish to Chrome Web Store
# → Enter version: 1.2.0
# → Run workflow
# → Published! ✅
```

### Example 2: Hotfix Release

```bash
# 1. Quick fix
git commit -m "fix: critical security patch"
git push

# 2. Production Release creates v1.2.1 ✅

# 3. Immediately publish (urgent)
# Actions → Publish to Chrome Web Store
# → Version: 1.2.1
# → Published in minutes! ✅
```

### Example 3: Staged Rollout

```bash
# 1. Create release v2.0.0 ✅
# 2. Don't publish to CWS yet
# 3. Share GitHub release with beta testers
# 4. Gather feedback for 24-48 hours
# 5. When ready, publish to CWS ✅
```

### Example 4: Re-publish After Failure

```bash
# First publish attempt fails (network issue)
# ❌ Publishing failed

# Fix credentials or wait, then retry:
# Actions → Publish to Chrome Web Store
# → Same version: 1.2.0
# → Run workflow again
# → Published! ✅
```

## 🔧 Workflow Configurations

### Production Release Workflow

**File:** `.github/workflows/build-production.yml`

**Triggers:**
- Push to `main` (automatic)
- Manual dispatch (via Actions UI)

**Manual Options:**
```yaml
- Skip version bump: [true/false]
- Version type: [auto/patch/minor/major]
```

**Outputs:**
- Git tag: `vX.Y.Z`
- GitHub Release with ZIP
- Build artifacts (90 days)

---

### Publish to Chrome Web Store Workflow

**File:** `.github/workflows/publish-chrome-store.yml`

**Triggers:**
- Manual dispatch ONLY

**Required Inputs:**
```yaml
- Version: "1.2.3" (required)
- Download from: [release/artifact]
```

**Prerequisites:**
- Version must exist on GitHub
- Chrome Web Store credentials configured

**Steps:**
1. Validate version format
2. Check CWS credentials
3. Download ZIP (from release or artifact)
4. Verify package integrity
5. Publish to Chrome Web Store

## 📊 Decision Matrix

| Scenario | Use Production Release | Use Publish to CWS |
|----------|----------------------|-------------------|
| New feature ready | ✅ Yes (automatic) | ⏸️ Wait for testing |
| Hotfix needed | ✅ Yes (automatic) | ✅ Yes (immediately) |
| Beta release | ✅ Yes (automatic) | ❌ No (share GitHub link) |
| Publishing failed | ❌ No (already exists) | ✅ Yes (retry) |
| Version exists | ❌ No (duplicate tag) | ✅ Yes (publish it) |

## 🛡️ Safety Features

### Production Release
- ✅ Tests must pass before building
- ✅ Automatic version detection from commits
- ✅ Tag conflicts prevent duplicate versions
- ✅ Build artifacts preserved for 90 days

### Publish to CWS
- ✅ Version format validation (X.Y.Z)
- ✅ Credentials verification before attempting
- ✅ ZIP integrity checks (size, manifest.json)
- ✅ Detailed error messages for troubleshooting
- ✅ Manual trigger only (no accidents)

## 📝 Quick Reference

### Create a Release
```bash
# Automatic on merge:
git merge feature-branch
git push origin main
# ✅ Done! v1.2.3 on GitHub

# Manual trigger:
# Actions → Production Release → Run workflow
```

### Publish to Chrome Web Store
```bash
# Always manual:
# 1. Actions → Publish to Chrome Web Store
# 2. Enter version: 1.2.3
# 3. Choose: release (recommended)
# 4. Run workflow
# ✅ Published!
```

### Re-publish a Version
```bash
# If publishing failed:
# Actions → Publish to Chrome Web Store
# → Same version number
# → Run workflow again
```

## 🔍 Monitoring

### Check Production Release
- **Location**: Actions → Production Release
- **Status**: Green = Released on GitHub
- **Output**: GitHub release with ZIP

### Check CWS Publishing
- **Location**: Actions → Publish to Chrome Web Store
- **Status**: Green = Published to CWS
- **Verify**: Chrome Web Store Developer Dashboard

## 🆘 Troubleshooting

### Production Release Fails
- **Check**: Test failures or build errors
- **Fix**: Fix code and push again
- **Retry**: Automatic on next push to main

### Publish to CWS Fails
- **Check**: Workflow logs for error details
- **Common Issues**:
  - Invalid credentials
  - Version doesn't exist on GitHub
  - ZIP file corrupted
  - Network timeout
- **Fix**: Address issue and re-run workflow
- **Fallback**: Download ZIP, upload manually

## 🎓 Best Practices

1. **Always test before publishing**
   - Download ZIP from GitHub release
   - Install locally in Chrome
   - Verify functionality

2. **Use staging for major updates**
   - Create release on GitHub first
   - Share with beta testers
   - Publish to CWS after validation

3. **Monitor CWS dashboard**
   - After publishing, check dashboard
   - Verify upload succeeded
   - Submit for review if needed

4. **Keep credentials fresh**
   - Rotate OAuth tokens every 90 days
   - Test publishing regularly
   - Document credential renewal process

5. **Document release notes**
   - Use conventional commits
   - GitHub auto-generates notes
   - Review before publishing to CWS
