# Job Result API Specification

## Problem Statement

After a summary generation job completes (status: `completed`), the frontend currently:
1. Fetches `/jobs/{job_id}/result` (~0.1s)
2. Then fetches 6 additional endpoints in parallel (~17.8s total):
   - `/videos/summary/v2`
   - `/videos/relevancy/v2`
   - `/videos/sentiment/v2`
   - `/videos/channel-credibility/v2`
   - `/videos/topic-clustering/v2`
   - `/videos/topic-gap/v2`

**Total delay:** ~18 seconds after job shows "100% complete"

## Solution

Store all required analysis data in the job result's `result_data` field so the frontend can display results immediately without additional API calls.

---

## `/api/v1/jobs/{job_id}/result` Response Structure

### Current Response
```typescript
{
  job_id: string
  job_type: "summary"
  status: "completed"
  result_data: any  // Currently minimal/undefined
  completed_at: string  // ISO datetime
}
```

### Required Response (Optimized)
```typescript
{
  job_id: string
  job_type: "summary"
  status: "completed"
  completed_at: string
  result_data: {
    // Core metadata
    video_id: string
    video_title: string
    snapshot_id: number
    cache_hit: boolean  // Was this from cache or fresh analysis
    
    // 1. SUMMARY DATA (required for display)
    summary: {
      summary_paragraph: string  // Executive summary text
      key_takeaways: string[] | null  // Bullet points
      persona?: string  // "viewer" | "creator" | "analyst"
    }
    
    // 2. RELEVANCY/VERDICT DATA (required for trust score & verdict badge)
    relevancy: {
      verdict: string  // "LEGIT" | "MISLEADING" | "CLICKBAIT"
      confidence_score: number  // 0-100 (frontend normalizes to 0-1)
      one_line_summary?: string
      claims: Array<{
        claim: string
        verdict?: string
        confidence?: number
        // Evidence structure (IMPORTANT - nested arrays)
        evidence_for?: Array<{
          user: string  // @username
          text: string  // Comment text
          likes: number
        }>
        evidence_against?: Array<{
          user: string
          text: string
          likes: number
        }>
        danger_warnings?: Array<{
          user: string
          text: string
          likes: number
        }>
      }>
    }
    
    // 3. SENTIMENT DATA (required for Comment Mood tab)
    sentiment: {
      positive: {
        count: number
        top_comments: Array<{
          text: string
          author?: string
          likes?: number
          [key: string]: any  // Flexible for additional fields
        }>
      }
      neutral: {
        count: number
        top_comments: Array<{ text: string; [key: string]: any }>
      }
      negative: {
        count: number
        top_comments: Array<{ text: string; [key: string]: any }>
      }
      mixed?: {
        count: number
        top_comments: Array<{ text: string; [key: string]: any }>
      }
      total_comments: number
      bot_flagged_count?: number
    }
    
    // 4. CHANNEL CREDIBILITY DATA (required for Channel Trust sub-tab)
    channel_credibility: {
      channel_id: string
      channel_name: string | null
      score: number  // 0-100
      normalized_factors: Record<string, number>  // Factor weights
      factual_factors: Record<string, any>  // Factor values
      computed_at: string | null
    }
    
    // 5. TOPIC CLUSTERS DATA (required for Viewer Insights tab)
    topic_clusters: {
      clusters: Array<{
        statement: string  // Insight statement
        count: number  // Number of supporting comments
        supporting_quotes: string[]  // Sample quotes (limited)
        all_supporting_comments?: string[]  // Full list if needed
      }>
      processing_time: number
    }
    
    // 6. TOPIC GAPS DATA (required for Content Gaps tab)
    topic_gaps: {
      gaps: Array<{
        question_statement: string  // Unanswered question
        supporting_comments: string[]  // Comments mentioning this gap
        all_supporting_comments?: string[]
        highlight_indexes?: Array<{ [key: string]: any }>
      }>
      filtered_question_count: number
      processing_time: number
    }
  }
}
```

---

## Field-by-Field Frontend Usage

