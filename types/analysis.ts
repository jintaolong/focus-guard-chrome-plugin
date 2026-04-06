// Type definitions for Focus Guard Video Analysis (FR-102, FR-103)

import type { TierRestriction } from "./tierRestriction"

// FR-204: Color coding levels
export type TrustLevel = "high" | "medium" | "low"
export type SentimentType = "positive" | "neutral" | "negative" | "mixed"

// FR-103: Inline Status Chip data
export interface VideoAnalysisStatus {
  trustScore: number // 0-10
  clickbaitVerdict: "LEGIT" | "MISLEADING" | "CLICKBAIT"
  isAnalyzing: boolean
}

// CommentObject from V2 API - GDPR compliant comment structure
export interface CommentObject {
  id: number
  text: string
  author_display_name: string | null
  author_channel_id: string | null
  likes: number
  created_at: string | null
  youtube_comment_id: string | null
  is_cleaned?: boolean // True if comment was deleted (30-day retention)
}

// Topic Clustering Types (Enhanced)
export interface SegmentHighlight {
  parent_comment_text: string
  highlighted_segment: string
  char_range: [number, number]
  is_full_comment: boolean
  user: string | null
  likes: number
  // V2 API additions for author attribution
  author_display_name?: string | null
  author_channel_id?: string | null
  youtube_comment_id?: string | null
  comment_id?: number
  created_at?: string | null
  is_cleaned?: boolean
}

export interface TopicCluster {
  cluster_id: number
  statement: string
  count: number
  supporting_quotes: Array<string | CommentObject> // Updated to support both formats
  insight_score: number
  category: string
  reasoning: string
  segment_highlights: SegmentHighlight[]
}

export interface ParentTheme {
  parent_id: number
  child_clusters: TopicCluster[]
  child_count: number
  total_comment_count: number
  avg_insight_score: number
  categories: string[]
  rationale: string
  parent_statement: string
  description: string
}

export interface TopicClustersData {
  clusters: TopicCluster[]
  parent_themes: ParentTheme[]
  hierarchy_map: Record<string, number>
  total_parent_themes: number
  method: string
  processing_time?: number
}

// FR-102: Complete Video Analysis data
export interface VideoAnalysis {
  videoId: string
  videoTitle?: string
  videoUrl?: string
  videoThumbnail?: string  // YouTube thumbnail URL
  channelName?: string     // Channel display name
  executiveSummary?: string // AI-generated executive summary

  // Comment count tracking (for transparency and credit calculation)
  maxCommentsRequested?: number // Number of comments user requested to analyze
  actualCommentsFetched?: number // Actual number of comments fetched/analyzed

  // Legacy and current shapes supported for compatibility with components
  // Summary-style (newer shape)
  summary?: {
    trustScore: number // 0-10 or 0-100 (Verdict Certainty - AI's confidence in verdict)
    evidenceScore?: number // 0-100 (Evidence Score - weighted user evidence for/against claims)
    aiConfidence?: number // 0-100%
    clickbaitVerdict?: {
      label?: "LEGIT" | "MISLEADING" | "CLICKBAIT"
      confidence?: number // 0-100%
      onLineSummary?: string
      claims?: Array<{
        claim: string
        verdict?: string
        confidence?: number
        supporting_evidence?: string[]
      }>
    }
    channelCredibility?: {
      score?: number // 0-100
      factors?: Array<{ name: string; value: string; weight: number }>
    }
    // NEW: Channel Trust in summary
    channelTrust?: {
      trust_score: number
      metrics: any
      raw_metrics?: any
    }
    persona?: string // "viewer", "creator", or "analyst"
    key_takeaways?: string[] | null
  }

  // Top-level (legacy) fields used by several components
  trustScore?: {
    score: number // 0-100 or 0-10
    level?: "high" | "moderate" | "low" | string
    factors?: Array<{ name: string; score: number; description?: string }>
  }

  clickbaitVerdict?: {
    verdict?: string
    confidence?: number
    reasoning?: string
  }

  // Viewer insights can be provided as an array (legacy) or as a structured object
  viewerInsights?:
    | InsightWithComments[]
    | {
        sentimentBreakdown: {
          positive: number
          negative: number
          neutral: number
          mixed: number
          totalCommentsAnalyzed: number
        }
        actionableInsights: {
          highValue: InsightWithComments[]
          improvements: InsightWithComments[]
        }
        tierRestriction?: TierRestriction // Added for tier gating
      }

  // Topic Clusters Data (new enhanced structure)
  topicClustersData?: TopicClustersData

