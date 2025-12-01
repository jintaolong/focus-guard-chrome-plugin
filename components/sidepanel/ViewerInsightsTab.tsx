// FR-102 Tab 2: Viewer Insights
// Sentiment Overview (Donut Chart) + Actionable Insights (FR-401 pattern)

import type { VideoAnalysis } from "~types/analysis"
import { COLORS, getSentimentColor, getColorSet } from "~lib/colors"
import { StatementBlock } from "~components/StatementBlock"

interface ViewerInsightsTabProps {
  analysis: VideoAnalysis
}

export const ViewerInsightsTab = ({ analysis }: ViewerInsightsTabProps) => {
  const viewerInsights = (analysis as any)?.viewerInsights

  // Normalize shapes: provide defaults when fields are missing
  const sentimentBreakdown = viewerInsights?.sentimentBreakdown ?? {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
    totalCommentsAnalyzed: Array.isArray(viewerInsights) ? viewerInsights.length : 0
  }

  const actionableInsights = viewerInsights?.actionableInsights ?? {
    highValue: Array.isArray(viewerInsights) ? viewerInsights : [],
    improvements: []
  }

  // Calculate percentages for donut chart
  const total =
    (sentimentBreakdown.positive || 0) +
    (sentimentBreakdown.negative || 0) +
    (sentimentBreakdown.neutral || 0) +
    (sentimentBreakdown.mixed || 0) || 1

  const percentages = {
    positive: ((sentimentBreakdown.positive || 0) / total) * 100,
    negative: ((sentimentBreakdown.negative || 0) / total) * 100,
    neutral: ((sentimentBreakdown.neutral || 0) / total) * 100,
    mixed: ((sentimentBreakdown.mixed || 0) / total) * 100
  }

  // Create donut chart segments
  let currentAngle = -90 // Start at top
  const segments = [
    { type: "positive" as const, value: percentages.positive, count: sentimentBreakdown.positive || 0 },
    { type: "negative" as const, value: percentages.negative, count: sentimentBreakdown.negative || 0 },
    { type: "neutral" as const, value: percentages.neutral, count: sentimentBreakdown.neutral || 0 },
    { type: "mixed" as const, value: percentages.mixed, count: sentimentBreakdown.mixed || 0 }
  ]

  return (
    <div style={{ padding: "24px" }}>
      {/* Sentiment Overview */}
      <div style={{ marginBottom: "32px" }}>
          <h3
          style={{
            margin: "0 0 24px 0",
            fontSize: "18px",
            fontWeight: "600",
              color: COLORS.ui.textPrimary
          }}>
          Comment Sentiment Overview
        </h3>

        <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
          {/* Donut Chart */}
          <div style={{ position: "relative", width: "160px", height: "160px", flexShrink: 0 }}>
            <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              {segments.map((segment, index) => {
                if (segment.value === 0) return null
                
                const angle = (segment.value / 100) * 360
                const color = COLORS[getSentimentColor(segment.type)].primary
                
                // Create arc path
                const radius = 85
                const innerRadius = 60
                const startAngle = currentAngle
                const endAngle = currentAngle + angle
                
                const start = polarToCartesian(100, 100, radius, startAngle)
                const end = polarToCartesian(100, 100, radius, endAngle)
                const innerStart = polarToCartesian(100, 100, innerRadius, endAngle)
                const innerEnd = polarToCartesian(100, 100, innerRadius, startAngle)
                
                const largeArcFlag = angle > 180 ? 1 : 0
                
                const pathData = [
                  `M ${start.x} ${start.y}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
                  `L ${innerStart.x} ${innerStart.y}`,
                  `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}`,
                  'Z'
                ].join(' ')
                
                currentAngle += angle
                
                return (
                  <path
                    key={segment.type}
                    d={pathData}
                    fill={color}
                    style={{ transition: "all 0.5s ease-out" }}
                  />
                )
              })}
            </svg>

            {/* Center text */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center"
              }}>
                <div
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                    color: COLORS.ui.textPrimary
                }}>
                {sentimentBreakdown.totalCommentsAnalyzed}
              </div>
              <div
                style={{
                  fontSize: "12px",
                    color: COLORS.ui.textSecondary
                }}>
                Comments
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
            {segments.map((segment) => (
              <div
                key={segment.type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "4px",
                    backgroundColor: COLORS[getSentimentColor(segment.type)].primary,
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                          color: COLORS.ui.textPrimary,
                        textTransform: "capitalize"
                      }}>
                      {segment.type}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                          color: COLORS.ui.textSecondary
                      }}>
                      {segment.value.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: COLORS.ui.text.secondary }}>
                    {segment.count} comment{segment.count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actionable Insights - High Value */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: getColorSet("high").text
          }}>
          🌟 High-Value Insights
        </h3>
        {((actionableInsights.highValue || []) as any[]).length === 0 ? (
          <p style={{ fontSize: "14px", color: COLORS.ui.textSecondary, fontStyle: "italic" }}>
            No high-value insights identified
          </p>
        ) : (
          (actionableInsights.highValue || []).map((insight: any, idx: number) => (
            <StatementBlock key={insight.id ?? `high-${idx}`} insight={insight} />
          ))
        )}
      </div>

      {/* Actionable Insights - Improvements */}
      <div>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.low.text
          }}>
          ⚡ Areas for Improvement
        </h3>
        {((actionableInsights.improvements || []) as any[]).length === 0 ? (
          <p style={{ fontSize: "14px", color: COLORS.ui.textSecondary, fontStyle: "italic" }}>
            No areas for improvement identified
          </p>
        ) : (
          (actionableInsights.improvements || []).map((insight: any, idx: number) => (
            <StatementBlock key={insight.id ?? `impr-${idx}`} insight={insight} />
          ))
        )}
      </div>
    </div>
  )
}

// Helper function to convert polar coordinates to cartesian
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  }
}
