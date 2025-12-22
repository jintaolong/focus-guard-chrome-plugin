// Reusable upgrade prompt component for tier-restricted content

import { COLORS } from "~lib/colors"
import { ConfigService } from "~lib/config"
import type { TierRestriction } from "~types/tierRestriction"

interface UpgradePromptProps {
  restriction: TierRestriction
  blur?: boolean
  onUpgrade?: () => void
}

export const UpgradePrompt = ({ restriction, blur = false, onUpgrade }: UpgradePromptProps) => {
  // Guard against null restriction
  if (!restriction) {
    console.error("UpgradePrompt: restriction is null")
    return null
  }

  const handleUpgrade = async () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      // Get portal URL from config service (supports dynamic remote config)
      const config = await ConfigService.getConfig()
      const dashboardUrl = `${config.portal_url}/dashboard`
      console.log("Opening dashboard:", dashboardUrl)
      try {
        await chrome.runtime.sendMessage({
          type: 'OPEN_TAB',
          url: dashboardUrl
        })
      } catch (error) {
        console.error("Failed to open dashboard tab:", error)
      }
    }
  }

  const tierBadgeColor = restriction.required_tier === "pro" 
    ? COLORS.high.primary 
    : COLORS.medium.primary

  const tierBadgeBg = restriction.required_tier === "pro" 
    ? COLORS.high.light 
    : COLORS.medium.light

  return (
    <div
      style={{
        position: "relative",
        padding: blur ? "80px 24px" : "48px 24px",
        textAlign: "center",
        backgroundColor: COLORS.ui.surface,
        borderRadius: "12px",
        border: `2px solid ${COLORS.ui.border}`,
        backdropFilter: blur ? "blur(8px)" : "none"
      }}>
      {/* Lock Icon */}
      <div
        style={{
          fontSize: "48px",
          marginBottom: "16px",
          opacity: 0.6
        }}>
        🔒
      </div>

      {/* Tier Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 16px",
          backgroundColor: tierBadgeBg,
          borderRadius: "20px",
          marginBottom: "16px",
          border: `2px solid ${tierBadgeColor}`
        }}>
        <span
          style={{
            fontSize: "14px",
            fontWeight: "700",
            color: tierBadgeColor,
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
          {restriction.required_tier} Feature
        </span>
      </div>

      {/* Message */}
      <h3
        style={{
          margin: "0 0 12px 0",
          fontSize: "18px",
          fontWeight: "600",
          color: COLORS.ui.textPrimary
        }}>
        Upgrade Required
      </h3>
      <p
        style={{
          margin: "0 0 24px 0",
          fontSize: "14px",
          lineHeight: "1.6",
          color: COLORS.ui.textSecondary,
          maxWidth: "360px",
          marginLeft: "auto",
          marginRight: "auto"
        }}>
        {restriction.message}
      </p>

      {/* Current vs Required Tier */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          marginBottom: "24px",
          fontSize: "13px"
        }}>
        <div>
          <span style={{ color: COLORS.ui.textSecondary }}>Current: </span>
          <span
            style={{
              fontWeight: "600",
              color: COLORS.low.primary,
              textTransform: "capitalize"
            }}>
            {restriction.current_tier}
          </span>
        </div>
        <div style={{ color: COLORS.ui.border }}>→</div>
        <div>
          <span style={{ color: COLORS.ui.textSecondary }}>Required: </span>
          <span
            style={{
              fontWeight: "600",
              color: tierBadgeColor,
              textTransform: "capitalize"
            }}>
            {restriction.required_tier}
          </span>
        </div>
      </div>

      {/* Upgrade Button */}
      <button
        onClick={handleUpgrade}
        style={{
          padding: "12px 32px",
          fontSize: "14px",
          fontWeight: "600",
          color: "white",
          backgroundColor: tierBadgeColor,
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "all 0.2s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)"
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)"
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
        }}>
        Upgrade to {restriction.required_tier.charAt(0).toUpperCase() + restriction.required_tier.slice(1)}
      </button>
    </div>
  )
}

// Blurred content overlay variant
export const BlurredContent = ({ 
  restriction, 
  children,
  onUpgrade 
}: { 
  restriction: TierRestriction
  children: React.ReactNode
  onUpgrade?: () => void
}) => {
  return (
    <div style={{ 
      padding: "24px", 
      position: "relative",
      minHeight: "calc(100vh - 200px)",
      height: "100%"
    }}>
      {/* Blurred background content */}
      <div
        style={{
          filter: "blur(12px)",
          opacity: 0.3,
          pointerEvents: "none",
          userSelect: "none"
        }}>
        {children}
      </div>

      {/* Overlay with upgrade prompt */}
      <div
        style={{
          position: "absolute",
          top: "24px",
          left: "24px",
          right: "24px",
          bottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(4px)"
        }}>
        <UpgradePrompt restriction={restriction} onUpgrade={onUpgrade} />
      </div>
    </div>
  )
}
