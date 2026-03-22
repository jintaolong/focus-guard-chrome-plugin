// Gaps Tab — Inline-style replica of web-portal GapsTab
// Horizontal 2-level tree: Gaps → Supporting Comments with SVG edge connectors

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import type { VideoAnalysis, InsightWithComments, Comment as CommentType, CommentObject } from "~types/analysis"
import { BlurredContent } from "~components/UpgradePrompt"

interface GapsTabNewProps {
  analysis: VideoAnalysis
  panelDock?: "left" | "right"
}

// ── Demand-level styling helpers ────────────────────────────────────────────────
// Map from extension's `type` field to demand-like visual treatment

const demandFromType = (type: string): string => {
  if (type === "issue") return "Critical"
  if (type === "gap") return "High"
  return "Medium"
}

const demandFromCommentCount = (count: number): string => {
  if (count >= 10) return "Critical"
  if (count >= 5) return "High"
  if (count >= 2) return "Medium"
  return "Low"
}

const demandTextColor = (d: string) =>
  d === "Critical" ? "#991b1b" : d === "High" ? "#9a3412" : d === "Medium" ? "#854d0e" : "#166534"

const demandBg = (d: string) =>
  d === "Critical" ? "#fef2f2" : d === "High" ? "#fff7ed" : d === "Medium" ? "#fefce8" : "#f0fdf4"

const demandBorder = (d: string) =>
  d === "Critical" ? "#fca5a5" : d === "High" ? "#fdba74" : d === "Medium" ? "#fde047" : "#86efac"

const demandOrder: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 }

// ── Main component ──────────────────────────────────────────────────────────────

