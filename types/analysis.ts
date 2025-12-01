// Type definitions for Focus Guard Video Analysis (FR-102, FR-103)

// FR-204: Color coding levels
export type TrustLevel = "high" | "medium" | "low"
export type SentimentType = "positive" | "neutral" | "negative" | "mixed"

// FR-103: Inline Status Chip data
export interface VideoAnalysisStatus {
  trustScore: number // 0-10
  clickbaitVerdict: "LEGIT" | "MISLEADING" | "CLICKBAIT"
  isAnalyzing: boolean
}

// FR-102: Complete Video Analysis data
export interface VideoAnalysis {
  videoId: string
  videoUrl: string
  
  // Tab 1: Summary & Score
  summary: {
    trustScore: number // 0-10
    aiConfidence: number // 0-100%
    clickbaitVerdict: {
      label: "LEGIT" | "MISLEADING" | "CLICKBAIT"
      confidence: number // 0-100%
    }
    channelCredibility: {
      score: number // 0-100
      factors: string[] // e.g., ["Verified", "High Engagement"]
    }
  }
  
  // Tab 2: Viewer Insights
  viewerInsights: {
    sentimentBreakdown: {
      positive: number // percentage
      negative: number
      neutral: number
      mixed: number
      totalCommentsAnalyzed: number
    }
    actionableInsights: {
      highValue: InsightWithComments[] // Green - strengths
      improvements: InsightWithComments[] // Red/Orange - issues
    }
  }
  
  // Tab 3: Content Gaps
  contentGaps: {
    gapCoverageScore: number // 0-100%
    unansweredQuestions: InsightWithComments[]
    botDetectionEnabled: boolean
  }
  
  // Tab 4: Report & Account
  reportInfo: {
    availableFormats: ("PDF" | "TXT")[]
    analysisDate: string
  }
  
  // Metadata
  analyzedAt: string
  isStale: boolean
}

// FR-401: Statement and Supporting Comments Pattern
export interface InsightWithComments {
  id: string
  statement: string
  type: "benefit" | "issue" | "gap" // determines color coding
  commentCount: number
  supportingComments: Comment[]
  isExpanded?: boolean
}

export interface Comment {
  id: string
  text: string // redacted quote
  humanLikenessScore: number // 0-10 for bot detection
  timestamp?: string
  author?: string // redacted
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
