export interface UserAccount {
  isLoggedIn: boolean
  isGuest?: boolean // True when browsing as an unauthenticated visitor
  deviceFingerprint?: string // Device fingerprint used as guest identifier
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
  monthlyCreditsRemaining?: number // Monthly credits remaining (for quota bar)
  monthlyQuota?: number // Monthly credit quota
  purchasedCredits?: number // Purchased credits only
  nextResetDate?: string | null
  cancelAtPeriodEnd?: boolean // Whether subscription is set to cancel
  currentPeriodEnd?: string | null // When current period ends
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
    proToggleMode?: "free_verdict" | "full_analysis" // PRO only: toggle button default behavior
    autoQuickVerdict?: boolean // Auto-run quick verdict on new videos when toggle default is Quick Verdict
  }
  // Mode controls available UI presets; optional for existing saved settings
  mode?: 'deep-work' | 'curated' | 'intelligence' | 'video-analysis'
}