export const GapsTabNew = ({ analysis }: GapsTabNewProps) => {
  const contentGaps = analysis.contentGaps
  const tierRestriction = contentGaps?.tierRestriction
  const questions = contentGaps?.unansweredQuestions || []

  const [selectedGapIdx, setSelectedGapIdx] = useState<number | null>(null)
  const [animPhase, setAnimPhase] = useState<"idle" | "slide-left" | "show-children">("idle")
  const prevHasSelection = useRef(false)

  useEffect(() => {
    const hasSel = selectedGapIdx !== null
    if (hasSel && !prevHasSelection.current) {
      childNodesRef.current.clear()
      setAnimPhase("slide-left")
      const t = setTimeout(() => setAnimPhase("show-children"), 350)
      prevHasSelection.current = hasSel
      return () => clearTimeout(t)
    } else if (!hasSel) {
      setAnimPhase("idle")
    }
    prevHasSelection.current = hasSel
  }, [selectedGapIdx])

  // Edge connectors
  const parentNodeRef = useRef<HTMLDivElement>(null)
  const childNodesRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const [edgePaths, setEdgePaths] = useState<string[]>([])

  const measureEdges = useCallback(() => {
    const parent = parentNodeRef.current
    const container = containerRef.current
    if (!parent || !container) { setEdgePaths([]); return }
    const cr = container.getBoundingClientRect()
    const pr = parent.getBoundingClientRect()
    const pRight = pr.right - cr.left
    const pCy = pr.top + pr.height / 2 - cr.top
    const paths: string[] = []
    childNodesRef.current.forEach(el => {
      const r = el.getBoundingClientRect()
      const cLeft = r.left - cr.left
      const cCy = r.top + r.height / 2 - cr.top
      const cpx = (pRight + cLeft) / 2
      paths.push(`M ${pRight} ${pCy} C ${cpx} ${pCy}, ${cpx} ${cCy}, ${cLeft} ${cCy}`)
    })
    setEdgePaths(paths)
  }, [])

  useEffect(() => {
    if (animPhase === "show-children") {
      const t1 = setTimeout(measureEdges, 60)
      const t2 = setTimeout(measureEdges, 300)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    } else { setEdgePaths([]) }
  }, [animPhase, measureEdges, selectedGapIdx])

  useEffect(() => {
    const handler = () => measureEdges()
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [measureEdges])

  // Sort gaps by demand (highest first)
  const sortedGaps = useMemo(() => {
    return [...questions].sort((a, b) => {
      const dA = demandOrder[demandFromCommentCount(a.commentCount)] || 0
      const dB = demandOrder[demandFromCommentCount(b.commentCount)] || 0
      return dB - dA
    })
  }, [questions])

  const selectedGap: InsightWithComments | null = selectedGapIdx !== null ? sortedGaps[selectedGapIdx] ?? null : null

  const getCommentText = (c: CommentType | CommentObject | string): string =>
    typeof c === "string" ? c : c.text

  const getCommentAuthor = (c: CommentType | CommentObject | string): string => {
    if (typeof c === "string") return "Viewer"
    return (c as any).author_display_name || (c as any).author || "Viewer"
  }

  const getCommentLikes = (c: CommentType | CommentObject | string): number => {
    if (typeof c === "string") return 0
    return (c as any).likes || 0
  }

  if (questions.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#16a34a" }}>
          No content gaps detected — the video appears to cover most viewer requests!
        </p>
      </div>
    )
  }

  const content = (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Summary */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 16px", borderRadius: "12px",
        backgroundColor: "#fef3c7", border: "1px solid #fde68a",
      }}>
        <span style={{ fontSize: "20px" }}>⚠️</span>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#92400e" }}>
          {sortedGaps.length} unanswered viewer request{sortedGaps.length !== 1 ? "s" : ""} found
        </span>
        {contentGaps?.gapCoverageScore !== undefined && (
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "#78716c", fontWeight: "500" }}>
            Coverage: {contentGaps.gapCoverageScore}%
          </span>
        )}
      </div>

      {/* Filtering metadata */}
      {contentGaps?.filteringMetadata?.after_layer2 !== undefined && (
        <div style={{ fontSize: "11px", color: "#94a3b8", display: "flex", gap: "8px" }}>
          <span>🔬 {contentGaps.filteringMetadata.after_layer2} relevant questions from {contentGaps.filteringMetadata.total_input ?? "?"} total</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
        <button onClick={() => setSelectedGapIdx(null)} style={{
          border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer",
          background: selectedGapIdx === null ? "#FEF3C7" : "transparent",
          color: selectedGapIdx === null ? "#92400E" : "#64748b",
          fontWeight: selectedGapIdx === null ? "700" : "500", fontSize: "11px",
        }}>All Gaps</button>
        {selectedGap && (
          <>
            <span style={{ color: "#94a3b8", fontSize: "10px" }}>▶</span>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#92400E", padding: "4px 8px", backgroundColor: "#FEF3C7", borderRadius: "6px" }}>
              {selectedGap.statement.length > 50 ? selectedGap.statement.slice(0, 50) + "…" : selectedGap.statement}
            </span>
          </>
        )}
      </div>

      {/* === SELECTED GAP → Comments (level 2) === */}
      {selectedGap && (
        <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "32px", overflowX: "auto", paddingBottom: "8px" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, overflow: "visible" }}>
            {edgePaths.map((d, i) => <path key={i} d={d} stroke="#fde68a" strokeWidth="2" fill="none" />)}
          </svg>

          {/* Parent: selected gap */}
          <div ref={parentNodeRef} style={{
            flexShrink: 0, width: "220px", zIndex: 10,
            borderRadius: "12px", padding: "12px",
            border: `2px solid ${demandBorder(demandFromCommentCount(selectedGap.commentCount))}`,
            backgroundColor: demandBg(demandFromCommentCount(selectedGap.commentCount)),
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <span style={{
                fontSize: "10px", fontWeight: "700", textTransform: "uppercase",
                color: demandTextColor(demandFromCommentCount(selectedGap.commentCount)),
              }}>{demandFromCommentCount(selectedGap.commentCount)} demand</span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#1e293b", lineHeight: "1.5" }}>
              {selectedGap.statement}
            </p>
            <span style={{ display: "block", marginTop: "6px", fontSize: "10px", color: "#94a3b8" }}>
              {selectedGap.commentCount} comment{selectedGap.commentCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Children: supporting comments */}
          <div style={{
            flexShrink: 0, width: "280px", display: "flex", flexDirection: "column", gap: "8px",
            zIndex: 10, transition: "opacity 0.5s, transform 0.5s",
            opacity: animPhase === "show-children" ? 1 : 0,
            transform: animPhase === "show-children" ? "translateX(0)" : "translateX(32px)",
          }}>
            {selectedGap.supportingComments && selectedGap.supportingComments.length > 0
              ? selectedGap.supportingComments.map((comment, ci) => (
                  <div key={ci}
                    ref={el => { if (el) childNodesRef.current.set(ci, el); else childNodesRef.current.delete(ci) }}
                    style={{
                      borderRadius: "12px", padding: "12px",
                      border: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
                      transitionDelay: `${ci * 40}ms`,
                    }}>
                    <p style={{ margin: 0, fontSize: "11px", color: "#334155", lineHeight: "1.5" }}>
                      {getCommentText(comment)}
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "10px", color: "#94a3b8" }}>
                      <span>{getCommentAuthor(comment)}</span>
                      {getCommentLikes(comment) > 0 && <span>{getCommentLikes(comment)} likes</span>}
                    </div>
                  </div>
                ))
              : (
                <div style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic", padding: "12px" }}>
                  No supporting comments available
                </div>
              )}
          </div>
        </div>
      )}

      {/* === ALL GAPS LIST (level 1) === */}
      {selectedGapIdx === null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "500px", margin: "0 auto" }}>
          {sortedGaps.map((gap, i) => {
            const demand = demandFromCommentCount(gap.commentCount)
            return (
              <div key={gap.id || i}
                onClick={() => setSelectedGapIdx(i)}
                style={{
                  borderRadius: "12px", padding: "16px", cursor: "pointer",
                  border: `1px solid ${demandBorder(demand)}`,
                  backgroundColor: demandBg(demand),
                  transition: "box-shadow 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)" }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{
                    fontSize: "10px", fontWeight: "700", textTransform: "uppercase",
                    color: demandTextColor(demand),
                  }}>{demand} demand</span>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {gap.commentCount} comment{gap.commentCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#1e293b", lineHeight: "1.5" }}>
                  {gap.statement}
                </p>
                {gap.supportingComments && gap.supportingComments.length > 0 && (
                  <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
                    "{getCommentText(gap.supportingComments[0]).slice(0, 80)}
                    {getCommentText(gap.supportingComments[0]).length > 80 ? "…" : ""}"
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  if (tierRestriction) {
    return <BlurredContent restriction={tierRestriction}>{content}</BlurredContent>
  }
  return content
}
