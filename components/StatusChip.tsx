// FR-103: Inline Status Chip Component
// Displays near video title on YouTube Watch Page

import { useState, useEffect } from "react"
import type { VideoAnalysisStatus } from "~types/analysis"
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor } from "~lib/colors"

interface StatusChipProps {
  status: VideoAnalysisStatus | null
  onViewReport: () => void
}

export const StatusChip = ({ status, onViewReport }: StatusChipProps) => {
  if (!status) return null

  const [collapsed, setCollapsed] = useState(false)

  // FR-203: Loading state
  if (status.isAnalyzing) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          backgroundColor: COLORS.ui.surface,
          border: `1px solid ${COLORS.ui.border}`,
          borderRadius: "20px",
          fontSize: "14px",
          color: COLORS.ui.text.secondary,
          marginLeft: "12px"
        }}>
        <div
          style={{
            width: "16px",
            height: "16px",
            border: `2px solid ${COLORS.ui.border}`,
            borderTopColor: COLORS.neutral.primary,
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />
        <span style={{ fontWeight: 500 }}>Analyzing...</span>
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    )
  }

  const trustColor = getTrustScoreColor(status.trustScore)
  const verdictColor = getClickbaitVerdictColor(status.clickbaitVerdict)
  
  // Get verdict icon
  const getVerdictIcon = () => {
    switch (status.clickbaitVerdict) {
      case "LEGIT":
        return "✓"
      case "MISLEADING":
        return "⚠"
      case "CLICKBAIT":
        return "✗"
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          title="Show Focus Guard"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            border: `1px solid ${COLORS.ui.border}`,
            backgroundColor: COLORS.neutral.primary,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}>
          ▶
        </button>
      ) : (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            marginLeft: "12px",
            background: "transparent"
          }}>
          {/* Trust Score */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              backgroundColor: COLORS[trustColor].light,
              border: `2px solid ${COLORS[trustColor].primary}`,
              borderRadius: "16px"
            }}>
            <span
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: COLORS[trustColor].text
              }}>
              {status.trustScore.toFixed(1)}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: COLORS[trustColor].text,
                opacity: 0.8
              }}>
              Trust Score
            </span>
          </div>

          {/* Clickbait Verdict */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              backgroundColor: COLORS[verdictColor].light,
              border: `2px solid ${COLORS[verdictColor].primary}`,
              borderRadius: "16px"
            }}>
            <span style={{ fontSize: "16px" }}>{getVerdictIcon()}</span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: COLORS[verdictColor].text,
                letterSpacing: "0.5px"
              }}>
              {status.clickbaitVerdict}
            </span>
          </div>

          {/* View Full Report Button */}
          <button
            onClick={onViewReport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 16px",
              backgroundColor: COLORS.neutral.primary,
              color: "white",
              border: "none",
              borderRadius: "16px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
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
            <span>🛡️</span>
            <span>View Full Report</span>
          </button>

          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(true)}
            title="Hide"
            style={{
              marginLeft: "8px",
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: `1px solid ${COLORS.ui.border}`,
              backgroundColor: COLORS.ui.surface,
              color: COLORS.ui.text.secondary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
