// Claims Tab - Inline-style replica of web-portal ClaimsTab
// Shows expandable claim cards with FOR/AGAINST evidence lanes

import { useState } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { BlurredContent } from "~components/UpgradePrompt"

// Helpers to handle both backend field naming conventions
const getClaimText = (claim: any): string => claim?.claim_text || claim?.claim || ""
const getClaimStatus = (claim: any): string => claim?.status || claim?.verdict || ""

const statusStyles: Record<string, { left: string; stampBg: string; stampText: string; stampBorder: string }> = {
  confirmed: { left: "#10B981", stampBg: "#D1FAE5", stampText: "#065F46", stampBorder: "#10B981" },
  disputed:  { left: "#EF4444", stampBg: "#FEE2E2", stampText: "#991B1B", stampBorder: "#EF4444" },
  unverified:{ left: "#94A3B8", stampBg: "#F1F5F9", stampText: "#475569", stampBorder: "#94A3B8" },
}

interface ClaimsTabNewProps {
  analysis: VideoAnalysis
  panelDock?: "left" | "right"
}

export const ClaimsTabNew = ({ analysis }: ClaimsTabNewProps) => {
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set())

  const summary = (analysis.summary || {}) as any
  const claimsList: any[] = summary.clickbaitVerdict?.claims || []
  const oneLineSummary: string = summary.clickbaitVerdict?.onLineSummary || ""
  const tierRestriction = summary.clickbaitVerdict?.tierRestriction

  const toggle = (i: number) => {
    setExpandedClaims(prev => {
      const s = new Set(prev)
      s.has(i) ? s.delete(i) : s.add(i)
      return s
    })
  }

  if (claimsList.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#6b7280" }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>No claims to verify for this video.</p>
      </div>
    )
  }

  const content = (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {oneLineSummary && (
        <div style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#1E40AF", fontWeight: "500" }}>{oneLineSummary}</p>
        </div>
      )}

      {claimsList.map((claim, i) => {
        const isExpanded = expandedClaims.has(i)
        const status = getClaimStatus(claim).toLowerCase()
        const style = statusStyles[status] ?? statusStyles.unverified
        const evidenceFor: any[] = claim.evidence_for || []
        const evidenceAgainst: any[] = claim.evidence_against || []
        const dangerWarnings: string[] = claim.danger_warnings || []
        const hasEvidence = evidenceFor.length > 0 || evidenceAgainst.length > 0

        return (
          <div key={i} style={{
            borderRadius: "12px",
            backgroundColor: "white",
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            borderLeft: `5px solid ${style.left}`,
          }}>
            {/* Status stamp */}
            <div style={{
              position: "absolute", top: "8px", right: "8px",
              pointerEvents: "none", zIndex: 10, opacity: 0.9,
              transform: "rotate(8deg)",
            }}>
              <div style={{
                padding: "4px 10px", borderRadius: "6px",
                backgroundColor: style.stampBg,
                border: `2.5px solid ${style.stampBorder}`,
              }}>
                <span style={{
                  fontWeight: "900", letterSpacing: "0.08em",
                  fontSize: "10px", lineHeight: 1,
                  color: style.stampText,
                }}>{status.toUpperCase()}</span>
              </div>
            </div>

            {/* Claim header (clickable) */}
            <button
              onClick={() => toggle(i)}
              style={{
                width: "100%", textAlign: "left",
                padding: "16px", paddingRight: "100px",
                background: "none", border: "none", cursor: "pointer",
              }}>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "13px", color: "#1e293b", lineHeight: "1.4" }}>
                {getClaimText(claim)}
              </p>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                {evidenceFor.length > 0 && (
                  <span style={{ fontSize: "10px", color: "#059669", fontWeight: "500" }}>
                    {evidenceFor.length} supporting
                  </span>
                )}
                {evidenceAgainst.length > 0 && (
                  <span style={{ fontSize: "10px", color: "#DC2626", fontWeight: "500" }}>
                    {evidenceAgainst.length} opposing
                  </span>
                )}
              </div>
              {hasEvidence && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <span style={{
                    display: "inline-block", width: "20px", height: "20px",
                    color: "#94a3b8", fontSize: "14px",
                    transition: "transform 0.2s",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}>▼</span>
                </div>
              )}
            </button>

            {/* Evidence panel */}
            {isExpanded && hasEvidence && (
              <div style={{ padding: "0 16px 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
                  {/* FOR lane */}
                  <div style={{ padding: "12px", position: "relative", minHeight: "60px" }}>
                    <div style={{ marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#047857", textTransform: "uppercase" }}>
                        For ({evidenceFor.length})
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {evidenceFor.length > 0 ? evidenceFor.map((c: any, ci: number) => (
                        <div key={ci} style={{ padding: "10px", borderRadius: "8px", backgroundColor: "rgba(209,250,229,0.4)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontWeight: "600", color: "#334155", fontSize: "11px" }}>{c.user || "Viewer"}</span>
                            {c.likes > 0 && <span style={{ color: "#94a3b8", fontSize: "11px" }}>👍 {c.likes}</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: "11px", color: "#475569", fontStyle: "italic", lineHeight: "1.5" }}>
                            &ldquo;{c.text}&rdquo;
                          </p>
                        </div>
                      )) : (
                        <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>No supporting evidence</p>
                      )}
                    </div>
                  </div>

                  {/* AGAINST lane */}
                  <div style={{ padding: "12px", position: "relative", minHeight: "60px", borderLeft: "1px solid #f1f5f9" }}>
                    <div style={{ marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#B91C1C", textTransform: "uppercase" }}>
                        Against ({evidenceAgainst.length})
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {evidenceAgainst.length > 0 ? evidenceAgainst.map((c: any, ci: number) => (
                        <div key={ci} style={{ padding: "10px", borderRadius: "8px", backgroundColor: "rgba(254,226,226,0.4)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontWeight: "600", color: "#334155", fontSize: "11px" }}>{c.user || "Viewer"}</span>
                            {c.likes > 0 && <span style={{ color: "#94a3b8", fontSize: "11px" }}>👍 {c.likes}</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: "11px", color: "#475569", fontStyle: "italic", lineHeight: "1.5" }}>
                            &ldquo;{c.text}&rdquo;
                          </p>
                        </div>
                      )) : (
                        <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>No opposing evidence</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Danger warnings */}
                {dangerWarnings.length > 0 && (
                  <div style={{
                    marginTop: "12px", backgroundColor: "#FEF3C7",
                    borderRadius: "8px", padding: "12px",
                    borderLeft: "4px solid #F59E0B",
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#92400E", textTransform: "uppercase" }}>Warnings</span>
                    <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
                      {dangerWarnings.map((w: string, wi: number) => (
                        <li key={wi} style={{ fontSize: "11px", color: "#78350F", marginTop: "4px" }}>&bull; {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  if (tierRestriction) {
    return <BlurredContent restriction={tierRestriction}>{content}</BlurredContent>
  }
  return content
}
