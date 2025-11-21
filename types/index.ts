// Type definitions for Focus Guard

export interface VideoResult {
  id: string
  title: string
  channelName: string
  thumbnailUrl: string
  url: string
  relevanceScore: number
  transcriptSentiment: {
    score: number
    label: "positive" | "neutral" | "negative"
  }
  commentSentiment: {
    score: number
    label: "positive" | "neutral" | "negative"
  }
  duration: string
  viewCount: string
}

export interface SearchRequest {
  query: string
  filters?: {
    excludeNegativeTone?: boolean
    objectiveOnly?: boolean
    channelBiasCheck?: string
  }
}

export interface SearchResponse {
  results: VideoResult[]
  searchesRemaining: number
  tier: "free" | "premium"
}

export interface UserStats {
  searchesUsedToday: number
  searchesRemaining: number
  tier: "free" | "premium"
  resetTime: string
}
