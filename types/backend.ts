// Backend API type definitions for CommentVerdict API integration
// Base URL: https://api.commentverdict.com/api/v1

// ============================================================================
// Authentication Types
// ============================================================================

export interface UserCreate {
  email: string
  password: string // min 8 characters
  full_name?: string | null
}

export interface UserResponse {
  id: number
  email: string
  full_name: string | null
  is_active: boolean
  is_verified: boolean
  welcome_bonus_used?: boolean // Whether welcome bonus credits have been consumed
}

export interface UserUpdate {
  full_name?: string | null
  email?: string | null
  password?: string | null
}

export interface Token {
  access_token: string
  refresh_token: string
  token_type: "bearer"
}

export interface TokenRefresh {
  refresh_token: string
}

export interface VerifyEmailResponse {
  message: string
  is_verified: boolean
}

export interface ResendVerificationResponse {
  message: string
  email: string
}

// ============================================================================
// Subscription Types
// ============================================================================

export type SubscriptionTier = "FREE" | "STARTER" | "PRO"
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid"

export interface SubscriptionTierInfo {
  id: "free" | "starter" | "pro"
  name: string
  price_monthly: number
  limits: {
    daily_reports: number
  }
  features: {
    detailed_sentiment: boolean
    key_takeaways: boolean
    topic_clustering: boolean
    gap_analysis: boolean
    priority_support: boolean
  }
}

export interface SubscriptionTiersResponse {
  tiers: SubscriptionTierInfo[]
}

export interface SubscriptionResponse {
  id: number
  user_id: number
  tier: SubscriptionTier
  status: SubscriptionStatus
  daily_searches_limit: number
  daily_searches_used: number
  last_reset_date: string // ISO date YYYY-MM-DD
  current_period_start: string | null // ISO datetime
  current_period_end: string | null // ISO datetime
  cancel_at_period_end: boolean
  created_at: string // ISO datetime
}

export interface SubscriptionUsage {
  tier: SubscriptionTier
  daily_searches_limit: number
  daily_searches_used: number
  searches_remaining: number // -1 for unlimited
  can_search: boolean
}

export interface CheckoutResponse {
  checkout_url: string
  session_id: string
}

// ============================================================================
// Async Job Types
// ============================================================================

export type JobType = "summary" | "report"
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface SummaryJobRequest {
  video_id: string // 11 characters
  query_context?: string | null
  force_refresh?: boolean
  max_comments?: number // default 100, range 1-1000
}

export interface ReportJobRequest {
  video_id: string // 11 characters
  query_context?: string | null
  format: "txt" | "pdf"
  force_refresh?: boolean
}

export interface JobSubmitResponse {
  job_id: string
  status: JobStatus
  status_url: string
  result_url: string
  message: string
}

export interface JobStatusResponse {
  job_id: string
  job_type: JobType
  status: JobStatus
  progress_percent: number // 0-100
  progress_message: string | null
  created_at: string // ISO datetime
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  is_terminal: boolean
  error_message: string | null
}

export interface JobResultResponse {
  job_id: string
  job_type: JobType
  status: "completed"
  result_data: any // Type depends on job_type
  completed_at: string
}

// ============================================================================
// Video Analysis Types (V2 - Cached-first)
// ============================================================================

export interface VideoAnalysisRequest {
  video_id: string // 11 characters
  force_refresh?: boolean
}

export interface SentimentAnalysisRequest {
  video_id: string
  query_context?: string | null
  force_refresh?: boolean
}

export interface SummaryRequestV2 {
  video_id: string
  query_context?: string | null
  force_refresh?: boolean
  max_comments?: number // default 100, range 1-1000
  persona?: "viewer" | "creator" | "analyst" | null // optional override
}

export interface ReportRequest {
  video_id: string
  query_context?: string | null
  format: "txt" | "pdf"
  force_refresh?: boolean
}

// Response Types

export interface SentimentResponseV2 {
  status: string
  video_id: string
  video_title: string
  data: {
    positive: number | { count: number; top_comments: Array<{ text: string; [key: string]: any }> }
    neutral: number | { count: number; top_comments: Array<{ text: string; [key: string]: any }> }
    negative: number | { count: number; top_comments: Array<{ text: string; [key: string]: any }> }
    mixed?: number | { count: number; top_comments: Array<{ text: string; [key: string]: any }> }
    bot_flagged_count?: number
    total_comments?: number
    excluded_count?: number    // Number of comments excluded from sentiment analysis
  }
  cache_hit: boolean
  note: string | null
  filtering_metadata?: {
    total_input: number       // Total comments before filtering
    filtered_count: number    // Comments after theme-relevance filtering
  }
}

export interface TopicCluster {
  statement: string
  count: number
  supporting_quotes: string[]
  all_supporting_comments?: string[] // All supporting comments (not limited)
}

export interface TopicClusterResponseV2 {
  status: string
  video_id: string
  video_title: string
  topic_clusters: TopicCluster[]
  processing_time: number
  cache_hit: boolean
}

