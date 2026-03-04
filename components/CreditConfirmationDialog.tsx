import React, { useState, useEffect } from "react"
import type { FreeQueueStatus, FreeQueueSubmitError } from "~types/backend"

interface CreditConfirmationDialogProps {
  isOpen: boolean
  estimatedCredits: number
  currentBalance: number
  hasSufficientCredits: boolean
  userTier: "free" | "starter" | "pro"
  isVerified?: boolean // Email verification status
  freeQueueStatus?: FreeQueueStatus | null
  isFetchingFreeQueueStatus?: boolean
  /** Structured error from a failed free-queue job submission (race or ineligibility). */
  freeQueueError?: FreeQueueSubmitError | null
  onConfirm: () => void
  onFreeQueueConfirm?: () => void
  onCancel: () => void
  onUpgrade?: () => void
  onTopUp?: () => void
  onContactSales?: () => void
  onVerifyEmail?: () => void
}

export const CreditConfirmationDialog = ({
  isOpen,
  estimatedCredits,
  currentBalance,
  hasSufficientCredits,
  userTier,
  isVerified = true,
  freeQueueStatus = null,
  isFetchingFreeQueueStatus = false,
  freeQueueError = null,
  onConfirm,
  onFreeQueueConfirm,
  onCancel,
  onUpgrade,
  onTopUp,
  onContactSales,
  onVerifyEmail
}: CreditConfirmationDialogProps) => {
  const [useFreeQueue, setUseFreeQueue] = useState(false)

  // Reset the opt-in toggle whenever an error arrives (e.g. race condition on submit)
  useEffect(() => {
    if (freeQueueError) {
      setUseFreeQueue(false)
    }
  }, [freeQueueError])

  // Compute hours until the free queue daily reset (prefer status; fall back to error field)
  const resetTimeISO =
    freeQueueStatus?.next_reset_time ?? freeQueueError?.next_reset_time ?? null
  const hoursUntilReset = resetTimeISO
    ? Math.ceil(
        (new Date(resetTimeISO).getTime() - Date.now()) /
          (1000 * 60 * 60)
      )
    : null
  if (!isOpen) return null

  // Show verification prompt for unverified users
  if (isVerified === false) {
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
          zIndex: 10000
        }}>
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "480px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)"
          }}>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📧</div>
            <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#1f2937" }}>
              Verify Your Email First
            </h3>
          </div>
          <p style={{ color: "#6b7280", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
            Please verify your email to unlock video analysis. Check your inbox for the verification link.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            {onVerifyEmail && (
              <button
                onClick={onVerifyEmail}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#2563eb"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#3b82f6"
                }}>
                Resend Verification Email
              </button>
            )}
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "12px 24px",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#e5e7eb"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#f3f4f6"
              }}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

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

            {/* Compact disclaimer about estimate and refunds */}
            <div
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px",
                fontSize: "12px",
                color: "#4b5563",
                lineHeight: "1.4"
              }}>
              <strong>Note:</strong> Credits shown are based on the comments you asked for. Actual
              cost may be lower (free/starter capped at 100), and we try to refund credits if the
              analysis fails.
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
          // Insufficient credits - tier-specific messaging + Free Queue option
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
                marginBottom: "16px"
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

            {/* Free Queue Community Pool section */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px",
                backgroundColor: "#f8fafc"
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "18px" }}>🌐</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Community Free Queue
                </span>
              </div>

              {isFetchingFreeQueueStatus ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "13px" }}>
                  <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid #d1d5db", borderTopColor: "#6b7280", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Checking free queue availability…
                </div>
              ) : freeQueueError ? (
                /* ---- Submission error (race condition / ineligible at submit time) ---- */
                <>
                  {/* Show a prominent error banner */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: freeQueueError.type === 'race_exhausted' ? "#fef2f2" : "#fef3c7",
                      border: `1px solid ${freeQueueError.type === 'race_exhausted' ? "#fecaca" : "#fcd34d"}`,
                      marginBottom: "10px"
                    }}>
                    <span style={{ fontSize: "18px", flexShrink: 0 }}>
                      {freeQueueError.type === 'race_exhausted' ? "🏁" : freeQueueError.type === 'already_used' ? "⏳" : "ℹ️"}
                    </span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: freeQueueError.type === 'race_exhausted' ? "#991b1b" : "#92400e" }}>
                        {freeQueueError.type === 'race_exhausted'
                          ? "Pool filled up — someone got the last slot"
                          : freeQueueError.type === 'already_used'
                          ? "You already used your free slot today"
                          : "Free queue not available"}
                      </div>
                      <div style={{ fontSize: "12px", color: freeQueueError.type === 'race_exhausted' ? "#7f1d1d" : "#78350f", marginTop: "3px", lineHeight: "1.5" }}>
                        {freeQueueError.message}
                      </div>
                    </div>
                  </div>

                  {/* Disabled toggle showing it can no longer be used */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      cursor: "not-allowed",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      opacity: 0.6
                    }}>
                    <input
                      type="checkbox"
                      checked={false}
                      disabled
                      style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#6b7280" }}>
                        Free daily slot unavailable
                      </div>
                      {hoursUntilReset != null && (
                        <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                          🔄 Resets in {hoursUntilReset > 0 ? `${hoursUntilReset} hour${hoursUntilReset === 1 ? "" : "s"}` : "less than 1 hour"} (midnight UTC)
                        </div>
                      )}
                    </div>
                  </label>
                </>
              ) : freeQueueStatus ? (
                <>
                  {/* Capacity progress bar */}
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>Daily pool usage</span>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: freeQueueStatus.remaining === 0 ? "#dc2626" : "#374151" }}>
                        {freeQueueStatus.used_today} / {freeQueueStatus.total_capacity} used
                        {" "}({freeQueueStatus.remaining} remaining)
                      </span>
                    </div>
                    <div style={{ height: "6px", backgroundColor: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "3px",
                          backgroundColor: freeQueueStatus.remaining === 0 ? "#dc2626" : freeQueueStatus.remaining < freeQueueStatus.total_capacity * 0.2 ? "#f59e0b" : "#10b981",
                          width: `${Math.min(100, (freeQueueStatus.used_today / freeQueueStatus.total_capacity) * 100)}%`,
                          transition: "width 0.3s ease"
                        }}
                      />
                    </div>
                  </div>

                  {/* Reset time */}
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px" }}>
                    🔄 Resets in {hoursUntilReset != null && hoursUntilReset > 0 ? `${hoursUntilReset} hour${hoursUntilReset === 1 ? "" : "s"}` : "less than 1 hour"} (midnight UTC)
                  </div>

                  {freeQueueStatus.user_eligible ? (
                    /* Eligible: show opt-in toggle */
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        cursor: "pointer",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: useFreeQueue ? "#eff6ff" : "white",
                        border: `1px solid ${useFreeQueue ? "#3b82f6" : "#d1d5db"}`,
                        transition: "all 0.15s"
                      }}>
                      <input
                        type="checkbox"
                        checked={useFreeQueue}
                        onChange={(e) => setUseFreeQueue(e.target.checked)}
                        style={{ marginTop: "2px", accentColor: "#3b82f6", width: "16px", height: "16px", cursor: "pointer", flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#1f2937" }}>
                          Use my free daily analysis slot
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                          You get one free analysis per day via the community pool. Standard 100-comment analysis. Jobs may take longer as they run on low-priority.
                        </div>
                      </div>
                    </label>
                  ) : (
                    /* Not eligible: explain why */
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: "#fef3c7",
                        border: "1px solid #fcd34d"
                      }}>
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>
                        {freeQueueStatus.remaining === 0 ? "🚫" : "⏳"}
                      </span>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#92400e" }}>
                          {freeQueueStatus.remaining === 0 ? "Daily pool is full" : "Already used today"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#78350f", marginTop: "2px" }}>
                          {freeQueueStatus.eligibility_reason}. Free slots will be available again after reset.
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "13px", color: "#9ca3af" }}>
                  Free queue information unavailable.
                </div>
              )}
            </div>

            {/* Action buttons */}
            {useFreeQueue && freeQueueStatus?.user_eligible ? (
              /* Free queue confirm + cancel */
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
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f9fafb" }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white" }}>
                  Cancel
                </button>
                <button
                  onClick={onFreeQueueConfirm}
                  style={{
                    flex: 2,
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "white",
                    backgroundColor: "#10b981",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#059669" }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#10b981" }}>
                  🌐 Proceed with Free Queue
                </button>
              </div>
            ) : (
              /* Standard upgrade / top-up action buttons */
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
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9" }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1" }}>
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
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f9fafb" }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white" }}>
                    {insufficientContent.secondaryButton.text}
                  </button>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
