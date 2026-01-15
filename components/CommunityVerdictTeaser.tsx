import { COLORS } from "~lib/colors"

interface CommunityVerdictTeaserProps {
  onUpgrade: () => void
  onRequestAnalysis?: () => void
}

export const CommunityVerdictTeaser = ({ onUpgrade, onRequestAnalysis }: CommunityVerdictTeaserProps) => {
  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "400px",
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
        zIndex: 10001,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        overflow: "hidden"
      }}>
      {/* Header */}
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          backgroundColor: COLORS.ui.surface
        }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔍</div>
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "700",
            color: COLORS.ui.text.primary
          }}>
          Community Verdict Pending
        </h2>
      </div>

      {/* Content */}
      <div style={{ padding: "24px" }}>
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: "14px",
            color: COLORS.ui.text.secondary,
            lineHeight: "1.6",
            textAlign: "center"
          }}>
          This video hasn't been verified by the community yet.
        </p>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            onClick={onUpgrade}
            style={{
              width: "100%",
              padding: "14px",
              fontSize: "14px",
              fontWeight: "700",
              color: "white",
              backgroundColor: COLORS.neutral.primary,
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.neutral.dark
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.neutral.primary
            }}>
            Upgrade to Starter to Analyze Instantly
          </button>

          {onRequestAnalysis && (
            <button
              onClick={onRequestAnalysis}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "14px",
                fontWeight: "600",
                color: COLORS.neutral.primary,
                backgroundColor: "white",
                border: `2px solid ${COLORS.neutral.primary}`,
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.ui.surface
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white"
              }}>
              Request Analysis (Notify Me When Available)
            </button>
          )}
        </div>

        {/* Info Text */}
        <p
          style={{
            margin: "20px 0 0 0",
            fontSize: "12px",
            color: COLORS.ui.text.secondary,
            textAlign: "center",
            lineHeight: "1.4"
          }}>
          💡 <strong>Library Access:</strong> Unlimited access to the Community Library
          (already analyzed videos).
        </p>
      </div>
    </div>
  )
}
