// FR-102 Tab 1: Summary & Score
// Executive Summary, Trust Score, Channel Credibility Gauge, Bot Detection

import { useState } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor } from "~lib/colors"

interface SummaryTabProps {
  analysis?: VideoAnalysis | null
}

export const SummaryTab = ({ analysis }: SummaryTabProps) => {
  const [showCredibilityFactors, setShowCredibilityFactors] = useState(false)
  const [isExecutiveSummaryExpanded, setIsExecutiveSummaryExpanded] = useState(false)
  
  if (!analysis) return null
  
  // Support both legacy and new data shapes
  const summary = (analysis.summary || {}) as any
  const trustScore = summary.trustScore ?? analysis.trustScore?.score ?? 0
  const trustColor = getTrustScoreColor(trustScore)
  const verdictColor = getClickbaitVerdictColor(summary.clickbaitVerdict?.label ?? "unknown")
  
  // Extract executive summary from analysis
  const executiveSummary = analysis.executiveSummary || "This video has been analyzed by Focus Guard AI to assess its relevancy, credibility, and viewer insights based on comments, transcript, and metadata."
  const isLongSummary = executiveSummary.length > 200
  const displaySummary = isLongSummary && !isExecutiveSummaryExpanded 
    ? executiveSummary.substring(0, 200) + "..." 
    : executiveSummary
  
  // Channel credibility data
  const channelCredibility = summary.channelCredibility || analysis.channelCredibility || {}
  const credibilityScore = channelCredibility.score ?? 0
  const credibilityFactors = channelCredibility.factors || []
  
  // Bot detection data
  const botPercentage = analysis.contentGaps?.botPercentage ?? 0
  const humanPercentage = 100 - botPercentage

  return (
    <div style={{ padding: "24px", maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
      {/* Executive Summary */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Executive Summary
        </h3>
        <div
          style={{
            backgroundColor: COLORS.neutral.light,
            padding: "16px",
            borderRadius: "8px",
            borderLeft: `4px solid ${COLORS[verdictColor].primary}`
          }}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              lineHeight: "1.6",
              color: COLORS.ui.textSecondary
            }}>
            {displaySummary}
          </p>
          {isLongSummary && (
            <button
              onClick={() => setIsExecutiveSummaryExpanded(!isExecutiveSummaryExpanded)}
              style={{
                marginTop: "8px",
                padding: "4px 8px",
                fontSize: "12px",
                color: COLORS.neutral.primary,
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline"
              }}>
              {isExecutiveSummaryExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>

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
            color: COLORS.ui.textPrimary
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
              stroke={COLORS[verdictColor].primary}
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${(trustScore / 10) * 251.2} 251.2`}
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
              color: COLORS[verdictColor].primary
            }}>
            {trustScore.toFixed(1)}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "0%",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "13px",
              fontWeight: "500",
              color: COLORS.ui.textSecondary
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
            AI Confidence: <strong>{summary.aiConfidence ?? 0}%</strong>
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
              {summary.clickbaitVerdict?.label === "LEGIT"
                ? "✓"
                : summary.clickbaitVerdict?.label === "MISLEADING"
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
            {summary.clickbaitVerdict?.label}
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
              {summary.clickbaitVerdict?.confidence ?? 0}%
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
                width: `${summary.clickbaitVerdict?.confidence ?? 0}%`,
                height: "100%",
                backgroundColor: COLORS[verdictColor].primary,
                transition: "width 1s ease-out"
              }}
            />
          </div>
        </div>
      </div>

      {/* Channel Credibility */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Channel Credibility
        </h3>

        {/* Note: Factor scores are normalized percentages (0-100) representing relative weight/importance 
            in credibility calculation, NOT raw values. For example, 300K subscribers might show as 30% 
            because it represents moderate weight in the overall credibility score calculation. 
            See "Value" column for actual raw values. */}

        {/* Overall Score */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "12px",
            padding: "16px 24px",
            backgroundColor: COLORS.neutral.light,
            borderRadius: "12px",
            border: `2px solid ${credibilityScore >= 70 ? COLORS.high.primary : credibilityScore >= 40 ? COLORS.medium.primary : COLORS.low.primary}`
          }}>
            <div style={{
              fontSize: "42px",
              fontWeight: "700",
              color: credibilityScore >= 70 ? COLORS.high.primary : credibilityScore >= 40 ? COLORS.medium.primary : COLORS.low.primary
            }}>
              {credibilityScore}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Overall Score
              </div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                out of 100
              </div>
            </div>
          </div>
        </div>

        {/* Spider/Radar Chart */}
        {credibilityFactors.length > 0 && (() => {
          // Debug: log raw factor data
          console.log("SummaryTab: Raw credibilityFactors:", credibilityFactors)
          
          // Normalize factor weights to 0-100 range first (in case they're 0-1)
          const factorsWithScores = credibilityFactors.map((factor: any) => {
            const rawWeight = Number(factor.weight) || 0
            // If weight is between 0-1, convert to 0-100
            const normalizedWeight = rawWeight <= 1 ? rawWeight * 100 : rawWeight
            return { ...factor, normalizedWeight }
          })
          
          console.log("SummaryTab: Factors after first normalization:", factorsWithScores)
          
          // Apply min-max normalization to spread values across the chart better
          const weights = factorsWithScores.map((f: any) => f.normalizedWeight)
          const minWeight = Math.min(...weights)
          const maxWeight = Math.max(...weights)
          const range = maxWeight - minWeight
          
          console.log("SummaryTab: Min weight:", minWeight, "Max weight:", maxWeight, "Range:", range)
          
          // Re-normalize to 20-100 range for better visualization (avoid too small shapes)
          const visualFactors = factorsWithScores.map((f: any) => ({
            ...f,
            visualScore: range > 0 
              ? 20 + ((f.normalizedWeight - minWeight) / range) * 80 
              : 60 // fallback to middle if all same
          }))
          
          console.log("SummaryTab: Visual factors for radar chart:", visualFactors)
          
          const centerX = 150
          const centerY = 150
          const radius = 100
          const numFactors = visualFactors.length
          
          // Calculate points for the web and the data
          const webLevels = [0.2, 0.4, 0.6, 0.8, 1.0] // 5 concentric levels
          const dataPoints = visualFactors.map((factor: any, i: number) => {
            const angle = (Math.PI * 2 * i) / numFactors - Math.PI / 2 // Start from top
            const normalizedScore = factor.visualScore / 100 // Use visualScore for chart
            const x = centerX + radius * normalizedScore * Math.cos(angle)
            const y = centerY + radius * normalizedScore * Math.sin(angle)
            return { x, y, angle, score: normalizedScore, factor }
          })

          // Generate axis points (endpoints)
          const axisPoints = visualFactors.map((factor: any, i: number) => {
            const angle = (Math.PI * 2 * i) / numFactors - Math.PI / 2
            return {
              x: centerX + radius * Math.cos(angle),
              y: centerY + radius * Math.sin(angle),
              angle,
              factor
            }
          })

          return (
            <div>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <svg viewBox="0 0 300 300" style={{ width: "100%", maxWidth: "300px", height: "auto" }}>
                  {/* Background web circles */}
                  {webLevels.map((level, idx) => (
                    <circle
                      key={`web-${idx}`}
                      cx={centerX}
                      cy={centerY}
                      r={radius * level}
                      fill="none"
                      stroke={COLORS.ui.border}
                      strokeWidth="1"
                      opacity={0.3}
                    />
                  ))}

                  {/* Axis lines */}
                  {axisPoints.map((point: any, i: number) => (
                    <line
                      key={`axis-${i}`}
                      x1={centerX}
                      y1={centerY}
                      x2={point.x}
                      y2={point.y}
                      stroke={COLORS.ui.border}
                      strokeWidth="1"
                      opacity={0.5}
                    />
                  ))}

                  {/* Data polygon */}
                  <polygon
                    points={dataPoints.map((p: any) => `${p.x},${p.y}`).join(' ')}
                    fill={COLORS.high.primary}
                    fillOpacity={0.2}
                    stroke={COLORS.high.primary}
                    strokeWidth="2"
                  />

                  {/* Data points */}
                  {dataPoints.map((point: any, i: number) => (
                    <circle
                      key={`point-${i}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={COLORS.high.primary}
                      stroke="white"
                      strokeWidth="2"
                    />
                  ))}

                  {/* Labels */}
                  {axisPoints.map((point: any, i: number) => {
                    const factor = point.factor
                    const labelDistance = radius + 35
                    const labelX = centerX + labelDistance * Math.cos(point.angle)
                    const labelY = centerY + labelDistance * Math.sin(point.angle)
                    
                    // Format factor name for display (remove underscores, capitalize)
                    const displayName = factor.name
                      .split('_')
                      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')
                    
                    return (
                      <text
                        key={`label-${i}`}
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill={COLORS.ui.textPrimary}
                        style={{ 
                          userSelect: 'none',
                          maxWidth: '60px'
                        }}>
                        {displayName}
                      </text>
                    )
                  })}
                </svg>
              </div>

              {/* Factor Details Table */}
              <div style={{ 
                marginTop: "16px",
                backgroundColor: COLORS.neutral.light,
                borderRadius: "8px",
                padding: "12px",
                fontSize: "12px"
              }}>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr auto auto",
                  gap: "8px",
                  fontWeight: "600",
                  paddingBottom: "8px",
                  borderBottom: `1px solid ${COLORS.ui.border}`,
                  color: COLORS.ui.textSecondary
                }}>
                  <div>Factor</div>
                  <div style={{ textAlign: "right" }}>Score</div>
                  <div style={{ textAlign: "right" }}>Value</div>
                </div>
                {visualFactors.map((factor: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: "8px",
                      paddingTop: "8px",
                      alignItems: "center"
                    }}>
                    <div style={{ 
                      fontWeight: "500", 
                      color: COLORS.ui.textPrimary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {factor.name.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </div>
                    <div style={{ 
                      textAlign: "right",
                      fontWeight: "700",
                      color: factor.normalizedWeight >= 70 ? COLORS.high.primary : factor.normalizedWeight >= 40 ? COLORS.medium.primary : COLORS.low.primary
                    }}>
                      {Math.round(factor.normalizedWeight)}%
                    </div>
                    <div style={{ 
                      textAlign: "right",
                      color: COLORS.ui.textSecondary,
                      fontSize: "11px",
                      maxWidth: "80px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {/* Special handling for verified (boolean 0/1 -> Yes/No) */}
                      {factor.name.toLowerCase() === 'verified' 
                        ? (factor.value == 1 || factor.value === true || factor.value === 'true' ? 'Yes' : 'No')
                        : factor.value
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{ 
                marginTop: "12px",
                fontSize: "11px",
                color: COLORS.ui.textSecondary,
                textAlign: "center",
                fontStyle: "italic"
              }}>
                Scores represent normalized credibility metrics (0-100%). Radar chart uses min-max scaling for better visualization.
              </div>
            </div>
          )
        })()}
      </div>

      {/* Bot Detection */}
      <div>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Bot Detection
        </h3>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* Pie Chart */}
          <div style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
            <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%" }}>
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={COLORS.ui.border}
                strokeWidth="20"
              />
              {/* Bot percentage arc */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={COLORS.low.primary}
                strokeWidth="20"
                strokeDasharray={`${(botPercentage / 100) * 314} 314`}
                strokeDashoffset="0"
                transform="rotate(-90 60 60)"
                style={{
                  transition: "stroke-dasharray 1s ease-out"
                }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center"
              }}>
              <div style={{ fontSize: "24px", fontWeight: "700", color: COLORS.low.primary }}>
                {botPercentage}%
              </div>
              <div style={{ fontSize: "10px", color: COLORS.ui.textSecondary }}>
                Bots
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: COLORS.low.primary,
                    borderRadius: "3px"
                  }}
                />
                <span style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                  Bot Comments
                </span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: COLORS.low.primary, marginLeft: "24px" }}>
                {botPercentage}%
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: COLORS.high.primary,
                    borderRadius: "3px"
                  }}
                />
                <span style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                  Human Comments
                </span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: COLORS.high.primary, marginLeft: "24px" }}>
                {humanPercentage}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
