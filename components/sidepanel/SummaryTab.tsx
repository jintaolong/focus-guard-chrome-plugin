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
  
  if (!analysis) return null
  
  // Support both legacy and new data shapes
  const summary = analysis.summary || {}
  const trustScore = summary.trustScore ?? analysis.trustScore?.score ?? 0
  const trustColor = getTrustScoreColor(trustScore)
  const verdictColor = getClickbaitVerdictColor(summary.clickbaitVerdict?.label ?? "unknown")
  
  // Extract executive summary from analysis
  const executiveSummary = analysis.executiveSummary || "This video has been analyzed by Focus Guard AI to assess its relevancy, credibility, and viewer insights based on comments, transcript, and metadata."
  
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
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: "1.6",
            color: COLORS.ui.textSecondary,
            backgroundColor: COLORS.neutral.light,
            padding: "16px",
            borderRadius: "8px",
            borderLeft: `4px solid ${COLORS[trustColor].primary}`
          }}>
          {executiveSummary}
        </p>
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
              stroke={COLORS[trustColor].primary}
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
              color: COLORS[trustColor].primary
            }}>
            {trustScore.toFixed(1)}
          </div>
          <div
            style={{
              position: "absolute",
              top: "70%",
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

        {/* Semi-Circular Gauge */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div style={{ position: "relative", width: "180px", margin: "0 auto" }}>
            <svg viewBox="0 0 180 95" style={{ width: "100%", height: "auto" }}>
              {/* Background arc */}
              <path
                d="M 15 90 A 75 75 0 0 1 165 90"
                fill="none"
                stroke={COLORS.ui.border}
                strokeWidth="16"
                strokeLinecap="round"
              />
              {/* Score arc */}
              <path
                d="M 15 90 A 75 75 0 0 1 165 90"
                fill="none"
                stroke={credibilityScore >= 70 ? COLORS.green.primary : credibilityScore >= 40 ? COLORS.yellow.primary : COLORS.red.primary}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${(credibilityScore / 100) * 235.6} 235.6`}
                style={{
                  transition: "stroke-dasharray 1s ease-out"
                }}
              />
            </svg>

            {/* Score number */}
            <div
              style={{
                position: "absolute",
                top: "55%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "36px",
                fontWeight: "700",
                color: credibilityScore >= 70 ? COLORS.green.primary : credibilityScore >= 40 ? COLORS.yellow.primary : COLORS.red.primary
              }}>
              {credibilityScore}
            </div>
            <div
              style={{
                position: "absolute",
                top: "85%",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "12px",
                fontWeight: "500",
                color: COLORS.ui.textSecondary
              }}>
              out of 100
            </div>
          </div>
        </div>

        {/* Expandable Factors */}
        {credibilityFactors.length > 0 && (
          <div>
            <button
              onClick={() => setShowCredibilityFactors(!showCredibilityFactors)}
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: COLORS.neutral.light,
                border: `1px solid ${COLORS.ui.border}`,
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: COLORS.ui.textPrimary,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.ui.border}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.neutral.light}>
              <span>Contributing Factors</span>
              <span style={{ fontSize: "18px" }}>{showCredibilityFactors ? "▼" : "▶"}</span>
            </button>

            {showCredibilityFactors && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {credibilityFactors.map((factor: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: "12px",
                      backgroundColor: COLORS.neutral.light,
                      borderRadius: "6px",
                      borderLeft: `3px solid ${COLORS.neutral.primary}`
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                        {factor.name}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: COLORS.neutral.primary }}>
                        {factor.weight}%
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: COLORS.ui.textSecondary, lineHeight: "1.4" }}>
                      {factor.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
                stroke={COLORS.red.primary}
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
              <div style={{ fontSize: "24px", fontWeight: "700", color: COLORS.red.primary }}>
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
                    backgroundColor: COLORS.red.primary,
                    borderRadius: "3px"
                  }}
                />
                <span style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                  Bot Comments
                </span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: COLORS.red.primary, marginLeft: "24px" }}>
                {botPercentage}%
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: COLORS.green.primary,
                    borderRadius: "3px"
                  }}
                />
                <span style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                  Human Comments
                </span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: COLORS.green.primary, marginLeft: "24px" }}>
                {humanPercentage}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