export interface TopicGap {
  question_statement: string
  supporting_comments: string[]
  all_supporting_comments?: string[] // All supporting comments (not limited)
  highlight_indexes?: Array<{ [key: string]: any }> // Highlight information
}

export interface TopicGapResponseV2 {
  status: string
  video_id: string
  video_title: string
  topic_gaps: TopicGap[]
  filtered_question_count: number
  processing_time: number
  cache_hit: boolean
  filtering_metadata?: {
    total_input: number        // Total comments before filtering
    after_layer1: number        // After word count + negative anchor filtering
    after_layer2: number        // After positive anchor + zero-shot filtering
  }
}

export interface ChannelCredibilityResponseV2 {
  status: string
  video_id: string
  video_title: string
  channel_id: string
  channel_name: string | null
  score: number // 0-100
  normalized_factors: Record<string, number>
  factual_factors: Record<string, any>
  computed_at: string | null
  cache_hit: boolean
}

// NEW: Channel Trust System (5 Metrics)
export interface MetricBreakdown {
  score: number // 0-100
  normalized_value: number // 0.0-1.0
  description: string
  raw_value: Record<string, any>
  breakdown?: Record<string, any>
}

export interface ChannelTrustMetrics {
  audience_reach: MetricBreakdown
  creator_authority: MetricBreakdown
  niche_focus: MetricBreakdown
  community_loyalty: MetricBreakdown
  content_freshness: MetricBreakdown
}

export interface ChannelTrustResponse {
  status: string
  video_id: string
  channel_id: string
  channel_name: string
  trust_score: number // Overall 0-100
  metrics: ChannelTrustMetrics
  raw_metrics: {
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
  metric_details: {
    timestamp: string
    total_api_calls: number
    cache_age_days: number
  }
  cache_hit: boolean
}

export interface RelevancyResponseV2 {
  status: string
  video_id: string
  video_title: string
  data: {
    verdict: string
    confidence_score: number
    one_line_summary?: string
    best_timestamp?: string | null
    claims: Array<{
      claim: string
      verdict?: string
      confidence?: number
      supporting_evidence?: string[]
      [key: string]: any
    }>
    [key: string]: any
  }
  cache_hit: boolean
  note: string | null
}

export interface HumanLikenessResult {
  comment_id: string | null
  comment_text: string
  hls_score: number // 1-10
  hls_justification: string
  is_bot_flag: boolean
  feature_scores: {
    redundancy_score: number
    typo_score: number
    slang_score: number
    spam_score: number
  }
}

export interface HumanLikenessResponseV2 {
  status: string
  video_id: string
  video_title: string
  total_comments: number
  bot_count: number
  human_count: number
  results: HumanLikenessResult[]
  cache_hit: boolean
  note: string | null
}

export interface SummaryResponseV2 {
  status: string
  summary_paragraph: string
  video_id: string
  snapshot_id: number
  cache_hit: boolean
  data_hash: string
  video_title: string
  credibility_score: number
  sentiment_score: number
  persona?: string // "viewer", "creator", or "analyst"
  key_takeaways?: string[] | null
  confidence?: string | null
  max_comments_requested?: number | null // Number of comments requested for analysis
  actual_comments_fetched?: number | null // Number of comments actually analyzed
}

export interface SummaryStatusResponse {
  video_id: string
  video_data_cached: boolean
  video_data_id: number | null
  has_comments: boolean
  has_transcript: boolean
  latest_snapshot_id: number | null
  latest_snapshot_hash: string | null
  summary_cached: boolean
  analysis_references: {
    sentiment_analysis_id: number | null
    topic_clustering_id: number | null
    topic_gap_analysis_id: number | null
    channel_credibility_id: number | null
  } | null
}

export interface RunningJobInfo {
  job_id: string // Celery task ID
  job_type: JobType // Type of job (summary, report, etc.)
  status: "pending" | "running" // Current status
  query_context: string | null // The query context (important for matching identical jobs)
  created_at: string // ISO datetime - when the job was created
  progress_percent: number // Current progress (0-100)
  progress_message: string | null // Progress description
}

export interface CacheStatusResponse {
  video_id: string
  cached: boolean
  title: string | null
  channel_name: string | null
  comment_count: number
  has_transcript: boolean
  view_count: number | null
  like_count: number | null
  last_fetched_at: string | null
  has_running_jobs: boolean // Boolean indicating if there are any pending/running jobs
  running_jobs: RunningJobInfo[] // Array of job details
}

export interface ReportMetadata {
  video_id: string
  video_title: string
  channel_name: string
  generated_at: string
  format: string
  components_cached: {
    summary: boolean
    relevancy: boolean
    credibility: boolean
    sentiment: boolean
    topics: boolean
    gaps: boolean
    bot_detection: boolean
  }
}

// ============================================================================
// API Error Types
// ============================================================================

export interface APIError {
  detail: string | { msg: string; type: string }[]
  status_code?: number
}

export interface ValidationError {
  loc: (string | number)[]
  msg: string
  type: string
}
