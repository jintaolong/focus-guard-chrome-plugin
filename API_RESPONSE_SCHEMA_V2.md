# API Response Schema Documentation - V2 (GDPR Compliant)

**Last Updated:** February 6, 2026  
**Branch:** `copilot/revamp-raw-comment-saving`  
**PR:** #154 - Implement centralized comment storage for GDPR compliance

## Overview

This document describes the response schemas for the V2 analysis endpoints with full comment object support for author attribution and backtracing.

---

## Topic Clustering Response (`/api/v1/videos/topic-clustering/v2`)

### Response Structure

```typescript
{
  status: "SUCCESS",
  video_id: string,
  video_title: string,
  topic_clusters: TopicCluster[],
  total_clusters: number,        // Total count before limiting
  processing_time: number,        // Seconds
  cache_hit: boolean,
  parent_themes?: ParentTheme[],  // Layer 2 hierarchical themes
  hierarchy_map?: Record<number, number>,  // Maps L1 cluster_id -> L2 parent_id
  total_parent_themes?: number,
  method?: string                 // "vector-hierarchical" or "vector"
}
```

### TopicCluster Object

```typescript
{
  cluster_id?: number,           // Numeric identifier from HDBSCAN
  statement: string,             // Concise insight statement (6-12 words)
  count: number,                 // Number of comments in cluster
  supporting_quotes: Array<string | CommentObject>,  // NEW: Can be full objects
  insight_score?: number,        // 0-10, AI-rated importance
  category?: string,             // request|opinion|sentiment|correction|question|narrative|sarcasm|noise
  reasoning?: string,            // AI explanation for importance
  segment_highlights?: SegmentHighlight[]  // For UI highlighting
}
```

### CommentObject Structure (NEW)

When `supporting_quotes` contains full objects, each has:

```typescript
{
  id: number,                    // Database ID
  text: string,                  // Comment text
  author_display_name: string | null,
  author_channel_id: string | null,
  likes: number,
  created_at: string | null,     // ISO 8601 format
  youtube_comment_id: string | null,
  is_cleaned?: boolean           // True if comment was deleted (30-day retention)
}
```

### SegmentHighlight Structure

```typescript
{
  parent_comment_text: string,   // Full comment text
  highlighted_segment: string,   // The relevant portion
  char_range: [number, number],  // [start, end] character indexes
  is_full_comment: boolean,      // Whether entire comment is relevant
  user: string | null,           // Author display name
  likes: number                  // Like count
}
```

### ParentTheme Structure (Layer 2)

```typescript
{
  parent_id: number,             // Unique parent theme ID
  statement: string,             // High-level theme label
  language: string,              // ISO 639-1 code (e.g., "en", "zh-TW")
  child_count: number,           // Number of L1 clusters grouped
  avg_score: number,             // Average insight_score of children
  child_clusters: Array<{        // References to L1 clusters
    cluster_id: number,
    statement: string,
    count: number,
    // Note: No raw comment data in child_clusters (GDPR)
  }>,
  rationale?: string             // Why these clusters were grouped
}
```

---

## Topic Gap Response (`/api/v1/videos/topic-gap/v2`)

### Response Structure

```typescript
{
  status: "SUCCESS",
  video_id: string,
  video_title: string,
  topic_gaps: TopicGap[],
  processing_time: number,       // Seconds
  filtered_question_count: number,  // Questions after filtering
  cache_hit: boolean,
  filtering_metadata?: {
    total_input: number,         // Original comment count
    after_layer1: number,        // After first filter
    after_layer2: number         // After second filter
  }
}
```

### TopicGap Object

```typescript
{
  question_statement: string,    // Concise thematic question
  frequency: number,             // Number of comments in this gap cluster
  transcript_reference: string,  // Confirmation of gap (usually "None Found")
  sample_comments: Array<string | CommentObject>,  // NEW: Can be full objects
  supporting_comments?: Array<string | CommentObject>,  // Backward compat
  highlight_indexes?: Array<{    // For highlighting within comments
    id: number,                  // Comment ID
    start: number,               // Character start index
    end: number                  // Character end index
  }>
}
```

