// Tier restriction types from backend

export interface TierRestriction {
  code: "TIER_RESTRICTION"
  required_tier: "starter" | "pro"
  current_tier: "free" | "starter" | "pro"
  message: string
  upgrade_url: string
}

export function isTierRestriction(error: any): error is TierRestriction {
  return error && error.code === "TIER_RESTRICTION"
}
