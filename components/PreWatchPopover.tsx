/**
 * FR-101: Pre-Watch Popover Component
 * 
 * Displays analysis preview before video playback with:
 * - Trust score preview
 * - Clickbait verdict
 * - Key insights summary
 * - Action buttons (Watch Anyway / View Full Analysis)
 */

import { useState, useEffect } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor } from "~lib/colors"

interface PreWatchPopoverProps {
  analysis: VideoAnalysis | null
  isLoading: boolean
  onDismiss: () => void
  onViewFullAnalysis: () => void
  onWatchAnyway: () => void
}

export const PreWatchPopover = ({
  analysis,
  isLoading,
  onDismiss,
  onViewFullAnalysis,
  onWatchAnyway
}: PreWatchPopoverProps) => {
  const [isVisible, setIsVisible] = useState(true)
  const [shouldRender, setShouldRender] = useState(true)

  useEffect(() => {
    // Auto-show when analysis completes
    if (analysis && !isLoading) {
      setIsVisible(true)
      setShouldRender(true)
    }
  }, [analysis, isLoading])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => {
      setShouldRender(false)
      onDismiss()
    }, 300)
  }

  const handleWatchAnyway = () => {
    handleDismiss()
    onWatchAnyway()
  }

  const handleViewFullAnalysis = () => {
    handleDismiss()
    onViewFullAnalysis()
  }

  if (!shouldRender || (!isLoading && !analysis)) {
    return null
  }

  const trustColor = analysis ? getTrustScoreColor(analysis.trustScore.score) : "neutral"
  const verdictColor = analysis ? getClickbaitVerdictColor(analysis.clickbaitVerdict.verdict) : "neutral"

  // Get top 2 insights for preview
  const topInsights = analysis?.viewerInsights.slice(0, 2) || []

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${isVisible ? 1 : 0.95})`,
        width: "min(480px, 90vw)",
        maxHeight: "80vh",
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.24)",
        zIndex: 10000,
        opacity: isVisible ? 1 : 0,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
      {/* Backdrop overlay */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: -1,
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.3s ease"
        }}
      />

      {isLoading ? (
        // Loading state
        <div style={{ padding: "32px", textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 16px",
              border: `4px solid ${COLORS.ui.border}`,
              borderTopColor: COLORS.neutral.primary,
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}
          />
          <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600" }}>
            Analyzing Video...
          </h3>
          <p style={{ margin: 0, color: COLORS.ui.textSecondary, fontSize: "14px" }}>
            Checking trust score, comments, and content quality
          </p>
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      ) : analysis ? (
        // Analysis results
        <>
          {/* Header */}
          <div
            style={{
              padding: "24px 24px 20px",
              borderBottom: `1px solid ${COLORS.ui.border}`,
              background: `linear-gradient(135deg, ${COLORS[trustColor].light} 0%, white 100%)`
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: COLORS[trustColor].primary,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px"
                }}>
                🛡️
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: COLORS.ui.text }}>
                  Video Analysis Complete
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: COLORS.ui.textSecondary }}>
                  Review key insights before watching
                </p>
              </div>
              <button
                onClick={handleDismiss}
                style={{
                  width: "32px",
                  height: "32px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: COLORS.ui.textSecondary,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.ui.hover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent"
                }}>
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "24px", maxHeight: "400px", overflowY: "auto" }}>
            {/* Trust Score */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    backgroundColor: COLORS[trustColor].light,
                    borderRadius: "8px",
                    border: `2px solid ${COLORS[trustColor].primary}`
                  }}>
                  <span style={{ fontSize: "24px", fontWeight: "700", color: COLORS[trustColor].text }}>
                    {analysis.trustScore.score}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: COLORS[trustColor].text }}>
                    / 100
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.text }}>
                    Trust Score
                  </div>
                  <div style={{ fontSize: "12px", color: COLORS.ui.textSecondary }}>
                    {analysis.trustScore.level === "high" && "Highly Reliable"}
                    {analysis.trustScore.level === "moderate" && "Moderate Credibility"}
                    {analysis.trustScore.level === "low" && "Low Credibility"}
                  </div>
                </div>
              </div>
            </div>

            {/* Clickbait Verdict */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  backgroundColor: COLORS[verdictColor].light,
                  borderRadius: "8px",
                  border: `1px solid ${COLORS[verdictColor].primary}`
                }}>
                <span style={{ fontSize: "16px" }}>
                  {analysis.clickbaitVerdict.verdict === "not-clickbait" && "✅"}
                  {analysis.clickbaitVerdict.verdict === "moderate-clickbait" && "⚠️"}
                  {analysis.clickbaitVerdict.verdict === "highly-clickbait" && "🚨"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: "700", color: COLORS[verdictColor].text }}>
                  {analysis.clickbaitVerdict.verdict === "not-clickbait" && "LEGIT"}
                  {analysis.clickbaitVerdict.verdict === "moderate-clickbait" && "MODERATE CLICKBAIT"}
                  {analysis.clickbaitVerdict.verdict === "highly-clickbait" && "HIGHLY CLICKBAIT"}
                </span>
              </div>
            </div>

            {/* Key Insights Preview */}
            {topInsights.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: "600", color: COLORS.ui.text }}>
                  Key Insights
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {topInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px",
                        backgroundColor: COLORS.ui.surface,
                        borderRadius: "8px",
                        borderLeft: `3px solid ${COLORS[insight.type === "warning" ? "red" : insight.type === "caution" ? "yellow" : "green"].primary}`
                      }}>
                      <div style={{ fontSize: "13px", fontWeight: "500", color: COLORS.ui.text, lineHeight: "1.5" }}>
                        {insight.statement}
                      </div>
                      {insight.supportingComments.length > 0 && (
                        <div style={{ marginTop: "6px", fontSize: "12px", color: COLORS.ui.textSecondary }}>
                          {insight.supportingComments[0].votes.toLocaleString()} upvotes
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {analysis.viewerInsights.length > 2 && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: COLORS.ui.textSecondary, textAlign: "center" }}>
                    +{analysis.viewerInsights.length - 2} more insights
                  </div>
                )}
              </div>
            )}

            {/* Sentiment Overview */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: "600", color: COLORS.ui.text }}>
                Viewer Sentiment
              </h4>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: analysis.sentiment.distribution.positive, height: "8px", backgroundColor: COLORS.green.primary, borderRadius: "4px" }} />
                <div style={{ flex: analysis.sentiment.distribution.neutral, height: "8px", backgroundColor: COLORS.yellow.primary, borderRadius: "4px" }} />
                <div style={{ flex: analysis.sentiment.distribution.negative, height: "8px", backgroundColor: COLORS.red.primary, borderRadius: "4px" }} />
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px" }}>
                <span>
                  <span style={{ color: COLORS.green.primary }}>●</span> {analysis.sentiment.distribution.positive}% Positive
                </span>
                <span>
                  <span style={{ color: COLORS.yellow.primary }}>●</span> {analysis.sentiment.distribution.neutral}% Neutral
                </span>
                <span>
                  <span style={{ color: COLORS.red.primary }}>●</span> {analysis.sentiment.distribution.negative}% Negative
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              padding: "20px 24px",
              borderTop: `1px solid ${COLORS.ui.border}`,
              display: "flex",
              gap: "12px",
              backgroundColor: COLORS.ui.surface
            }}>
            <button
              onClick={handleViewFullAnalysis}
              style={{
                flex: 1,
                padding: "12px 24px",
                backgroundColor: COLORS.neutral.primary,
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.neutral.dark
                e.currentTarget.style.transform = "translateY(-1px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.neutral.primary
                e.currentTarget.style.transform = "translateY(0)"
              }}>
              <span>🛡️</span>
              <span>View Full Report</span>
            </button>
            <button
              onClick={handleWatchAnyway}
              style={{
                flex: 1,
                padding: "12px 24px",
                backgroundColor: "white",
                color: COLORS.neutral.primary,
                border: `2px solid ${COLORS.ui.border}`,
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.neutral.primary
                e.currentTarget.style.transform = "translateY(-1px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.ui.border
                e.currentTarget.style.transform = "translateY(0)"
              }}>
              Watch Anyway
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