**Note:** `sample_comments` and `supporting_comments` contain the same data. `supporting_comments` is maintained for backward compatibility.

---

## Sentiment Analysis Response (`/api/v1/videos/sentiment/v2`)

### Response Structure

```typescript
{
  status: "SUCCESS",
  video_id: string,
  video_title: string,
  sentiment_data: SentimentData,
  processing_time: number,
  cache_hit: boolean
}
```

### SentimentData Object

```typescript
{
  positive: {
    count: number,
    percentage: number,
    top_comments: CommentObject[]  // Full comment objects
  },
  neutral: {
    count: number,
    percentage: number,
    top_comments: CommentObject[]
  },
  negative: {
    count: number,
    percentage: number,
    top_comments: CommentObject[]
  },
  mixed?: {
    count: number,
    percentage: number,
    top_comments: CommentObject[]
  },
  total_comments: number,
  bot_flagged_count?: number
}
```

---

## Relevancy/Clickbait Response (`/api/v1/videos/relevancy/v2`)

### Response Structure

```typescript
{
  status: "SUCCESS",
  video_id: string,
  video_title: string,
  verdict: "DELIVERS" | "MIXED" | "CLICKBAIT" | "UNKNOWN",
  confidence_score: number,      // 0-100
  one_line_summary: string,
  claims: Claim[],
  best_timestamp?: string,
  processing_time: number,
  cache_hit: boolean
}
```

### Claim Object

```typescript
{
  claim_text: string,
  verdict: "CONFIRMED" | "PARTIALLY_CONFIRMED" | "UNCONFIRMED",
  evidence_for: CommentObject[],      // Supporting evidence
  evidence_against: CommentObject[],  // Counter evidence
  danger_warnings?: CommentObject[],  // Safety concerns
  timestamp_reference?: string
}
```

---

## Executive Summary Response (`/api/v1/jobs/{job_id}/result`)

Returns comprehensive analysis data in `result_data.comprehensive_data`:

### Comprehensive Data Structure

```typescript
{
  video_id: string,
  video_title: string,
  snapshot_id: number,
  cache_hit: boolean,
  max_comments_requested: number,
  actual_comments_fetched: number,
  
  // Summary
  summary: {
    summary_paragraph: string,
    key_takeaways: string[],
    persona: "viewer" | "creator" | "analyst"
  },
  
  // Relevancy
  relevancy: {
    verdict: string,
    confidence_score: number,
    one_line_summary: string,
    claims: Claim[]
  },
  
  // Sentiment
  sentiment: {
    positive: { count: number, supporting_comments: CommentObject[] },
    neutral: { count: number, supporting_comments: CommentObject[] },
    negative: { count: number, supporting_comments: CommentObject[] },
    total_comments: number
  },
  
  // Channel Trust (NEW 5-metric system)
  channel_trust: {
    channel_id: string,
    channel_name: string,
    trust_score: number,        // 0-100 weighted average
    metrics: {
      audience_reach: MetricDetail,
      creator_authority: MetricDetail,
      niche_focus: MetricDetail,
      community_loyalty: MetricDetail,
      content_freshness: MetricDetail
    },
    computed_at: string | null
  },
  
  // Topic Clusters
  topic_clusters: {
    clusters: Array<{
      cluster_id?: number,
      statement: string,
      count: number,
      supporting_quotes: CommentObject[],  // NEW: Full objects
      insight_score?: number,
      category?: string,
      reasoning?: string,
      segment_highlights?: SegmentHighlight[]
    }>,
    processing_time: number,
    parent_themes?: ParentTheme[],
    hierarchy_map?: Record<number, number>,
    total_parent_themes?: number,
    method?: string
  },
  
  // Topic Gaps
  topic_gaps: {
    gaps: Array<{
      question_statement: string,
      sample_comments: CommentObject[],  // NEW: Full objects
      supporting_comments: CommentObject[],  // Backward compat
      highlight_indexes?: Array<{ id: number, start: number, end: number }>
    }>,
    filtered_question_count: number,
    processing_time: number
  }
}
```

### MetricDetail Object

