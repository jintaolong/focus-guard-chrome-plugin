# Tier-Based Access Control Implementation

**Date:** 2025-12-14  
**Status:** ✅ Implemented

## Overview

Frontend implementation of tier-based access control that dynamically responds to backend tier restriction responses.

## Backend API Contract

When a user lacks access to a feature, the backend returns **HTTP 403** with:

```json
{
  "code": "TIER_RESTRICTION",
  "required_tier": "pro",
  "current_tier": "free",
  "message": "This feature requires a Pro subscription",
  "upgrade_url": "/api/v1/subscriptions/change-tier/pro"
}
```

## Tier → Feature Mapping

| Tier | Accessible Endpoints | Features |
|------|---------------------|----------|
| **Free** | `/summary/v2`, `/relevancy/v2`, `/channel-credibility/v2` | Summary Tab, Viewer Insights |
| **Starter** | Free + `/sentiment/v2` | + Comment Sentiment Tab |
| **Pro** | Starter + `/topic-clustering/v2`, `/topic-gap/v2`, `/human-likeness/v2` | + Content Gaps Tab (full) |

## Implementation Files

### 1. Types (`types/tierRestriction.ts`)
- `TierRestriction` interface matching backend response
- `isTierRestriction()` type guard

### 2. API Error Handling (`lib/apiUtils.ts`)
- `APIError` extended with `isTierRestriction` and `tierRestriction` fields
- `parseAPIError()` detects `code: "TIER_RESTRICTION"` from backend
- Properly propagates tier restriction info through error chain

### 3. Analysis Types (`types/analysis.ts`)
- Added optional `tierRestriction` field to:
  - `viewerInsights`
  - `sentiment`
  - `contentGaps`

### 4. UI Components (`components/UpgradePrompt.tsx`)
- `<UpgradePrompt />` - Standalone upgrade prompt with tier badge
- `<BlurredContent />` - Wrapper that blurs children and overlays upgrade prompt
- Handles upgrade flow via `restriction.upgrade_url`

### 5. Tab Components
Updated all restricted tabs to detect and display tier restrictions:

- **`CommentSentimentTab.tsx`** (Starter+)
  - Checks `sentiment?.tierRestriction`
  - Shows upgrade prompt if blocked
  
- **`ViewerInsightsTab.tsx`** (Free)
  - Checks `viewerInsights?.tierRestriction`
  - Shows upgrade prompt if blocked
  
- **`ContentGapsTab.tsx`** (Pro)
  - Checks `contentGaps?.tierRestriction`
  - Shows upgrade prompt if blocked

## User Experience Flow

1. **User opens restricted tab** → Tab component checks for `tierRestriction`
2. **If restricted** → Shows upgrade prompt with:
   - 🔒 Lock icon
   - Tier badge (Starter/Pro)
   - Custom message from backend
   - Current tier vs Required tier comparison
   - "Upgrade to [Tier]" button
3. **User clicks upgrade** → Calls backend `upgrade_url` endpoint
4. **After upgrade** → Page reloads, content becomes accessible

## Example Usage

### Backend Returns Tier Restriction

```typescript
// Backend response for /api/v1/videos/sentiment/v2
{
  "detail": {
    "code": "TIER_RESTRICTION",
    "required_tier": "starter",
    "current_tier": "free",
    "message": "Comment sentiment analysis requires a Starter subscription",
    "upgrade_url": "/api/v1/subscriptions/change-tier/starter"
  }
}
```

### Frontend Handles It

```typescript
// In CommentSentimentTab.tsx
const sentiment = analysis?.sentiment

if (sentiment?.tierRestriction) {
  return (
    <div style={{ padding: "24px" }}>
      <UpgradePrompt restriction={sentiment.tierRestriction} />
    </div>
  )
}
```

## Testing

### Manual Testing Steps

1. **Test Free Tier User:**
   - Summary Tab: ✅ Should work
   - Comment Sentiment Tab: ❌ Should show Starter upgrade prompt
   - Content Gaps Tab: ❌ Should show Pro upgrade prompt

2. **Test Starter Tier User:**
   - Summary Tab: ✅ Should work
   - Comment Sentiment Tab: ✅ Should work
   - Content Gaps Tab: ❌ Should show Pro upgrade prompt

3. **Test Pro Tier User:**
   - All tabs: ✅ Should work

### Backend Testing

Use backend tier change endpoint to simulate different tiers:

```bash
# Switch to Free
POST /api/v1/subscriptions/change-tier/free

# Switch to Starter
POST /api/v1/subscriptions/change-tier/starter

# Switch to Pro
POST /api/v1/subscriptions/change-tier/pro
```

## Notes

- ✅ **Cached results bypass tier checks** - Users can view previously cached analyses
- ✅ **Quota only checked on fresh analysis** - No quota deduction for cache hits
- ✅ **Backend has sole control** - Frontend just displays what backend decides
- ✅ **Graceful degradation** - If tier restriction not present, tabs work normally
- ✅ **Consistent UI** - Same upgrade prompt design across all tabs

## Future Enhancements

- [ ] Add "Learn More" link to pricing page
- [ ] Show preview/teaser of locked content with blur effect
- [ ] Track upgrade button clicks for analytics
- [ ] Add tier badge to tab labels in side panel
