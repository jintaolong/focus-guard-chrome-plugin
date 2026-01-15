import type { UserAccount } from "~types/popup"

interface AccountInfoProps {
  account: UserAccount
  onManagePlan: () => void
  onTopUp?: () => void
}

export const AccountInfo = ({ account, onManagePlan, onTopUp }: AccountInfoProps) => {
  const isPro = account.tier === "pro"
  const isStarter = account.tier === "starter"
  const isFree = account.tier === "free"
  const hasMonthlyQuota = isStarter || isPro
  
  const creditsBalance = account.creditsBalance || 0
  const monthlyQuota = account.monthlyQuota || 0
  
  // Calculate usage percentages for visual bars
  const monthlyUsagePercent = hasMonthlyQuota && monthlyQuota > 0
    ? Math.min(100, ((monthlyQuota - creditsBalance) / monthlyQuota) * 100)
    : 0

  // Debug: log account values
  console.log("AccountInfo: Rendering with values:", {
    tier: account.tier,
    creditsBalance,
    monthlyQuota,
    monthlyUsagePercent: monthlyUsagePercent.toFixed(1) + "%"
  })

  // Tier display labels
  const tierLabel = isPro ? "⭐ Pro Plan" : isStarter ? "🌱 Starter Plan" : "🆓 Free Plan"
  
  // Button text based on tier
  const getManagePlanText = () => {
    if (isFree) return "Upgrade Plan"
    return "Manage Plan"
  }

  // Credit milestone detection
  const getCreditMilestone = () => {
    // Low credit warning for all tiers
    if (creditsBalance <= 5 && creditsBalance > 0) {
      return {
        type: 'low-credits',
        title: "Low Credits",
        message: `You have ${creditsBalance} credit${creditsBalance === 1 ? '' : 's'} remaining. ${isFree ? 'Upgrade to get more credits!' : 'Consider topping up to continue analyzing videos.'}`,
        cta: isFree ? "Upgrade Plan" : "Top Up Credits",
        color: '#d97706',
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a'
      }
    }
    
    // Out of credits
    if (creditsBalance === 0) {
      return {
        type: 'no-credits',
        title: "Out of Credits",
        message: isFree 
          ? "You've used all your welcome credits. Upgrade to continue analyzing videos!" 
          : hasMonthlyQuota 
            ? `Your credits will reset on ${account.nextResetDate ? new Date(account.nextResetDate).toLocaleDateString() : 'next billing cycle'}. Top up now for immediate access.`
            : "You need credits to analyze videos. Purchase a top-up pack to continue.",
        cta: isFree ? "Upgrade Plan" : "Top Up Credits",
        color: '#dc2626',
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca'
      }
    }
    
    return null
  }

  const milestone = getCreditMilestone()

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
        <div style={{ display: "flex", gap: "8px" }}>
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
            {getManagePlanText()}
          </button>
          {!isFree && onTopUp && (
            <button
              onClick={onTopUp}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                color: "white",
                backgroundColor: "#10b981",
                border: "1px solid #10b981",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#059669"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#10b981"
              }}>
              Top Up
            </button>
          )}
        </div>
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
              onClick={isFree || milestone.cta.includes("Upgrade") ? onManagePlan : onTopUp}
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

      {/* Credit Display */}
      <div>
        {/* Total Credits */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px"
          }}>
          <span style={{ fontSize: "13px", color: "#666", display: "flex", alignItems: "center", gap: "6px" }}>
            ⚡ Total Credits
            <span style={{ fontSize: "10px", color: "#999", backgroundColor: "#f0f0f0", padding: "2px 6px", borderRadius: "4px" }}>
              Library Access: Unlimited
            </span>
          </span>
          <span
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: creditsBalance === 0 ? "#dc2626" : creditsBalance <= 5 ? "#d97706" : "#10b981"
            }}>
            {creditsBalance}
          </span>
        </div>

        {/* Monthly Quota Bar (for Starter/Pro) */}
        {hasMonthlyQuota && monthlyQuota > 0 && (
          <>
            <div
              style={{
                width: "100%",
                height: "8px",
                backgroundColor: "#e5e5e5",
                borderRadius: "4px",
                overflow: "hidden",
                marginBottom: "4px"
              }}>
              <div
                style={{
                  width: `${Math.max(0, 100 - monthlyUsagePercent)}%`,
                  height: "100%",
                  backgroundColor: "#3b82f6",
                  transition: "width 0.3s ease"
                }}
              />
            </div>
            <p
              style={{
                fontSize: "11px",
                color: "#999",
                marginBottom: "8px"
              }}>
              Monthly Quota: {monthlyQuota} credits
              {account.nextResetDate && ` • Resets ${new Date(account.nextResetDate).toLocaleDateString()}`}
            </p>
          </>
        )}

        {/* For Free users, show simple balance */}
        {isFree && (
          <p
            style={{
              fontSize: "11px",
              color: "#999"
            }}>
            Welcome credits • No monthly quota
          </p>
        )}
      </div>
    </div>
  )
}