### 1. Summary Data
**Used in:** OverviewSubTab component
- `summary_paragraph` → Executive summary display with expand/collapse
- `key_takeaways` → Bullet point list
- `persona` → Displayed in header (optional)

### 2. Relevancy/Verdict Data
**Used in:** Toggle button, VideoCredibilitySubTab
- `verdict` → Badge color (LEGIT=green, MISLEADING=amber, CLICKBAIT=red)
- `confidence_score` → Normalized to 0-1, then converted to:
  - Trust score (0-10 scale)
  - AI confidence percentage (0-100%)
- `claims[]` → Expandable claim cards
- `claims[].evidence_for` → Green cards with ✓ icon
- `claims[].evidence_against` → Red cards with ✗ icon
- `claims[].danger_warnings` → Amber cards with ⚠ icon

**Evidence Display Format:**
```
Each evidence comment shows:
- @username (if available)
- Comment text
- 👍 X likes (if > 0)
```

### 3. Sentiment Data
**Used in:** CommentSentimentTab, sentiment distribution charts
- `positive/neutral/negative.count` → Calculate percentages
- `positive/neutral/negative.top_comments[]` → Display example comments
- `total_comments` → "Analyzed X comments" display
- `bot_flagged_count` → Optional bot detection indicator

**Calculation:**
```typescript
positive_percentage = (positive.count / total_comments) * 100
```

### 4. Channel Credibility Data
**Used in:** ChannelCredibilitySubTab
- `score` → Channel trust score (0-100)
- `normalized_factors` → Factor weights for visualization
- `factual_factors` → Factor values displayed in table
- `channel_name` → Display name

**Example factors:**
- subscriber_count
- video_count
- verified_status
- account_age_days

### 5. Topic Clusters Data
**Used in:** ViewerInsightsTab
- `clusters[]` → High-value insights (benefits)
- `clusters[].statement` → Insight statement
- `clusters[].count` → Number of mentions
- `clusters[].supporting_quotes[]` → Expandable comment list

**Display:**
```
"20 viewers mentioned: [statement]"
[Expand to see comments]
```

### 6. Topic Gaps Data
**Used in:** ContentGapsTab
- `gaps[]` → Unanswered questions
- `gaps[].question_statement` → Question text
- `gaps[].supporting_comments[]` → Comments mentioning this gap
- `filtered_question_count` → Total questions identified

**Gap Coverage Score Calculation:**
```typescript
gapCoverageScore = Math.max(0, 100 - (gaps.length * 10))
// 0 gaps = 100%, 10+ gaps = 0%
```

---

## Critical Implementation Notes

### 1. Evidence Structure (MUST BE CORRECT)
The `claims[].evidence_for/against/danger_warnings` arrays MUST contain objects with:
```typescript
{
  user: string      // @username (required for display)
  text: string      // Comment text (required)
  likes: number     // Like count (required, can be 0)
}
```

**Frontend will fail if:**
- Evidence is a flat string array instead of objects
- `user` or `text` fields are missing
- Evidence arrays are missing entirely (should be empty array `[]` if no evidence)

### 2. Sentiment Structure
The sentiment counts can be either:
- Simple numbers: `positive: 5`
- Objects with counts: `positive: { count: 5, top_comments: [...] }`

Frontend handles both, but **MUST include `top_comments` array** for example comment display.

### 3. Topic Gaps - Empty State
If no gaps found (video covered everything):
```json
{
  "topic_gaps": {
    "gaps": [],
    "filtered_question_count": 0,
    "processing_time": 0
  }
}
```

**Do NOT return error** - empty gaps is a valid success state.

### 4. Data Consistency
All nested objects should reference the same `video_id` and use consistent field names:
- Use `video_title` (not `title`)
- Use `confidence_score` (not `confidence`)
- Use `total_comments` (not `comment_count`)

---

## Performance Requirements

### Current Performance
- Job completion: ~25s
- Additional endpoint fetching: ~18s
- **Total time to display:** ~43s

### Target Performance (with optimized result_data)
- Job completion: ~25s (same - backend processing time)
- Additional endpoint fetching: **0s** (all data in result)
- **Total time to display:** ~25s

