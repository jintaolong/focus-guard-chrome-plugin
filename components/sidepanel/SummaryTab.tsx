// FR-102 Tab 1: Summary & Score
// Trust Score Visualization, Clickbait Verdict, Channel Credibility

import type { VideoAnalysis } from "~types/analysis"
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor } from "~lib/colors"

interface SummaryTabProps {
  analysis: VideoAnalysis
}

export const SummaryTab = ({ analysis }: SummaryTabProps) => {
  const { summary } = analysis
  const trustColor = getTrustScoreColor(summary.trustScore)
  const verdictColor = getClickbaitVerdictColor(summary.clickbaitVerdict.label)

  return (
    <div style={{ padding: "24px" }}>
      {/* Trust Score Visualization - Semi-Circular Radial Gauge */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "32px"
        }}>
        <h3
          style={{
            margin: "0 0 24px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.text.primary
          }}>
          Trust Score
        </h3>

        {/* Radial Gauge */}
        <div style={{ position: "relative", width: "200px", margin: "0 auto" }}>
          <svg viewBox="0 0 200 110" style={{ width: "100%", height: "auto" }}>
            {/* Background arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={COLORS.ui.border}
              strokeWidth="20"
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={COLORS[trustColor].primary}
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${(summary.trustScore / 10) * 251.2} 251.2`}
              style={{
                transition: "stroke-dasharray 1s ease-out"
              }}
            />
          </svg>

          {/* Score number */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -20%)",
              fontSize: "48px",
              fontWeight: "700",
              color: COLORS[trustColor].primary
            }}>
            {summary.trustScore.toFixed(1)}
          </div>
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "13px",
              fontWeight: "500",
              color: COLORS.ui.text.secondary
            }}>
            out of 10
          </div>
        </div>

        {/* AI Confidence Level */}
        <div
          style={{
            marginTop: "16px",
            fontSize: "14px",
            color: COLORS.ui.text.secondary
          }}>
          AI Confidence: <strong>{summary.aiConfidence}%</strong>
        </div>
      </div>

      {/* Clickbait Verdict */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.text.primary
          }}>
          Clickbait Analysis
        </h3>

        {/* Verdict Chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 20px",
            backgroundColor: COLORS[verdictColor].light,
            border: `3px solid ${COLORS[verdictColor].primary}`,
            borderRadius: "12px",
            marginBottom: "16px"
          }}>
          <span style={{ fontSize: "24px" }}>
            {summary.clickbaitVerdict.label === "LEGIT"
              ? "✓"
              : summary.clickbaitVerdict.label === "MISLEADING"
              ? "⚠"
              : "✗"}
          </span>
          <span
            style={{
              fontSize: "18px",
              fontWeight: "700",
              color: COLORS[verdictColor].dark,
              letterSpacing: "0.5px"
            }}>
            {summary.clickbaitVerdict.label}
          </span>
        </div>

        {/* Confidence Bar */}
        <div style={{ marginTop: "12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px"
            }}>
            <span style={{ fontSize: "13px", color: COLORS.ui.text.secondary }}>
              Confidence
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: COLORS[verdictColor].text
              }}>
              {summary.clickbaitVerdict.confidence}%
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: COLORS.ui.border,
              borderRadius: "4px",
              overflow: "hidden"
            }}>
            <div
              style={{
                width: `${summary.clickbaitVerdict.confidence}%`,
                height: "100%",
                backgroundColor: COLORS[verdictColor].primary,
                transition: "width 1s ease-out"
              }}
            />
          </div>
        </div>
      </div>

      {/* Channel Credibility */}
      <div>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.text.primary
          }}>
          Channel Credibility
        </h3>

        {/* Progress Bar */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px"
            }}>
            <span style={{ fontSize: "14px", color: COLORS.ui.text.secondary }}>
              Credibility Score
            </span>
            <span
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: COLORS.neutral.primary
              }}>
              {summary.channelCredibility.score}/100
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "12px",
              backgroundColor: COLORS.ui.border,
              borderRadius: "6px",
              overflow: "hidden"
            }}>
            <div
              style={{
                width: `${summary.channelCredibility.score}%`,
                height: "100%",
                backgroundColor: COLORS.neutral.primary,
                transition: "width 1s ease-out"
              }}
            />
          </div>
        </div>

        {/* Key Factors */}
        <div>
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "13px",
              fontWeight: "600",
              color: COLORS.ui.text.secondary
            }}>
            Key Factors:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {summary.channelCredibility.factors.map((factor, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  backgroundColor: COLORS.neutral.light,
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: COLORS.neutral.dark
                }}>
                <span style={{ fontSize: "16px" }}>✓</span>
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
