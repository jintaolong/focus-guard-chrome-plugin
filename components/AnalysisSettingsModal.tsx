import { useState, useEffect } from "react"
import { COLORS } from "~lib/colors"
import { FocusGuardAPI } from "~lib/api"
import type { FocusGuardSettings } from "~types/popup"

interface AnalysisSettingsModalProps {
  isOpen: boolean
  settings: FocusGuardSettings
  onClose: () => void
  onApply: (maxComments: number, customContext?: string, forceRefresh?: boolean) => void
}

export const AnalysisSettingsModal = ({
  isOpen,
  settings,
  onClose,
  onApply
}: AnalysisSettingsModalProps) => {
  const [commentDepth, setCommentDepth] = useState(settings.videoAnalysis?.maxCommentDepth || 100)
  const [customContext, setCustomContext] = useState("")
  const [forceRefresh, setForceRefresh] = useState(false)
  const [estimatedCredits, setEstimatedCredits] = useState(1)
  const [currentBalance, setCurrentBalance] = useState(0)

  useEffect(() => {
    if (isOpen) {
      // Load current credit balance
      FocusGuardAPI.getCreditBalance()
        .then(data => setCurrentBalance(data.credits_balance))
        .catch(err => console.error("Failed to load credit balance:", err))
    }
  }, [isOpen])

  useEffect(() => {
    // Calculate estimated credits whenever settings change
    const hasCustomContext = customContext.trim().length > 0
    const estimated = Math.ceil(commentDepth / 100) + (hasCustomContext ? 1 : 0)
    setEstimatedCredits(estimated)
  }, [commentDepth, customContext])

  if (!isOpen) return null

  const handleApply = () => {
    onApply(commentDepth, customContext.trim() || undefined, forceRefresh)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 10002,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "420px",
          maxHeight: "90vh",
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          zIndex: 10003,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          overflow: "hidden"
        }}>
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            backgroundColor: COLORS.neutral.dark,
            color: "white"
          }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>⚙️</span>
              Analysis Settings
            </h3>
            <span style={{ fontSize: "11px", backgroundColor: COLORS.neutral.primary, padding: "4px 8px", borderRadius: "6px", fontWeight: "700" }}>
              PRO
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255, 255, 255, 0.8)" }}>
            Configure how AI processes this video
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", overflowY: "auto", maxHeight: "calc(90vh - 180px)" }}>
          {/* Comment Depth Slider */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: COLORS.ui.text.primary, display: "flex", alignItems: "center", gap: "6px" }}>
                <span>💬</span>
                Comment Depth
              </label>
              <span style={{ fontSize: "12px", fontWeight: "700", color: COLORS.neutral.primary, backgroundColor: COLORS.neutral.light, padding: "4px 10px", borderRadius: "6px" }}>
                {commentDepth} Comments
              </span>
            </div>
            <input
              type="range"
              min="100"
              max="1000"
              step="100"
              value={commentDepth}
              onChange={(e) => setCommentDepth(parseInt(e.target.value))}
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "4px",
                outline: "none",
                cursor: "pointer",
                accentColor: COLORS.neutral.primary
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: COLORS.ui.text.secondary, marginTop: "6px", fontWeight: "600" }}>
              <span>Fast (100)</span>
              <span>Deep (1000)</span>
            </div>
          </div>

          {/* Custom Context */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ fontSize: "13px", fontWeight: "700", color: COLORS.ui.text.primary, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🎯</span>
              Custom Perspective
              <span style={{ fontSize: "10px", fontWeight: "400", color: COLORS.ui.text.secondary }}>
                (Optional)
              </span>
            </label>
            <textarea
              placeholder="e.g. Focus on battery life concerns or pricing fairness..."
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "13px",
                backgroundColor: COLORS.ui.surface,
                border: `1px solid ${COLORS.ui.border}`,
                borderRadius: "8px",
                outline: "none",
                resize: "vertical",
                minHeight: "80px",
                fontFamily: "inherit",
                color: COLORS.ui.text.primary
              }}
            />
          </div>

          {/* Force Refresh Option */}
          <div
            style={{
              padding: "12px",
              backgroundColor: COLORS.neutral.light,
              borderRadius: "8px",
              border: `1px solid ${COLORS.neutral.primary}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
              opacity: 0.5,
              cursor: "not-allowed"
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>🔄</span>
              <div>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: COLORS.ui.text.primary }}>
                  Force Refresh
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: COLORS.ui.text.secondary }}>
                  Sync latest 24h comments
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              disabled={true}
              style={{
                width: "18px",
                height: "18px",
                cursor: "not-allowed"
              }}
            />
          </div>

          {/* Cost Summary */}
          <div
            style={{
              paddingTop: "20px",
              borderTop: `1px solid ${COLORS.ui.border}`
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: COLORS.ui.text.secondary }}>
                Total Credits:
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "20px" }}>⚡</span>
                <span style={{ fontSize: "28px", fontWeight: "900", color: COLORS.ui.text.primary }}>
                  {estimatedCredits}
                </span>
              </div>
            </div>

            <button
              onClick={handleApply}
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "14px",
                fontWeight: "700",
                color: "white",
                backgroundColor: COLORS.neutral.primary,
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                boxShadow: `0 4px 12px ${COLORS.neutral.primary}40`,
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.neutral.dark
                e.currentTarget.style.transform = "translateY(-1px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.neutral.primary
                e.currentTarget.style.transform = "translateY(0)"
              }}>
              RUN ANALYSIS
            </button>

            <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: COLORS.ui.text.secondary, textAlign: "center" }}>
              Available Credits: <span style={{ fontWeight: "700", color: COLORS.ui.text.primary }}>{currentBalance}</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
