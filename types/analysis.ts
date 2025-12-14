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

// FR-102: Complete Video Analysis data
export interface VideoAnalysis {
  videoId: string
  videoTitle?: string
  videoUrl?: string
  executiveSummary?: string // AI-generated executive summary

  // Legacy and current shapes supported for compatibility with components
  // Summary-style (newer shape)
  summary?: {
    trustScore: number // 0-10 or 0-100
    aiConfidence?: number // 0-100%
    clickbaitVerdict?: {
      label?: "LEGIT" | "MISLEADING" | "CLICKBAIT"
      confidence?: number // 0-100%
    }
    channelCredibility?: {
      score?: number // 0-100
      factors?: Array<{ name: string; value: string; weight: number }>
    }
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
        positive?: string[]
        neutral?: string[]
        negative?: string[]
      }
    }
    tierRestriction?: TierRestriction // Added for tier gating
  }

  // Content gaps (keep original name and shape)
  contentGaps?: {
    gapCoverageScore?: number
    botPercentage?: number // 0-100 percentage of bot comments detected
    unansweredQuestions?: InsightWithComments[]
    botDetectionEnabled?: boolean
    tierRestriction?: TierRestriction // Added for tier gating
  }

  // Channel credibility (can appear at top level too)
  channelCredibility?: {
    score?: number // 0-100
    verifiedStatus?: boolean
    history?: string
    bias?: string
    factors?: Array<{ name: string; value: string; weight: number }>
  }

  reportInfo?: {
    availableFormats?: ("PDF" | "TXT")[]
    analysisDate?: string
    tierRestriction?: TierRestriction
  }

  analyzedAt?: string
  isStale?: boolean
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