  // Some consumers expect `sentiment` at top level
  sentiment?: {
    overall?: string
    distribution?: {
      positive: number
      neutral: number
      negative: number
      mixed?: number
      totalCommentsAnalyzed?: number
      exampleComments?: {
        positive?: Array<string | CommentObject>
        neutral?: Array<string | CommentObject>
        negative?: Array<string | CommentObject>
      }
    }
    tierRestriction?: TierRestriction // Added for tier gating
    filteringMetadata?: {
      total_input?: number
      filtered_count?: number
      after_layer1?: number
      after_layer2?: number
    }
  }

  // Content gaps (keep original name and shape)
  contentGaps?: {
    gapCoverageScore?: number
    botPercentage?: number // 0-100 percentage of bot comments detected
    unansweredQuestions?: InsightWithComments[]
    botDetectionEnabled?: boolean
    tierRestriction?: TierRestriction // Added for tier gating
    filteringMetadata?: {
      total_input?: number
      after_layer1?: number
      after_layer2?: number
      filtered_question_count?: number
    }
  }

  // Channel credibility (legacy - deprecated, but still populated for backward compatibility)
  channelCredibility?: {
    score?: number // 0-100
    verifiedStatus?: boolean
    history?: string
    bias?: string
    factors?: Array<{ name: string; value: string; weight: number }>
    // NEW: Include full new format data when available
    metrics?: {
      audience_reach: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      creator_authority: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      niche_focus: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      community_loyalty: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      content_freshness: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
    }
    trust_score?: number
    raw_metrics?: any
    metric_details?: any
  }

  // NEW: Channel Trust (5 metrics system)
  channelTrust?: {
    channel_id: string
    channel_name: string
    trust_score: number // 0-100
    metrics: {
      audience_reach: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      creator_authority: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      niche_focus: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      community_loyalty: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
      content_freshness: {
        score: number
        raw_value: any
        normalized_value: number
        description: string
        breakdown?: any
      }
    }
    raw_metrics?: {
      channel: {
        channel_id: string
        subscriber_count: number
        video_count: number
        view_count: number
        account_age_days: number
        has_topic_labels: boolean
        topic_categories: string[]
      }
      recent_videos?: any[]
    }
    computed_at?: string | null
    api_calls_used?: number
  }

  reportInfo?: {
    availableFormats?: ("PDF" | "TXT")[]
    analysisDate?: string
    tierRestriction?: TierRestriction
  }

  /** UUID share code returned by the backend for constructing a public report URL.
   *  Example: `${PORTAL_URL}/report/${snapshotShareCode}` */
  snapshotShareCode?: string | null
  /** Integer snapshot ID from the backend; used as a fallback report URL path segment
   *  until the backend supplies a UUID `share_code`. */
  snapshotId?: number | null
  /** When true the snapshot owner has opted in to full public access.
   *  All tier gates (BlurredContent / locked tabs) are bypassed, mirroring
   *  the web portal's isFullyPublic behaviour. */
  isFullyPublic?: boolean
  // True while only core cached data is shown and secondary tabs are still hydrating.
  isHydratingSecondary?: boolean

  analyzedAt?: string
  isStale?: boolean
}

// FR-401: Statement and Supporting Comments Pattern
export interface InsightWithComments {
  id: string
  statement: string
  type: "benefit" | "issue" | "gap" // determines color coding
  commentCount: number
  supportingComments: Array<Comment | CommentObject> // Updated to support both formats
  isExpanded?: boolean
}

export interface Comment {
  id: string
  text: string // redacted quote
  humanLikenessScore: number // 0-10 for bot detection
  timestamp?: string
  author?: string // redacted
  // V2 API additions
  author_display_name?: string | null
  author_channel_id?: string | null
  youtube_comment_id?: string | null
  likes?: number
  created_at?: string | null
  is_cleaned?: boolean
}

// Analysis History (Tab 4)
export interface AnalysisHistoryItem {
  videoId: string
  videoTitle: string
  videoThumbnail: string
  trustScore: number
  analyzedAt: string
  reportUrl?: string
}

// FR-203: Loading states
export interface AnalysisLoadingState {
  isLoading: boolean
  progress?: number // 0-100%
  message?: string // e.g., "Analyzing transcript...", "Processing comments..."
}

// API Request/Response types
export interface VideoAnalysisRequest {
  videoId: string
  forceRefresh?: boolean
}

export interface VideoAnalysisResponse {
  analysis: VideoAnalysis
  cached: boolean
}

export interface ReportDownloadRequest {
  videoId: string
  format: "PDF" | "TXT"
}

export interface AnalysisHistoryResponse {
  history: AnalysisHistoryItem[]
  totalCount: number
}