```typescript
{
  score: number,                 // 0-100
  raw_value: Record<string, any>,  // Original metric values
  normalized_value: number,      // 0-1 normalized
  description: string,           // Metric description
  breakdown?: Record<string, any>  // Detailed calculation breakdown
}
```

---

## Comment Retention & Cleanup

### Important Notes for Frontend

1. **30-Day Retention:** Comments are deleted after 30 days per GDPR/YouTube TOS
2. **Cleaned Comments:** When a comment is deleted, it's replaced with:
   ```typescript
   {
     id: number,
     text: "[Comment removed after 30-day retention period]",
     author_display_name: null,
     author_channel_id: null,
     likes: 0,
     created_at: null,
     youtube_comment_id: null,
     is_cleaned: true
   }
   ```
3. **Check `is_cleaned`:** Frontend should check this flag to show appropriate UI (e.g., grayed out, tooltip explaining retention policy)

---

## Migration Notes

### What Changed from V1 to V2

1. **Supporting Quotes/Comments:** Now return full `CommentObject` instead of just strings
2. **Author Attribution:** All comment objects now include `author_display_name` and `author_channel_id`
3. **Backtracing:** Each comment has a unique `id` for linking back to source
4. **Retention Indicators:** `is_cleaned` flag indicates deleted comments
5. **Hierarchical Clustering:** New `parent_themes` and `hierarchy_map` for 2-layer organization
6. **Channel Trust:** Replaced legacy `channel_credibility` with 5-metric `channel_trust` system

### Backward Compatibility

- Schemas accept both `string` and `CommentObject` types using `Union[str, Dict[str, Any]]`
- Old string-only responses still work but are deprecated
- `supporting_comments` field maintained alongside `sample_comments` for topic gaps

---

## Example Usage

### TypeScript Interface Definitions

```typescript
interface CommentObject {
  id: number;
  text: string;
  author_display_name: string | null;
  author_channel_id: string | null;
  likes: number;
  created_at: string | null;
  youtube_comment_id: string | null;
  is_cleaned?: boolean;
}

interface TopicCluster {
  cluster_id?: number;
  statement: string;
  count: number;
  supporting_quotes: Array<string | CommentObject>;
  insight_score?: number;
  category?: string;
  reasoning?: string;
  segment_highlights?: SegmentHighlight[];
}

interface TopicGap {
  question_statement: string;
  frequency: number;
  transcript_reference: string;
  sample_comments: Array<string | CommentObject>;
  supporting_comments?: Array<string | CommentObject>;
  highlight_indexes?: Array<{
    id: number;
    start: number;
    end: number;
  }>;
}
```

### Handling Comments in UI

```typescript
function renderComment(comment: string | CommentObject) {
  // Handle both legacy strings and new full objects
  if (typeof comment === 'string') {
    return <div className="comment-text">{comment}</div>;
  }
  
  // Full comment object
  if (comment.is_cleaned) {
    return (
      <div className="comment-deleted" title="Comment deleted after 30-day retention">
        <span className="text-muted">{comment.text}</span>
      </div>
    );
  }
  
  return (
    <div className="comment-full">
      <div className="comment-author">
        {comment.author_display_name || 'Anonymous'}
        {comment.likes > 0 && <span className="likes">👍 {comment.likes}</span>}
      </div>
      <div className="comment-text">{comment.text}</div>
      {comment.created_at && (
        <div className="comment-date">{new Date(comment.created_at).toLocaleDateString()}</div>
      )}
    </div>
  );
}
```

---

## Testing

### Verify Full Comment Objects

Check that responses include full comment metadata:

```bash
curl -X POST 'https://api.example.com/api/v1/videos/topic-clustering/v2' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"video_id": "dQw4w9WgXcQ"}' | jq '.topic_clusters[0].supporting_quotes[0]'
```

Expected output:
```json
{
  "id": 1234,
  "text": "Great video!",
  "author_display_name": "John Doe",
  "author_channel_id": "UC123abc",
  "likes": 42,
  "created_at": "2026-01-15T10:30:00Z",
  "youtube_comment_id": "Ugx123abc"
}
```

---

## Questions or Issues?

If you encounter schema validation errors or missing fields, please file an issue on the PR #154 or contact the backend team.
