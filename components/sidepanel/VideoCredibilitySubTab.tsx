import { useState } from "react"
import { COLORS, getClickbaitVerdictColor, getClickbaitColorPart } from "~lib/colors"
import { CommentDisplay } from "~components/CommentDisplay"
import { renderBoldMarkup } from "~lib/renderBoldText"

// Helper to determine claim field names (backend might use claim or claim_text)
const getClaimText = (claim: any): string => claim?.claim_text || claim?.claim || ""
const getClaimStatus = (claim: any): string => claim?.status || claim?.verdict || ""

// Parse claim evidence structure
interface CommentEvidence {
  user: string
  text: string
  likes: number
}

interface ClaimEvidenceData {
  evidenceFor: CommentEvidence[]
  evidenceAgainst: CommentEvidence[]
  dangerWarnings: CommentEvidence[]
  hasEvidence: boolean
}

const getClaimEvidenceData = (claim: any): ClaimEvidenceData => {
  const result: ClaimEvidenceData = {
    evidenceFor: [],
    evidenceAgainst: [],
    dangerWarnings: [],
    hasEvidence: false
  }
  
  if (!claim) return result
  
  // Extract evidence_for
  if (claim.evidence_for && Array.isArray(claim.evidence_for) && claim.evidence_for.length > 0) {
    result.evidenceFor = claim.evidence_for
    result.hasEvidence = true
  }
  
  // Extract evidence_against
  if (claim.evidence_against && Array.isArray(claim.evidence_against) && claim.evidence_against.length > 0) {
    result.evidenceAgainst = claim.evidence_against
    result.hasEvidence = true
  }
  
  // Extract danger_warnings
  if (claim.danger_warnings && Array.isArray(claim.danger_warnings) && claim.danger_warnings.length > 0) {
    result.dangerWarnings = claim.danger_warnings
    result.hasEvidence = true
  }
  
  return result
}

interface VideoCredibilitySubTabProps {
  summary: any
  trustScore: number
  verdictColor: "high" | "medium" | "low" | "neutral"
  claimsList: any[]
  videoId?: string // For YouTube anchor links
  panelDock?: "left" | "right"
}