**Savings:** ~18 seconds (40% reduction)

---

## Backward Compatibility

If the optimized `result_data` is not available (old jobs), the frontend will:
1. Detect missing fields in `result_data`
2. Fall back to current behavior (fetch endpoints individually)
3. Log a warning: `"Job result missing optimized data, fetching endpoints..."`

**No breaking changes** - purely additive optimization.

---

## Example Complete Response

```json
{
  "job_id": "db6e2641-99c6-4d9b-a0ac-963b0e9e4207",
  "job_type": "summary",
  "status": "completed",
  "completed_at": "2026-01-07T17:49:45.198789",
  "result_data": {
    "video_id": "-xxGWrPFM6g",
    "video_title": "特朗普稱馬杜羅抄襲了他的舞步－ BBC News 中文",
    "snapshot_id": 236,
    "cache_hit": false,
    "summary": {
      "summary_paragraph": "The video taps into humor related to political figures...",
      "key_takeaways": [
        "Trump claims Maduro copied his dance moves",
        "Viral moment highlights political satire"
      ],
      "persona": "viewer"
    },
    "relevancy": {
      "verdict": "LEGIT",
      "confidence_score": 90,
      "one_line_summary": "News coverage of Trump's humorous political claim",
      "claims": [
        {
          "claim": "Trump accuses Maduro of copying his dance",
          "verdict": "LEGIT",
          "confidence": 90,
          "evidence_for": [
            {
              "user": "@newsFollower123",
              "text": "This actually happened, saw the clip",
              "likes": 42
            }
          ],
          "evidence_against": [],
          "danger_warnings": []
        }
      ]
    },
    "sentiment": {
      "positive": {
        "count": 20,
        "top_comments": [
          {
            "text": "This is hilarious! 😂",
            "author": "@user1",
            "likes": 15
          }
        ]
      },
      "neutral": {
        "count": 10,
        "top_comments": []
      },
      "negative": {
        "count": 1,
        "top_comments": []
      },
      "total_comments": 31
    },
    "channel_credibility": {
      "channel_id": "UCb3TZ4SD_Ys3j4z0-8o6auA",
      "channel_name": "BBC News 中文",
      "score": 95,
      "normalized_factors": {
        "subscriber_count": 0.3,
        "verified_status": 0.4,
        "account_age": 0.3
      },
      "factual_factors": {
        "subscriber_count": 1200000,
        "verified_status": true,
        "account_age_days": 3650
      },
      "computed_at": "2026-01-07T17:49:44.000000"
    },
    "topic_clusters": {
      "clusters": [
        {
          "statement": "Political satire and humor in news",
          "count": 12,
          "supporting_quotes": [
            "Love how they cover lighter political moments",
            "Good to see some humor in politics"
          ]
        }
      ],
      "processing_time": 17.62
    },
    "topic_gaps": {
      "gaps": [],
      "filtered_question_count": 0,
      "processing_time": 0
    }
  }
}
```

---

## Backend Implementation Checklist

- [ ] Update job processor to aggregate all analysis results
- [ ] Store complete `result_data` object in temporary results table
- [ ] Ensure evidence arrays contain objects (not strings)
- [ ] Handle empty topic_gaps as success (not error)
- [ ] Test with various video types (LEGIT/MISLEADING/CLICKBAIT)
- [ ] Verify JSON object size fits in database column (adjust if needed)
- [ ] Add database index on `job_id` for fast result retrieval
- [ ] Monitor query performance for `/jobs/{job_id}/result` endpoint
- [ ] Consider TTL for temporary results (e.g., 24 hours)

---

## Questions for Backend Team

1. **Database column size**: What's the max JSON size we can store? (Estimate: ~100-500KB per result)
2. **TTL/Cleanup**: How long should we keep job results before cleanup?
3. **Cache strategy**: Should we cache the result_data separately from the job status?
4. **Error handling**: If one analysis component fails (e.g., topic gaps), should we:
   - Return partial data with null fields?
   - Return error and require frontend fallback?
5. **Versioning**: Should we add a `result_data_version` field for future schema changes?
