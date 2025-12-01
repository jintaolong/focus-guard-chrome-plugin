// FR-204: Standard Color Mapping - Traffic Light System

export const COLORS = {
  // High Trust / Positive / Success
  high: {
    primary: "#10b981", // green-500
    light: "#d1fae5", // green-100
    dark: "#065f46", // green-800
    text: "#047857" // green-700
  },
  
  // Medium / Warning / Misleading
  medium: {
    primary: "#f59e0b", // amber-500
    light: "#fef3c7", // amber-100
    dark: "#b45309", // amber-700
    text: "#d97706" // amber-600
  },
  
  // Low Trust / Negative / Danger
  low: {
    primary: "#ef4444", // red-500
    light: "#fee2e2", // red-100
    dark: "#b91c1c", // red-700
    text: "#dc2626" // red-600
  },
  
  // Neutral / Info
  neutral: {
    primary: "#3b82f6", // blue-500
    light: "#dbeafe", // blue-100
    dark: "#1e40af", // blue-700
    text: "#2563eb" // blue-600
  },
  
  // UI Colors
  ui: {
    background: "#ffffff",
    surface: "#f9fafb",
    border: "#e5e7eb",
    text: {
      primary: "#111827",
      secondary: "#6b7280",
      disabled: "#9ca3af"
    }
  }
} as const

// Helper functions for color mapping
export function getTrustScoreColor(score: number): keyof typeof COLORS {
  if (score >= 7) return "high"
  if (score >= 4) return "medium"
  return "low"
}

export function getClickbaitVerdictColor(
  verdict: "LEGIT" | "MISLEADING" | "CLICKBAIT"
): keyof typeof COLORS {
  switch (verdict) {
    case "LEGIT":
      return "high"
    case "MISLEADING":
      return "medium"
    case "CLICKBAIT":
      return "low"
  }
}

export function getSentimentColor(
  sentiment: "positive" | "neutral" | "negative" | "mixed"
): keyof typeof COLORS {
  switch (sentiment) {
    case "positive":
      return "high"
    case "neutral":
      return "neutral"
    case "negative":
      return "low"
    case "mixed":
      return "medium"
  }
}

export function getInsightTypeColor(
  type: "benefit" | "issue" | "gap"
): keyof typeof COLORS {
  switch (type) {
    case "benefit":
      return "high"
    case "issue":
      return "low"
    case "gap":
      return "medium"
  }
}
