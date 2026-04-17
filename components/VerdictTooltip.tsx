/**
 * VerdictTooltip — Cloud-chat bubble shown above the toggle button
 * after free verdict analysis completes (for ALL users).
 *
 * Shows: verdict badge, short reason, CTA to run sentiment analysis.
 * When sentiment is done, shows a mini sentiment bar with percentages.
 * PRO users also get a "View Full Analysis" CTA to open the side panel.
 */
import { useState } from "react"

interface SentimentSummary {
  positive_pct: number
  neutral_pct: number
  negative_pct: number
  dominant_sentiment?: string
}

interface VerdictTooltipProps {
  verdict: string
  reasoning: string
  onRunSentiment: () => void
  onViewFullAnalysis?: () => void  // only shown for PRO users
  onDismiss: () => void
  dock: "left" | "right"
  isSentimentRunning?: boolean
  isSentimentDone?: boolean
  sentimentSummary?: SentimentSummary | null
  isPro?: boolean
  /** Guest (unregistered) user — show register CTA */
  isGuest?: boolean
  /** Registered free-tier user — show upgrade CTA */
  isFreeTier?: boolean
  /** Open registration page */
  onRegister?: () => void
  /** Open upgrade page */
  onUpgrade?: () => void
}

const VERDICT_COLORS: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  LEGIT:          { bg: "#D1FAE5", text: "#065F46", border: "#10B981", emoji: "✅" },
  DISPUTED:       { bg: "#FEF9C3", text: "#854D0E", border: "#EAB308", emoji: "⚠️" },
  MISLEADING:     { bg: "#FFEDD5", text: "#9A3412", border: "#F97316", emoji: "🔶" },
  CLICKBAIT:      { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444", emoji: "🚨" },
  DANGEROUS:      { bg: "#FEE2E2", text: "#7F1D1D", border: "#991B1B", emoji: "🛑" },
  MIXED:          { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6", emoji: "🔍" },
  LIMIT_REACHED:  { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B", emoji: "⏳" },
  UNKNOWN:        { bg: "#F1F5F9", text: "#475569", border: "#94A3B8", emoji: "❓" },
}

export const VerdictTooltip = ({
  verdict,
  reasoning,
  onRunSentiment,
  onViewFullAnalysis,
  onDismiss,
  dock,
  isSentimentRunning = false,
  isSentimentDone = false,
  sentimentSummary = null,
  isPro = false,
  isGuest = false,
  isFreeTier = false,
  onRegister,
  onUpgrade,
}: VerdictTooltipProps) => {
  const [hoverSentiment, setHoverSentiment] = useState(false)
  const [hoverFullAnalysis, setHoverFullAnalysis] = useState(false)

  const verdictUpper = (verdict || "UNKNOWN").toUpperCase()
  const vc = VERDICT_COLORS[verdictUpper] ?? VERDICT_COLORS.UNKNOWN
  const isLimitReached = verdictUpper === "LIMIT_REACHED"
  const isGenericReasoning = /insufficient relevant comments/i.test(reasoning)
  const displayReasoning = isGenericReasoning
    ? "Not enough relevant comments were found to provide detailed reasoning."
    : (reasoning || "")

  // Cloud shape: the "tail-corner" is on the dock side (less rounded there)
  const cloudRadius = dock === "right"
    ? "22px 20px 22px 10px"
    : "20px 22px 10px 22px"

  return (
    <div
      style={{
        position: "fixed",
        [dock]: "80px",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 10001,
        maxWidth: "320px",
        minWidth: "240px",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        animation: "cv-tooltip-in 0.25s ease-out",
      }}>
      <style>{`
        @keyframes cv-tooltip-in {
          from { opacity: 0; transform: translateY(-50%) scale(0.92); }
          to   { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        @keyframes cv-tooltip-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Thought-bubble trail — three decreasing circles pointing toward the toggle */}
      <div style={{
        position: "absolute",
        [dock]: "-13px", top: "50%", transform: "translateY(-50%)",
        width: "10px", height: "10px", borderRadius: "50%",
        background: "#0f172a",
        boxShadow: "0 1px 6px rgba(0,0,0,0.35)",
      }} />
      <div style={{
        position: "absolute",
        [dock]: "-22px", top: "50%", transform: "translateY(-50%)",
        width: "6px", height: "6px", borderRadius: "50%",
        background: "#0f172a",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }} />
      <div style={{
        position: "absolute",
        [dock]: "-29px", top: "50%", transform: "translateY(-50%)",
        width: "4px", height: "4px", borderRadius: "50%",
        background: "#0f172a",
      }} />

      {/* Main cloud bubble */}
      <div
        style={{
          position: "relative",
          backgroundColor: "#0f172a",
          borderRadius: cloudRadius,
          padding: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.05)",
          color: "white",
        }}>

        {/* Close button */}
        <button
          onClick={onDismiss}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "50%",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            fontSize: "12px",
            lineHeight: 1,
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)" }}>
          ✕
        </button>

        {/* Verdict badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", marginRight: "20px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              backgroundColor: vc.bg,
              color: vc.text,
              border: `1.5px solid ${vc.border}`,
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "800",
              letterSpacing: "0.03em",
              lineHeight: 1,
            }}>
            <span style={{ fontSize: "13px" }}>{vc.emoji}</span>
            {isLimitReached ? "DAILY LIMIT" : verdictUpper}
          </span>
        </div>

        {/* Reasoning */}
        {displayReasoning && (
          <p style={{
            margin: "0 0 12px",
            fontSize: "12px",
            lineHeight: "1.5",
            color: "rgba(255,255,255,0.8)",
          }}>
            {displayReasoning}
          </p>
        )}

        {/* CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {/* Sentiment CTA — or results if done (hidden when daily limit reached) */}
          {!isLimitReached && (!isSentimentDone ? (
            <button
              onClick={onRunSentiment}
              disabled={isSentimentRunning}
              onMouseEnter={() => setHoverSentiment(true)}
              onMouseLeave={() => setHoverSentiment(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                padding: "8px 12px",
                backgroundColor: isSentimentRunning
                  ? "rgba(59,130,246,0.3)"
                  : hoverSentiment
                    ? "#2563eb"
                    : "#1d4ed8",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: isSentimentRunning ? "wait" : "pointer",
                transition: "background-color 0.15s",
              }}>
              {isSentimentRunning ? (
                <>
                  <span style={{
                    display: "inline-block",
                    width: "12px", height: "12px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "cv-tooltip-spin 0.8s linear infinite",
                  }} />
                  Running sentiment…
                </>
              ) : (
                <>💬 Check sentiment?</>
              )}
            </button>
          ) : (
            /* Sentiment done — show mini distribution */
            <div style={{
              padding: "8px 10px",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: "8px",
            }}>
              <div style={{
                fontSize: "11px",
                color: "#10b981",
                fontWeight: "700",
                marginBottom: sentimentSummary ? "6px" : "0",
              }}>
                ✓ Sentiment analysis complete
              </div>
              {sentimentSummary && (
                <>
                  {/* Mini stacked bar */}
                  <div style={{
                    display: "flex",
                    height: "5px",
                    borderRadius: "3px",
                    overflow: "hidden",
                    marginBottom: "5px",
                    gap: "1px",
                  }}>
                    <div style={{ flex: sentimentSummary.positive_pct, background: "#10b981", minWidth: sentimentSummary.positive_pct > 0 ? "2px" : "0" }}
                      title={`Positive ${sentimentSummary.positive_pct}%`} />
                    <div style={{ flex: sentimentSummary.neutral_pct, background: "#64748b", minWidth: sentimentSummary.neutral_pct > 0 ? "2px" : "0" }}
                      title={`Neutral ${sentimentSummary.neutral_pct}%`} />
                    <div style={{ flex: sentimentSummary.negative_pct, background: "#ef4444", minWidth: sentimentSummary.negative_pct > 0 ? "2px" : "0" }}
                      title={`Negative ${sentimentSummary.negative_pct}%`} />
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", gap: "8px", fontSize: "10px", color: "rgba(255,255,255,0.65)" }}>
                    <span><span style={{ color: "#10b981" }}>●</span> {sentimentSummary.positive_pct}%</span>
                    <span><span style={{ color: "#64748b" }}>●</span> {sentimentSummary.neutral_pct}%</span>
                    <span><span style={{ color: "#ef4444" }}>●</span> {sentimentSummary.negative_pct}%</span>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Registered users (free & pro): Open Side Panel */}
          {onViewFullAnalysis && (
            <button
              onClick={onViewFullAnalysis}
              onMouseEnter={() => setHoverFullAnalysis(true)}
              onMouseLeave={() => setHoverFullAnalysis(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                padding: "8px 12px",
                backgroundColor: hoverFullAnalysis ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.15s",
              }}>
              📊 {isPro ? "View Full Analysis" : "Open Analysis Panel"}
            </button>
          )}

          {/* Guest: Register for unlimited verdicts */}
          {isGuest && onRegister && (
            <button
              onClick={onRegister}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                padding: "8px 12px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9" }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1" }}>
              🚀 Register for unlimited free verdicts
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
