export interface UserAccount {
  isLoggedIn: boolean
  email?: string
  isVerified?: boolean // Email verification status
  welcomeBonusUsed?: boolean // Whether welcome bonus credits have been used
  tier: "free" | "starter" | "pro"
  dailySearchesLimit: number
  searchesUsedToday: number
  searchesRemaining: number
  resetTime: string
  // Credit system fields
  creditsBalance?: number // Total credits (monthly + purchased)
  monthlyQuota?: number // Monthly credit quota
  purchasedCredits?: number // Purchased credits only
  nextResetDate?: string | null
}

export interface FocusGuardSettings {
  isEnabled: boolean
  videoAnalysis?: {
    showPreWatchPopover: boolean
    autoAnalyze: boolean
    botDetectionEnabled: boolean
    showCachedVerdict?: boolean // Toggle to show verdict for cached analyses
    confirmCreditUsage?: boolean // Toggle to confirm before using credits
    maxCommentDepth?: number // Max comments for PRO users (100-1000)
  }
  // Mode controls available UI presets; optional for existing saved settings
  mode?: 'deep-work' | 'curated' | 'intelligence' | 'video-analysis'
}