export const VideoCredibilitySubTab = ({ 
  summary, 
  trustScore, 
  verdictColor, 
  claimsList,
  videoId = "",
  panelDock = "right"
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

  const verdictLabel = summary.clickbaitVerdict?.label || ""

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
          Verdict Certainty
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
              stroke={getClickbaitColorPart(verdictLabel, "primary")}
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
              color: getClickbaitColorPart(verdictLabel, "primary")
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

        {/* Footnote */}
        <p
          style={{
            margin: "12px 0 0 0",
            fontSize: "11px",
            color: COLORS.ui.textSecondary,
            lineHeight: "1.4",
            textAlign: "center"
          }}>
          How confident AI is about the verdict?
        </p>

        {/* Gauge only - confidence values removed (trust score shown above) */}
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
          Is It Clickbait?
        </h3>

        {/* Verdict Chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 20px",
            backgroundColor: getClickbaitColorPart(verdictLabel, "light"),
            border: `3px solid ${getClickbaitColorPart(verdictLabel, "primary")}`,
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
              color: getClickbaitColorPart(verdictLabel, "dark"),
              letterSpacing: "0.5px"
            }}>
            {summary.clickbaitVerdict?.label}
          </span>
        </div>
        
        {/* LEGIT caveat: audience reaction prompt */}
        {summary.clickbaitVerdict?.label === "LEGIT" && (
            <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px", 
            marginBottom: "32px",
            padding: "12px",
            backgroundColor: COLORS.medium.light,
            borderRadius: "6px",
            borderLeft: `4px solid ${COLORS.medium.primary}`
            }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }} title="Warning">⚠️</span>
            <div style={{ fontSize: "13px", color: COLORS.ui.textPrimary, lineHeight: "1.5" }}>
                <div>But audience reactions show conflicting emotional signals</div>
                <div style={{ fontSize: "12px", color: COLORS.ui.textSecondary, marginTop: "4px" }}>
                Unlock audience reaction analysis to see why.
                </div>
            </div>
            </div>
        )}

        {/* Confidence display removed — trust score gauge suffices */}

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
            {renderBoldMarkup(summary.clickbaitVerdict.onLineSummary)}
          </div>
        )}

        {/* Evidence Score Bar - placed above claims */}
        {summary.evidenceScore !== undefined && (
          <div style={{ marginBottom: "16px" }}>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "13px",
                fontWeight: "600",
                color: COLORS.ui.textPrimary
              }}>
              Evidence Score
            </h4>
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "20px",
                backgroundColor: COLORS.ui.border,
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "6px"
              }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${summary.evidenceScore}%`,
                  background: (() => {
                    const score = summary.evidenceScore
                    if (score >= 70) return `linear-gradient(90deg, ${COLORS.high.primary}, ${COLORS.high.text})`
                    if (score >= 50) return `linear-gradient(90deg, ${COLORS.medium.primary}, ${COLORS.medium.text})`
                    if (score >= 30) return `linear-gradient(90deg, ${COLORS.medium.text}, ${COLORS.low.primary})`
                    return `linear-gradient(90deg, ${COLORS.low.primary}, ${COLORS.low.text})`
                  })(),
                  borderRadius: "10px 0 0 10px",
                  transition: "width 0.5s ease"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: COLORS.ui.textPrimary,
                  textShadow: "0 0 3px rgba(255,255,255,0.9)",
                  zIndex: 1
                }}>
                {summary.evidenceScore.toFixed(1)}
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "10px",
                color: COLORS.ui.textSecondary,
                lineHeight: "1.3"
              }}>
              Weighted evidence from user comments (0=all against, 100=all for)
            </p>
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
              <span>📋 Claims Mentioned vs What Comments Say ({summary.clickbaitVerdict.claims.length})</span>
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
                  const evidenceData = getClaimEvidenceData(claim)
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
                            {renderBoldMarkup(claimText)}
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
                                  backgroundColor: getClickbaitColorPart(claimStatus, "light"),
                                  borderRadius: "4px",
                                  fontWeight: "600",
                                  color: getClickbaitColorPart(claimStatus, "dark")
                                }}>
                                {claimStatus}
                              </span>
                            )}
                            {/* per-claim confidence removed to avoid duplication with trust score */}
                          </div>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div
                          style={{
                            padding: "12px",
                            backgroundColor: COLORS.ui.background,
                            borderTop: `1px solid ${COLORS.ui.border}`,
                            fontSize: "12px",
                            color: COLORS.ui.textSecondary,
                            lineHeight: "1.6"
                          }}>
                          {evidenceData.hasEvidence ? (
                            <>
                              {/* Evidence For */}
                              {evidenceData.evidenceFor.length > 0 && (
                                <div style={{ marginBottom: evidenceData.evidenceAgainst.length > 0 || evidenceData.dangerWarnings.length > 0 ? "16px" : "0" }}>
                                  <strong style={{ color: COLORS.high.dark, display: "block", marginBottom: "8px" }}>
                                    ✓ Supporting Comments ({evidenceData.evidenceFor.length})
                                  </strong>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {evidenceData.evidenceFor.map((comment, i) => (
                                      <CommentDisplay
                                        key={i}
                                        comment={comment}
                                        videoId={videoId}
                                        showLikes={true}
                                        showAuthor={true}
                                        borderColor={COLORS.high.primary}
                                        backgroundColor={COLORS.high.light}
                                        panelDock={panelDock}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Evidence Against */}
                              {evidenceData.evidenceAgainst.length > 0 && (
                                <div style={{ marginBottom: evidenceData.dangerWarnings.length > 0 ? "16px" : "0" }}>
                                  <strong style={{ color: COLORS.low.dark, display: "block", marginBottom: "8px" }}>
                                    ✗ Contradicting Comments ({evidenceData.evidenceAgainst.length})
                                  </strong>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {evidenceData.evidenceAgainst.map((comment, i) => (
                                      <CommentDisplay
                                        key={i}
                                        comment={comment}
                                        videoId={videoId}
                                        showLikes={true}
                                        showAuthor={true}
                                        borderColor={COLORS.low.primary}
                                        backgroundColor={COLORS.low.light}
                                        panelDock={panelDock}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Danger Warnings */}
                              {evidenceData.dangerWarnings.length > 0 && (
                                <div>
                                  <strong style={{ color: COLORS.medium.dark, display: "block", marginBottom: "8px" }}>
                                    ⚠ Warnings ({evidenceData.dangerWarnings.length})
                                  </strong>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {evidenceData.dangerWarnings.map((comment, i) => (
                                      <CommentDisplay
                                        key={i}
                                        comment={comment}
                                        videoId={videoId}
                                        showLikes={true}
                                        showAuthor={true}
                                        borderColor={COLORS.medium.primary}
                                        backgroundColor={COLORS.medium.light}
                                        panelDock={panelDock}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <em style={{ color: COLORS.ui.textDisabled }}>
                              No specific comment evidence available for this claim.
                            </em>
                          )}
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
