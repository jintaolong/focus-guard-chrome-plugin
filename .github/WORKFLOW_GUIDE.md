# CI/CD Workflow Documentation

## Overview

The CI/CD pipeline is split into distinct, controlled stages to ensure quality and give you manual control over releases.

## Workflow Stages

### 1. **Automated Testing** (on every push to main)
**Trigger:** Automatic on push to `main` or PR to `main`  
**File:** `.github/workflows/test.yml`  
**Purpose:** Quality assurance - ensures all tests pass before merging

```
Push to main → Run tests → ✅ Pass / ❌ Fail
```

### 2. **Version Bump** (manual trigger)
**Trigger:** Manual via GitHub Actions UI  
**File:** `.github/workflows/version-bump.yml`  
**Purpose:** Semantic versioning - manually decide when to cut a new release

**Steps:**
1. Go to Actions → "Version Bump"
2. Click "Run workflow"
3. Select version bump type:
   - `patch` - Bug fixes (1.2.3 → 1.2.4)
   - `minor` - New features (1.2.3 → 1.3.0)
   - `major` - Breaking changes (1.2.3 → 2.0.0)
4. Click "Run workflow"

**What it does:**
- Updates `package.json` version
- Commits the version bump to `main`
- Creates and pushes a git tag (e.g., `v1.2.3`)
- **Automatically triggers** the Build & Release workflow

```
Manual trigger → Bump version → Commit → Tag → Push → Triggers Build
```

### 3. **Build & Release** (automatic on new tag)
**Trigger:** Automatic when version-bump creates a tag, or manual  
**File:** `.github/workflows/build-release.yml`  
**Purpose:** Build production extension and create GitHub release

**What it does:**
- Checks out the tagged version
- Runs tests again (safety check)
- Builds production extension
- Creates ZIP file
- Uploads artifacts to GitHub
- Creates GitHub Release with the ZIP

**Automatic trigger:**
```
New tag pushed → Build → Test → Create ZIP → GitHub Release
```

**Manual trigger** (if needed):
```
Actions → "Build and Release" → Enter tag (e.g., v1.2.3) → Run
```

### 4. **Publish to Chrome Web Store** (manual)
**Trigger:** Manual via GitHub Actions UI  
**File:** `.github/workflows/publish-chrome-store.yml`  
**Purpose:** Final safety gate - manually publish to Chrome Web Store

**Steps:**
1. Wait for Build & Release to complete
2. Go to Actions → "Publish to Chrome Web Store"
3. Click "Run workflow"
4. Enter the version (e.g., `1.2.3`)
5. Select download source (usually `release`)
6. Click "Run workflow"

**What it does:**
- Downloads the ZIP from GitHub Release
- Uploads to Chrome Web Store
- Publishes the extension (or submits for review)

```
Manual trigger → Download ZIP → Upload to CWS → Publish
```

## Complete Release Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Developer Flow                                                   │
└─────────────────────────────────────────────────────────────────┘

1. Develop features on feature branches
2. Create PR to main → Tests run automatically
3. Merge PR → Tests run on main

┌─────────────────────────────────────────────────────────────────┐
│ Release Flow (Manual Control)                                    │
└─────────────────────────────────────────────────────────────────┘

4. [MANUAL] Run "Version Bump" workflow
   └─> Bump version → Commit → Tag → Push

5. [AUTOMATIC] "Build & Release" triggers
   └─> Build → Test → Create ZIP → GitHub Release

6. [MANUAL] Run "Publish to Chrome Web Store" workflow
   └─> Download ZIP → Upload → Publish

┌─────────────────────────────────────────────────────────────────┐
│ Result                                                           │
└─────────────────────────────────────────────────────────────────┘

✅ New version live on Chrome Web Store
```

## Key Benefits

### ✅ Quality Control
- Every merge to main runs tests
- Build process runs tests again before release
- No releases without passing tests

### ✅ Manual Control
- You decide when to bump version (semantic versioning)
- You decide when to publish to Chrome Store
- Clear separation between building and publishing

### ✅ Safety Gates
- Version bump requires manual decision
- Chrome Store publish requires manual confirmation
- Each step has clear outputs and instructions

### ✅ Flexibility
- Can re-run builds for any tag if needed
- Can build without publishing
- Can test builds before Chrome Store submission

## Typical Release Workflow

**1. Development Phase**
```bash
# Work on feature branch
git checkout -b feature/new-feature
# ... make changes ...
git push origin feature/new-feature
# Create PR → Tests run
```

**2. Merge Phase**
```
# Review PR
# Merge to main → Tests run automatically
```

**3. Release Phase** (When ready to release)
```
Actions → "Version Bump" → Select type → Run
  ↓ (automatic)
GitHub Release created with ZIP file
```

**4. Publishing Phase** (When ready to publish)
```
Actions → "Publish to Chrome Web Store" → Enter version → Run
  ↓
Extension live on Chrome Web Store
```

## Emergency Procedures

### Rollback a Release
1. Identify the previous good version (e.g., `v1.2.2`)
2. Go to Actions → "Build and Release"
3. Enter the previous tag (e.g., `v1.2.2`)
4. Run workflow
5. Publish that version to Chrome Store

### Rebuild Without Version Bump
1. Go to Actions → "Build and Release"
2. Enter existing tag (e.g., `v1.2.3`)
3. Run workflow
4. New build artifacts created for same version

### Skip Publishing
- Simply don't run the "Publish to Chrome Web Store" workflow
- The GitHub Release and artifacts remain available
- Can test/review before publishing

## Workflow Files

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| Tests | `test.yml` | Push to main, PRs | Quality assurance |
| Version Bump | `version-bump.yml` | Manual | Semantic versioning |
| Build & Release | `build-release.yml` | New tag or manual | Build and package |
| Chrome Store Publish | `publish-chrome-store.yml` | Manual | Final publication |

## Required Secrets

Ensure these secrets are configured in repository settings:

- `PROD_API_URL` - Production API URL
- `PROD_WEB_PORTAL_URL` - Production portal URL
- `CHROME_EXTENSION_ID` - Chrome Web Store extension ID
- `CHROME_CLIENT_ID` - Chrome Web Store OAuth client ID
- `CHROME_CLIENT_SECRET` - Chrome Web Store OAuth client secret
- `CHROME_REFRESH_TOKEN` - Chrome Web Store refresh token

See `.github/CHROME_WEB_STORE_SETUP.md` for setup instructions.
