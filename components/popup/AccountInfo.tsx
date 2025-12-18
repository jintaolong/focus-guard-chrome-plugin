import type { UserAccount } from "~types/popup"

interface AccountInfoProps {
  account: UserAccount
  onManagePlan: () => void
}

export const AccountInfo = ({ account, onManagePlan }: AccountInfoProps) => {
  const isPro = account.tier === "pro"
  const isStarter = account.tier === "starter"
  const isFree = account.tier === "free"
  const hasLimits = !isPro // Free and Starter both have limits
  
  const usagePercent = hasLimits && account.dailySearchesLimit > 0
    ? (account.searchesUsedToday / account.dailySearchesLimit) * 100
    : 0

  // Debug: log account values
  console.log("AccountInfo: Rendering with values:", {
    tier: account.tier,
    dailySearchesLimit: account.dailySearchesLimit,
    searchesUsedToday: account.searchesUsedToday,
    searchesRemaining: account.searchesRemaining,
    usagePercent: usagePercent.toFixed(1) + "%",
    calculatedRemaining: Math.max(0, account.dailySearchesLimit - account.searchesUsedToday)
  })

  // Tier display labels
  const tierLabel = isPro ? "⭐ Pro Plan" : isStarter ? "🌱 Starter Plan" : "🆓 Free Plan"
  
  // Button text based on tier
  const getButtonText = () => {
    if (isFree) return "Upgrade Plan"
    if (isStarter) return "Manage Plan"
    if (isPro) return "Manage Plan"
    return "Manage Plan"
  }

  // Usage milestone detection
  const getUsageMilestone = () => {
    // For PRO users (100 daily limit)
    if (isPro) {
      const proUsagePercent = account.dailySearchesLimit > 0
        ? (account.searchesUsedToday / account.dailySearchesLimit) * 100
        : 0
      
      // Hit 100% cap (100 reports)
      if (account.searchesUsedToday >= account.dailySearchesLimit) {
        return {
          type: 'pro-cap',
          title: "You're a Power User!",
          message: "You've analyzed 100 videos in the last 24 hours. To protect our systems from automated activity, we've placed a temporary pause on your reports. Your quota will reset at midnight UTC.",
          cta: "Need more? Contact us for Enterprise access.",
          color: '#d97706',
          backgroundColor: '#fffbeb',
          borderColor: '#fde68a'
        }
      }
      // 80% milestone (80 reports)
      else if (proUsagePercent >= 80) {
        return {
          type: 'pro-80',
          title: null,
          message: "You've been busy today! You've analyzed " + account.searchesUsedToday + " videos. Keep going!",
          cta: null,
          color: '#16a34a',
          backgroundColor: '#f0fdf4',
          borderColor: '#bbf7d0'
        }
      }
    }
    
    // For FREE and STARTER users who hit their limit
    if ((isFree || isStarter) && account.searchesRemaining === 0) {
      const upgradeTier = isFree ? "STARTER or PRO" : "PRO"
      const upgradeMessage = isFree ? "more searches" : "unlimited access"
      return {
        type: 'limit-reached',
        title: "Daily Limit Reached",
        message: `You've used all ${account.dailySearchesLimit} of your daily searches. Your quota will reset at midnight UTC. Upgrade to ${upgradeTier} for ${upgradeMessage}.`,
        cta: `Upgrade to ${upgradeTier}`,
        color: '#d97706',
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a'
      }
    }
    
    return null
  }

  const milestone = getUsageMilestone()

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#f9fafb",
        borderRadius: "12px",
        marginBottom: "16px"
      }}>
      {/* Email & Tier */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px"
        }}>
        <div>
          <p
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#1a1a1a",
              marginBottom: "2px"
            }}>
            {account.email}
          </p>
          <p style={{ fontSize: "12px", color: "#666" }}>
            {tierLabel}
          </p>
        </div>
        <button
          onClick={onManagePlan}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "600",
            color: "#3b82f6",
            backgroundColor: "white",
            border: "1px solid #3b82f6",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#3b82f6"
            e.currentTarget.style.color = "white"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white"
            e.currentTarget.style.color = "#3b82f6"
          }}>
          {getButtonText()}
        </button>
      </div>

      {/* Usage Milestone Notification */}
      {milestone && (
        <div
          style={{
            marginBottom: "12px",
            padding: "12px",
            backgroundColor: milestone.backgroundColor,
            border: `1px solid ${milestone.borderColor}`,
            borderRadius: "8px"
          }}>
          {milestone.title && (
            <p
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: milestone.color,
                marginBottom: "6px"
              }}>
              {milestone.title}
            </p>
          )}
          <p
            style={{
              fontSize: "12px",
              color: milestone.color,
              marginBottom: milestone.cta ? "8px" : "0",
              lineHeight: "1.4"
            }}>
            {milestone.message}
          </p>
          {milestone.cta && (
            <button
              onClick={onManagePlan}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "12px",
                fontWeight: "600",
                color: "white",
                backgroundColor: milestone.color,
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1"
              }}>
              {milestone.cta}
            </button>
          )}
        </div>
      )}

      {/* Usage Stats for Free and Starter */}
      {hasLimits && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px"
            }}>
            <span style={{ fontSize: "13px", color: "#666" }}>
              AI Searches Today
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#666"
              }}>
              {account.searchesRemaining} remaining
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "#e5e5e5",
              borderRadius: "3px",
              overflow: "hidden"
            }}>
            <div
              style={{
                width: `${usagePercent}%`,
                height: "100%",
                backgroundColor:
                  account.searchesRemaining === 0 ? "#dc2626" : "#3b82f6",
                transition: "width 0.3s ease"
              }}
            />
          </div>

          <p
            style={{
              marginTop: "6px",
              fontSize: "11px",
              color: "#999"
            }}>
            Resets at {new Date(account.resetTime).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Pro Benefits */}
      {isPro && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px",
            backgroundColor: "#fef3c7",
            borderRadius: "6px"
          }}>
          <span style={{ fontSize: "16px" }}>✨</span>
          <span style={{ fontSize: "12px", color: "#92400e" }}>
            Unlimited AI searches & all features unlocked
          </span>
        </div>
      )}
    </div>
  )
}
