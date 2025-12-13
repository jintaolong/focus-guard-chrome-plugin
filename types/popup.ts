export interface UserAccount {
  isLoggedIn: boolean
  email?: string
  tier: "free" | "starter" | "pro"
  dailySearchesLimit: number
  searchesUsedToday: number
  searchesRemaining: number
  resetTime: string
}

export interface FocusGuardSettings {
  isEnabled: boolean
  videoAnalysis?: {
    showPreWatchPopover: boolean
    autoAnalyze: boolean
    botDetectionEnabled: boolean
  }
}
