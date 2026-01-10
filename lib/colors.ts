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
    },
    // Convenience flattened fields used across components
    textPrimary: "#111827",
    textSecondary: "#6b7280",
    textDisabled: "#9ca3af",
    // simple shorthand for components that expect a single ui.text value
    // (removed duplicate simple `text` string to keep `ui.text` as object)
    hover: "#f3f4f6"
  }
} as const

// Backwards-compatible color name aliases
// Some components reference green/yellow/red directly; map them to the trust-level keys
(COLORS as any).green = (COLORS as any).high;
(COLORS as any).yellow = (COLORS as any).medium;
(COLORS as any).red = (COLORS as any).low;

// Typed helpers
export type ColorKey = "high" | "medium" | "low" | "neutral"
export type ColorSet = {
  primary: string
  light: string
  dark: string
  text: string
}

// Return a guaranteed ColorSet for a traffic-light key. Falls back to `neutral`.
export function getColorSet(key: string | ColorKey): ColorSet {
  const k = (key as string) || "neutral"
  if (k === "high" || k === "medium" || k === "low" || k === "neutral") {
    const cs = (COLORS as any)[k]
    return {
      primary: cs.primary,
      light: cs.light,
      dark: cs.dark,
      text: cs.text
    }
  }
  // ui doesn't match the 4-field shape; return a neutral fallback
  const n = (COLORS as any).neutral
  return { primary: n.primary, light: n.light, dark: n.dark, text: n.text }
}

// Helper functions for color mapping
export function getTrustScoreColor(score: number): ColorKey {
  // Support both 0-10 and 0-100 score ranges (mock data and other sources differ)
  let normalized = score
  if (score > 10) {
    // treat as 0-100 percentage -> convert to 0-10 scale
    normalized = score / 10
  }
  if (normalized >= 7) return "high"
  if (normalized >= 4) return "medium"
  return "low"
}

export function getClickbaitVerdictColor(
  verdict: string
): ColorKey {
  // Accept multiple verdict string formats used across code and mock data
  // e.g. typed labels: "LEGIT" | "MISLEADING" | "CLICKBAIT" | "DISPUTED"
  // or mock/legacy values: "not-clickbait" | "moderate-clickbait" | "highly-clickbait"
  const v = (verdict || "").toString().toLowerCase()
  if (v === "legit" || v === "not-clickbait") return "high"
  if (v === "misleading" || v === "moderate-clickbait" || v === "disputed") return "medium"
  // Dangerous verdicts should map to a warning/negative tone (red)
  if (v === "dangerous" || v === "highly-dangerous" || v === "high-risk") return "low"
  if (v === "clickbait" || v === "highly-clickbait") return "low"
  // Fallback to neutral if unknown
  return "neutral"
}

export function getSentimentColor(
  sentiment: "positive" | "neutral" | "negative"
): ColorKey {
  switch (sentiment) {
    case "positive":
      return "high"
    case "neutral":
      return "neutral"
    case "negative":
      return "low"
  }
  // Fallback for unexpected values
  return "neutral"
}

export function getInsightTypeColor(
  type: "benefit" | "issue" | "gap"
): ColorKey {
  switch (type) {
    case "benefit":
      return "high"
    case "issue":
      return "low"
    case "gap":
      return "medium"
  }
  // Fallback for unexpected insight types
  return "neutral"
}

