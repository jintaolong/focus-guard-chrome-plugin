import { useState } from "react"
import { COLORS, getClickbaitVerdictColor } from "~lib/colors"

// Helper to determine claim field names (backend might use claim or claim_text)
const getClaimText = (claim: any): string => claim?.claim_text || claim?.claim || ""
const getClaimStatus = (claim: any): string => claim?.status || claim?.verdict || ""
const getClaimEvidence = (claim: any): string => {
  if (!claim) return ""
  // Prefer explicit `evidence` field if present
  if (claim.evidence) {
    if (Array.isArray(claim.evidence)) return claim.evidence.join(', ')
    return String(claim.evidence)
  }

  // Fallback to supporting_evidence which may be array or string
  const se = claim.supporting_evidence || claim.supportingEvidence || claim.supportingEvidenceList
  if (!se) return ""
  if (Array.isArray(se)) return se.join(', ')
  return String(se)
}

interface VideoCredibilitySubTabProps {
  summary: any
  trustScore: number
  verdictColor: "high" | "medium" | "low" | "neutral"
  claimsList: any[]
}

export const VideoCredibilitySubTab = ({ 
  summary, 
  trustScore, 
  verdictColor, 
  claimsList
}: VideoCredibilitySubTabProps) => {
  const [showClaims, setShowClaims] = useState(false)
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set())
  
  const toggleClaimExpansion = (idx: number) => {
    setExpandedClaims(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idx)) {
        newSet.delete(idx)
      } else {
        newSet.add(idx)
      }
      return newSet
    })
  }

  return (
    <div>
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

      {/* Clickbait Verdict & Claims */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.text.primary
          }}>
          Content Verdict
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
            marginBottom: "12px"
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
        <div style={{ marginTop: "12px", marginBottom: "16px" }}>
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

        {/* One-line Summary */}
        {summary.clickbaitVerdict?.onLineSummary && (
          <div
            style={{
              padding: "12px",
              backgroundColor: COLORS.neutral.light,
              borderRadius: "6px",
              fontSize: "14px",
              color: COLORS.ui.textPrimary,
              marginBottom: "16px",
              fontStyle: "italic"
            }}>
            {summary.clickbaitVerdict.onLineSummary}
          </div>
        )}

        {/* Claims - Collapsible Section */}
        {summary.clickbaitVerdict?.claims && summary.clickbaitVerdict.claims.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <button
              onClick={() => setShowClaims(!showClaims)}
              style={{
                width: "100%",
                padding: "10px 12px",
                backgroundColor: COLORS.ui.surface,
                border: `1px solid ${COLORS.ui.border}`,
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "14px",
                fontWeight: "600",
                color: COLORS.ui.textPrimary
              }}>
              <span>📋 Video Claims Vs. Comment Verdicts ({summary.clickbaitVerdict.claims.length})</span>
              <span style={{
                transition: "transform 0.2s",
                transform: showClaims ? "rotate(180deg)" : "rotate(0deg)"
              }}>▼</span>
            </button>
            
            {showClaims && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {claimsList.map((claim: any, idx: number) => {
                  const claimText = getClaimText(claim)
                  const claimStatus = getClaimStatus(claim)
                  const claimEvidence = getClaimEvidence(claim)
                  const claimVerdictColor = claimStatus
                    ? getClickbaitVerdictColor(claimStatus.toUpperCase() as any)
                    : "neutral"
                  const isExpanded = expandedClaims.has(idx)
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: COLORS.ui.surface,
                        border: `1px solid ${COLORS[claimVerdictColor].primary}`,
                        borderLeft: `4px solid ${COLORS[claimVerdictColor].primary}`,
                        borderRadius: "6px",
                        overflow: "hidden"
                      }}>
                      <div
                        onClick={() => toggleClaimExpansion(idx)}
                        style={{
                          padding: "10px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px"
                        }}>
                        <span style={{
                          fontSize: "10px",
                          transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          marginTop: "3px"
                        }}>▶</span>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              color: COLORS.ui.textPrimary,
                              marginBottom: "4px"
                            }}>
                            {claimText}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              fontSize: "12px",
                              color: COLORS.ui.textSecondary
                            }}>
                            {claimStatus && (
                              <span
                                style={{
                                  padding: "2px 8px",
                                  backgroundColor: COLORS[claimVerdictColor].light,
                                  borderRadius: "4px",
                                  fontWeight: "600",
                                  color: COLORS[claimVerdictColor].dark
                                }}>
                                {claimStatus}
                              </span>
                            )}
                            {claim.confidence !== undefined && (
                              <span>
                                <strong>Confidence:</strong> {claim.confidence}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isExpanded && claimEvidence && (
                        <div
                          style={{
                            padding: "12px",
                            backgroundColor: COLORS.ui.background,
                            borderTop: `1px solid ${COLORS.ui.border}`,
                            fontSize: "12px",
                            color: COLORS.ui.textSecondary,
                            lineHeight: "1.6"
                          }}>
                          <strong style={{ color: COLORS.ui.textPrimary }}>Evidence:</strong>
                          <div style={{ marginTop: "4px" }}>{claimEvidence}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
