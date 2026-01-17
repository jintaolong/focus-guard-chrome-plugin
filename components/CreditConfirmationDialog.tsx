import React from "react"

interface CreditConfirmationDialogProps {
  isOpen: boolean
  estimatedCredits: number
  currentBalance: number
  hasSufficientCredits: boolean
  userTier: "free" | "starter" | "pro"
  onConfirm: () => void
  onCancel: () => void
  onUpgrade?: () => void
  onTopUp?: () => void
  onContactSales?: () => void
}

export const CreditConfirmationDialog = ({
  isOpen,
  estimatedCredits,
  currentBalance,
  hasSufficientCredits,
  userTier,
  onConfirm,
  onCancel,
  onUpgrade,
  onTopUp,
  onContactSales
}: CreditConfirmationDialogProps) => {
  if (!isOpen) return null

  // Tier-specific messaging for insufficient credits
  const getInsufficientCreditsContent = () => {
    if (userTier === "free") {
      return {
        icon: "🎯",
        title: "Unlock Video Analysis",
        message: "You've used all your welcome credits! Upgrade to continue analyzing videos with instant access.",
        primaryButton: {
          text: "Upgrade to Starter ($3.99/mo)",
          action: onUpgrade,
          color: "#3b82f6"
        },
        secondaryButton: {
          text: "View Community Verdict",
          action: onCancel,
          color: "#6b7280"
        }
      }
    } else if (userTier === "starter") {
      return {
        icon: "⚡",
        title: "More Credits Needed",
        message: `This analysis requires ${estimatedCredits} credits, but you only have ${currentBalance}. Top up for immediate credits or upgrade to Pro for a larger monthly quota.`,
        primaryButton: {
          text: "Top Up Credits",
          action: onTopUp,
          color: "#10b981"
        },
        secondaryButton: {
          text: "Upgrade to Pro",
          action: onUpgrade,
          color: "#3b82f6"
        }
      }
    } else { // pro
      return {
        icon: "💎",
        title: "Additional Credits Required",
        message: `This analysis requires ${estimatedCredits} credits, but you only have ${currentBalance}. Purchase a top-up pack for immediate access, or contact sales for enterprise plans.`,
        primaryButton: {
          text: "Purchase Credits",
          action: onTopUp,
          color: "#10b981"
        },
        secondaryButton: {
          text: "Contact Sales",
          action: onContactSales,
          color: "#6b7280"
        }
      }
    }
  }

  const insufficientContent = !hasSufficientCredits ? getInsufficientCreditsContent() : null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "480px",
          width: "90%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}>
        {hasSufficientCredits ? (
          // Confirmation for sufficient credits
          <>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>⚡</div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginBottom: "8px"
                }}>
                Confirm Analysis
              </h3>
              <p style={{ fontSize: "14px", color: "#666", lineHeight: "1.5" }}>
                This analysis will use{" "}
                <strong style={{ color: "#3b82f6" }}>
                  {estimatedCredits} credit{estimatedCredits === 1 ? "" : "s"}
                </strong>
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#f9fafb",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px"
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "#666" }}>Current Balance</span>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: currentBalance <= 5 ? "#d97706" : "#10b981"
                  }}>
                  {currentBalance} credits
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#666" }}>After Analysis</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a1a" }}>
                  {currentBalance - estimatedCredits} credits
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#6b7280",
                  backgroundColor: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "white"
                }}>
                Cancel
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "white",
                  backgroundColor: "#3b82f6",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#2563eb"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#3b82f6"
                }}>
                Proceed
              </button>
            </div>
          </>
        ) : insufficientContent ? (
          // Insufficient credits - tier-specific messaging
          <>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>{insufficientContent.icon}</div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginBottom: "8px"
                }}>
                {insufficientContent.title}
              </h3>
              <p style={{ fontSize: "14px", color: "#666", lineHeight: "1.6" }}>
                {insufficientContent.message}
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px"
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "#666" }}>Credits Needed</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#dc2626" }}>
                  {estimatedCredits}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#666" }}>Current Balance</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#dc2626" }}>
                  {currentBalance}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={insufficientContent.primaryButton.action}
                style={{
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "white",
                  backgroundColor: insufficientContent.primaryButton.color,
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1"
                }}>
                {insufficientContent.primaryButton.text}
              </button>
              {insufficientContent.secondaryButton && (
                <button
                  onClick={insufficientContent.secondaryButton.action}
                  style={{
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: insufficientContent.secondaryButton.color,
                    backgroundColor: "white",
                    border: `1px solid ${insufficientContent.secondaryButton.color}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f9fafb"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "white"
                  }}>
                  {insufficientContent.secondaryButton.text}
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
