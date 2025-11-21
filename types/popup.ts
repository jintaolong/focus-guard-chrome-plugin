export interface UserAccount {
  isLoggedIn: boolean
  email?: string
  tier: "starter" | "pro"
  searchesUsedToday: number
  searchesRemaining: number
  resetTime: string
}

export interface FocusGuardSettings {
  isEnabled: boolean
  mode: "deep-work" | "curated" | "intelligence"
}

export const MODE_INFO = {
  "deep-work": {
    name: "Deep Work Mode",
    description: "Blocks all recommendations, only shows search results with objective summaries",
    icon: "🎯"
  },
  "curated": {
    name: "Curated Mode",
    description: "AI picks only the most relevant videos for your query",
    icon: "✨"
  },
  "intelligence": {
    name: "Intelligence Mode",
    description: "Maps sentiment and bias across sources for informed viewing",
    icon: "🧠"
  }
} as const
