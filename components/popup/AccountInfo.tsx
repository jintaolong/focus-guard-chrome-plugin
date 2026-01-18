import type { UserAccount } from "~types/popup"

interface AccountInfoProps {
  account: UserAccount
  onManagePlan: () => void
  onTopUp?: () => void
  onResendVerification?: () => void
}

export const AccountInfo = ({ account, onManagePlan, onTopUp, onResendVerification }: AccountInfoProps) => {
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
    // Email verification prompt (highest priority) - only for unverified users
    if (account.isVerified === false) {
      return {
        type: 'email-verification',
        title: "📧 Verify Your Email",
        message: "Please verify your email address to unlock full access and ensure you receive important updates.",
        cta: "Resend Verification Email",
        color: '#3b82f6',
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    }
    
    // Welcome bonus message for verified users who haven't used their bonus yet
    // Shows for any verified user with credits who hasn't used the bonus
    if (account.isVerified === true && account.welcomeBonusUsed === false && creditsBalance > 0) {
      return {
        type: 'welcome-bonus',
        title: "🎉 Welcome Bonus Awarded!",
        message: `You have ${creditsBalance} bonus credit${creditsBalance === 1 ? '' : 's'} to try Comment Verdict! Analyze a YouTube video to see insights in action.`,
        cta: null,
        color: '#10b981',
        backgroundColor: '#f0fdf4',
        borderColor: '#a7f3d0'
      }
    }
    
    // Low credit warning - only for users who have started using credits (< 5)
    if (creditsBalance < 5 && creditsBalance > 0) {
      return {
        type: 'low-credits',
        title: "Low Credits",
        message: `You have ${creditsBalance} credit${creditsBalance === 1 ? '' : 's'} remaining. Top up for immediate credits or upgrade your plan for a monthly quota.`,
        cta: "Top Up Credits",
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
          ? "You've used all your welcome credits. Top up for immediate credits or upgrade to a plan for a monthly quota."
          : hasMonthlyQuota
            ? `Your credits will reset on ${account.nextResetDate ? new Date(account.nextResetDate).toLocaleDateString() : 'next billing cycle'}. Top up now for immediate access.`
            : "You need credits to analyze videos. Purchase a top-up pack to continue.",
        cta: "Top Up Credits",
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
      <div style={{ marginBottom: "8px" }}>
        <div>
          <p
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#1a1a1a",
              marginBottom: "2px",
              wordBreak: "break-all"
            }}>
            {account.email}
          </p>
          <p style={{ fontSize: "12px", color: "#666" }}>
            {tierLabel}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "12px" }}>
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

        {onTopUp && (
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
              onClick={() => {
                if (milestone.type === 'email-verification' && onResendVerification) {
                  return onResendVerification()
                }
                if (onTopUp) return onTopUp()
                return onManagePlan()
              }}
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
        {/* Library Access Badge (always shown) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }}>
          <span style={{ fontSize: "11px", color: "#666", display: "flex", alignItems: "center", gap: "6px" }}>
            📚 Library Access
          </span>
          <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600", backgroundColor: "#f0fdf4", padding: "2px 8px", borderRadius: "4px" }}>
            Unlimited
          </span>
        </div>

        {/* Credits Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "8px"
          }}>
          <span style={{ fontSize: "13px", color: "#666" }}>
            ⚡ Analysis Credits
          </span>
          <span
            style={{
              fontSize: "22px",
              fontWeight: "700",
              color: creditsBalance === 0 ? "#dc2626" : creditsBalance <= 5 ? "#d97706" : "#10b981"
            }}>
            {creditsBalance}
          </span>
        </div>

        {/* Monthly Quota Bar (for Starter/Pro) - Thin bar showing monthly credits */}
        {hasMonthlyQuota && monthlyQuota > 0 && (
          <>
            <div style={{ marginBottom: "4px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px"
                }}>
                <span style={{ fontSize: "11px", color: "#666" }}>
                  Monthly Quota
                </span>
                <span style={{ fontSize: "11px", color: "#666" }}>
                  {Math.max(0, creditsBalance)} / {monthlyQuota}
                </span>
              </div>
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
                    width: `${Math.min(100, (Math.max(0, creditsBalance) / monthlyQuota) * 100)}%`,
                    height: "100%",
                    backgroundColor: creditsBalance === 0 ? "#dc2626" : creditsBalance <= monthlyQuota * 0.2 ? "#d97706" : "#3b82f6",
                    transition: "width 0.3s ease, background-color 0.3s ease"
                  }}
                />
              </div>
            </div>
            <p
              style={{
                fontSize: "10px",
                color: "#999",
                marginBottom: "8px"
              }}>
              {account.nextResetDate && `Resets ${new Date(account.nextResetDate).toLocaleDateString()}`}
              {creditsBalance > monthlyQuota && ` • ${creditsBalance - monthlyQuota} from top-ups`}
            </p>
          </>
        )}

        {/* For Free users, show breakdown of purchased credits if any */}
        {isFree && (
          <p
            style={{
              fontSize: "11px",
              color: "#999"
            }}>
            {account.purchasedCredits && account.purchasedCredits > 0 
              ? `${creditsBalance - (account.purchasedCredits || 0)} welcome • ${account.purchasedCredits} purchased`
              : "Welcome credits • Upgrade for monthly quota"
            }
          </p>
        )}
      </div>
    </div>
  )
}
