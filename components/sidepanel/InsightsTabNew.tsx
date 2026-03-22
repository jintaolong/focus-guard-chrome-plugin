// Insights Tab - Inline-style replica of web-portal InsightsTab
// Horizontal tree: Parent Themes → Clusters → Quotes with SVG edge connectors

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import type { VideoAnalysis, TopicCluster, ParentTheme, SegmentHighlight } from "~types/analysis"
import { BlurredContent } from "~components/UpgradePrompt"

type SortBy = "insight_score" | "comments"

interface InsightsTabNewProps {
  analysis: VideoAnalysis
  panelDock?: "left" | "right"
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

const getCategoryColor = (cat: string): string => {
  const colors: Record<string, string> = {
    narrative: "#8B5CF6", question: "#F59E0B", sentiment: "#10B981",
    issue: "#EF4444", observation: "#3B82F6",
  }
  return colors[cat] || "#6B7280"
}

const intensity = (val: number, max: number) =>
  Math.max(0.35, Math.min(1, val / max))

const opaqueBlend = (r: number, g: number, b: number, a: number) => {
  const rr = Math.round(255 + (r - 255) * a)
  const gg = Math.round(255 + (g - 255) * a)
  const bb = Math.round(255 + (b - 255) * a)
  return `rgb(${rr}, ${gg}, ${bb})`
}

// ── Main component ──────────────────────────────────────────────────────────────

export const InsightsTabNew = ({ analysis }: InsightsTabNewProps) => {
  const topicData = analysis.topicClustersData
  const viewerInsights = (analysis as any)?.viewerInsights
  const tierRestriction = viewerInsights?.tierRestriction

  const allClusters = topicData?.clusters || []
  const parentThemes = topicData?.parent_themes || []

  const [sortBy, setSortBy] = useState<SortBy>("insight_score")
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null)

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [minInsightScore, setMinInsightScore] = useState(0)
  const [minCommentCount, setMinCommentCount] = useState(1)

  // Animation
  const [animPhase, setAnimPhase] = useState<"idle" | "slide-left" | "show-children">("idle")
  const navLevel = selectedClusterId !== null ? 3 : selectedThemeId !== null ? 2 : 1
  const prevNavLevelRef = useRef(1)

  useEffect(() => {
    const prev = prevNavLevelRef.current
    prevNavLevelRef.current = navLevel
    childNodesRef.current.clear()
    if (navLevel > prev) {
      setAnimPhase("slide-left")
      const t = setTimeout(() => setAnimPhase("show-children"), 350)
      return () => clearTimeout(t)
    } else if (navLevel >= 2) {
      setAnimPhase("show-children")
    } else {
      setAnimPhase("idle")
    }
  }, [navLevel])

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
  }, [animPhase, measureEdges, selectedThemeId, selectedClusterId])

  useEffect(() => {
    const handler = () => measureEdges()
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [measureEdges])

  // Derived data
  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    allClusters.forEach(c => { if (c.category) cats.add(c.category) })
    return Array.from(cats).sort()
  }, [allClusters])

  const filteredClusters = useMemo(() =>
    allClusters.filter(c => {
      if (c.insight_score < minInsightScore) return false
      if (selectedCategories.length > 0 && !selectedCategories.includes(c.category)) return false
      if (c.count < minCommentCount) return false
      return true
    }),
  [allClusters, minInsightScore, selectedCategories, minCommentCount])

  const sortedThemes = useMemo(() => {
    const t = [...parentThemes]
    if (sortBy === "insight_score") t.sort((a, b) => b.avg_insight_score - a.avg_insight_score)
    else t.sort((a, b) => b.total_comment_count - a.total_comment_count)
    return t
  }, [parentThemes, sortBy])

  const selectedTheme = parentThemes.find(t => t.parent_id === selectedThemeId)
  const selectedCluster = filteredClusters.find(c => c.cluster_id === selectedClusterId)

  const sortedClusters = useMemo(() => {
    if (!selectedTheme) return []
    const clusters = selectedTheme.child_clusters
      .map(cc => filteredClusters.find(fc => fc.cluster_id === cc.cluster_id))
      .filter((c): c is TopicCluster => c != null)
    if (sortBy === "insight_score") clusters.sort((a, b) => b.insight_score - a.insight_score)
    else clusters.sort((a, b) => b.count - a.count)
    return clusters
  }, [selectedTheme, filteredClusters, sortBy])

  const sortedQuotes = useMemo(() => {
    if (!selectedCluster) return []
    const highlights = selectedCluster.segment_highlights ?? []
    if (highlights.length > 0) return [...highlights].sort((a, b) => (b.likes || 0) - (a.likes || 0))
    return (selectedCluster.supporting_quotes ?? []).map((q, i) => ({
      highlighted_segment: typeof q === "string" ? q : q.text,
      user: typeof q === "string" ? "Viewer" : q.author_display_name || "Viewer",
      likes: typeof q === "string" ? 0 : q.likes || 0,
      parent_comment_text: typeof q === "string" ? q : q.text,
      char_range: [0, (typeof q === "string" ? q : q.text).length] as [number, number],
      is_full_comment: true,
    }))
  }, [selectedCluster])

  const maxThemeScore = useMemo(() =>
    Math.max(1, ...parentThemes.map(t => sortBy === "insight_score" ? t.avg_insight_score : t.total_comment_count)),
  [parentThemes, sortBy])
  const maxClusterScore = useMemo(() =>
    Math.max(1, ...sortedClusters.map(c => sortBy === "insight_score" ? c.insight_score : c.count)),
  [sortedClusters, sortBy])
  const maxQuoteLikes = useMemo(() =>
    Math.max(1, ...sortedQuotes.map(q => q.likes || 0)),
  [sortedQuotes])

  // Breadcrumb
  const breadcrumb = selectedCluster
    ? [
        { label: "All Themes", onClick: () => { setSelectedThemeId(null); setSelectedClusterId(null) } },
        ...(selectedTheme ? [{ label: truncStr(selectedTheme.parent_statement, 35), onClick: () => setSelectedClusterId(null) }] : []),
        { label: truncStr(selectedCluster.statement, 40), onClick: () => {} },
      ]
    : selectedTheme
      ? [
          { label: "All Themes", onClick: () => { setSelectedThemeId(null); setSelectedClusterId(null) } },
          { label: truncStr(selectedTheme.parent_statement, 45), onClick: () => {} },
        ]
      : [{ label: parentThemes.length > 0 ? "All Themes" : "All Clusters", onClick: () => {} }]

  if (allClusters.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#6b7280" }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>No insights data available.</p>
      </div>
    )
  }

  const content = (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filter bar */}
      <FilterBar
        allCategories={allCategories}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        minInsightScore={minInsightScore}
        setMinInsightScore={setMinInsightScore}
        minCommentCount={minCommentCount}
        setMinCommentCount={setMinCommentCount}
        sortBy={sortBy}
        setSortBy={setSortBy}
        getCategoryColor={getCategoryColor}
      />

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", flexWrap: "wrap" }}>
        {breadcrumb.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: "#94a3b8", fontSize: "10px" }}>▶</span>}
            <button
              onClick={item.onClick}
              style={{
                padding: "4px 8px", borderRadius: "6px", border: "none", cursor: "pointer",
                background: i === breadcrumb.length - 1 ? "#DBEAFE" : "transparent",
                color: i === breadcrumb.length - 1 ? "#1D4ED8" : "#64748b",
                fontWeight: i === breadcrumb.length - 1 ? "700" : "500",
                fontSize: "11px",
              }}>
              {item.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* === LEVEL 3: Cluster → quotes === */}
      {selectedCluster && selectedTheme && (
        <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "32px", overflowX: "auto", paddingBottom: "8px" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, overflow: "visible" }}>
            {edgePaths.map((d, i) => <path key={i} d={d} stroke="#93c5fd" strokeWidth="2" fill="none" />)}
          </svg>
          <div ref={parentNodeRef} style={{
            flexShrink: 0, width: "220px", zIndex: 10,
            borderRadius: "12px", border: "2px solid #60a5fa",
            backgroundColor: "#2563eb", color: "white", padding: "12px",
            boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
          }}>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", lineHeight: "1.5" }}>{selectedCluster.statement}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px", fontSize: "10px", opacity: 0.8 }}>
              <span>{selectedCluster.count} comments</span>
              <span>Score: {selectedCluster.insight_score.toFixed(1)}</span>
              <span style={{ textTransform: "capitalize" }}>{selectedCluster.category}</span>
            </div>
          </div>
          <div style={{
            flexShrink: 0, width: "280px", display: "flex", flexDirection: "column", gap: "8px",
            zIndex: 10, transition: "opacity 0.5s, transform 0.5s",
            opacity: animPhase === "show-children" ? 1 : 0,
            transform: animPhase === "show-children" ? "translateX(0)" : "translateX(32px)",
          }}>
            {sortedQuotes.length > 0 ? sortedQuotes.map((q, qi) => {
              const opac = intensity(q.likes || 0, maxQuoteLikes)
              return (
                <div key={qi}
                  ref={el => { if (el) childNodesRef.current.set(qi, el); else childNodesRef.current.delete(qi) }}
                  style={{
                    borderRadius: "12px", padding: "12px",
                    backgroundColor: opaqueBlend(99, 102, 241, opac * 0.15 + 0.05),
                    border: `1px solid ${opaqueBlend(99, 102, 241, opac * 0.5 + 0.2)}`,
                    transitionDelay: `${qi * 40}ms`,
                  }}>
                  <p style={{ margin: 0, fontSize: "11px", color: "#334155", lineHeight: "1.5" }}>{q.highlighted_segment}</p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "10px", color: "#94a3b8" }}>
                    <span>{q.user || "Viewer"}</span>
                    {q.likes > 0 && <span>{q.likes} likes</span>}
                  </div>
                </div>
              )
            }) : (
              <div style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic", padding: "12px" }}>No supporting quotes available</div>
            )}
          </div>
        </div>
      )}

      {/* === LEVEL 2: Theme → clusters === */}
      {!selectedCluster && selectedTheme && (
        <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "32px", overflowX: "auto", paddingBottom: "8px" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, overflow: "visible" }}>
            {edgePaths.map((d, i) => <path key={i} d={d} stroke="#c4b5fd" strokeWidth="2" fill="none" />)}
          </svg>
          {/* Themes column */}
          <div style={{ flexShrink: 0, width: "220px", display: "flex", flexDirection: "column", gap: "8px", zIndex: 10 }}>
            {sortedThemes.map(t => {
              const isSel = t.parent_id === selectedThemeId
              const opac = intensity(sortBy === "insight_score" ? t.avg_insight_score : t.total_comment_count, maxThemeScore)
              if (!isSel) return (
                <div key={t.parent_id}
                  onClick={() => { setSelectedThemeId(t.parent_id); setSelectedClusterId(null) }}
                  style={{
                    borderRadius: "12px", padding: "12px", cursor: "pointer",
                    border: "1px solid #e2e8f0", opacity: 0.4,
                    backgroundColor: `rgba(139,92,246,${opac * 0.3})`,
                    display: "none", // Hide non-selected on mobile, but we show inline for the panel
                  }} />
              )
              return (
                <div key={t.parent_id} ref={parentNodeRef}
                  style={{
                    borderRadius: "12px", padding: "12px", cursor: "pointer",
                    border: "2px solid #a78bfa", boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                    backgroundColor: `rgba(139,92,246,${opac})`,
                  }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "white", lineHeight: "1.5" }}>{t.parent_statement}</p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>
                    <span>{t.child_count} clusters</span>
                    <span>Avg: {t.avg_insight_score.toFixed(1)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Clusters column */}
          <div style={{
            flexShrink: 0, width: "260px", display: "flex", flexDirection: "column", gap: "8px",
            zIndex: 10, transition: "opacity 0.5s, transform 0.5s",
            opacity: animPhase === "show-children" ? 1 : 0,
            transform: animPhase === "show-children" ? "translateX(0)" : "translateX(32px)",
          }}>
            {sortedClusters.length > 0 ? sortedClusters.map((c, ci) => {
              const opac = intensity(sortBy === "insight_score" ? c.insight_score : c.count, maxClusterScore)
              return (
                <div key={c.cluster_id}
                  ref={el => { if (el) childNodesRef.current.set(ci, el); else childNodesRef.current.delete(ci) }}
                  onClick={() => setSelectedClusterId(c.cluster_id)}
                  style={{
                    borderRadius: "12px", padding: "12px", cursor: "pointer",
                    border: "1px solid #93c5fd",
                    backgroundColor: `rgba(59,130,246,${opac})`,
                    transitionDelay: `${ci * 40}ms`,
                  }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "white", lineHeight: "1.5" }}>{c.statement}</p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>
                    <span>{c.count} comments</span>
                    <span>Score: {c.insight_score.toFixed(1)}</span>
                    <span style={{ textTransform: "capitalize" }}>{c.category}</span>
                  </div>
                </div>
              )
            }) : (
              <div style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic", padding: "12px" }}>No clusters match filters</div>
            )}
          </div>
        </div>
      )}

      {/* === LEVEL 1: All themes (or clusters) list === */}
      {!selectedTheme && !selectedCluster && (() => {
        const hasThemes = parentThemes.length > 0
        return hasThemes ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "500px", margin: "0 auto" }}>
            {sortedThemes.map(t => {
              const val = sortBy === "insight_score" ? t.avg_insight_score : t.total_comment_count
              const opac = intensity(val, maxThemeScore)
              return (
                <div key={t.parent_id}
                  onClick={() => { setSelectedThemeId(t.parent_id); setSelectedClusterId(null) }}
                  style={{
                    borderRadius: "12px", padding: "16px", cursor: "pointer",
                    border: "1px solid #c4b5fd",
                    backgroundColor: `rgba(139,92,246,${opac})`,
                    transition: "box-shadow 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(139,92,246,0.3)" }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "white", lineHeight: "1.5" }}>{t.parent_statement}</p>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                    <span>{t.child_count} clusters</span>
                    <span>{t.total_comment_count} comments</span>
                    <span>Avg Score: {t.avg_insight_score.toFixed(1)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "500px", margin: "0 auto" }}>
            {filteredClusters.sort((a, b) => sortBy === "insight_score" ? b.insight_score - a.insight_score : b.count - a.count).map(c => {
              const maxVal = Math.max(1, ...filteredClusters.map(cc => sortBy === "insight_score" ? cc.insight_score : cc.count))
              const opac = intensity(sortBy === "insight_score" ? c.insight_score : c.count, maxVal)
              return (
                <div key={c.cluster_id}
                  onClick={() => setSelectedClusterId(c.cluster_id)}
                  style={{
                    borderRadius: "12px", padding: "16px", cursor: "pointer",
                    border: "1px solid #93c5fd",
                    backgroundColor: `rgba(59,130,246,${opac})`,
                    transition: "box-shadow 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.3)" }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "white", lineHeight: "1.5" }}>{c.statement}</p>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                    <span>{c.count} comments</span>
                    <span>Score: {c.insight_score.toFixed(1)}</span>
                    <span style={{ textTransform: "capitalize" }}>{c.category}</span>
                  </div>
                </div>
              )
            })}
            {filteredClusters.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
                <p style={{ margin: 0, fontWeight: "600" }}>No insights match your filters</p>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )

  if (tierRestriction) {
    return <BlurredContent restriction={tierRestriction}>{content}</BlurredContent>
  }
  return content
}

// ── Filter bar ──────────────────────────────────────────────────────────────────

const FilterBar = ({
  allCategories, selectedCategories, setSelectedCategories, getCategoryColor,
  minInsightScore, setMinInsightScore, minCommentCount, setMinCommentCount,
  sortBy, setSortBy,
}: {
  allCategories: string[]
  selectedCategories: string[]
  setSelectedCategories: (c: string[]) => void
  getCategoryColor: (cat: string) => string
  minInsightScore: number
  setMinInsightScore: (n: number) => void
  minCommentCount: number
  setMinCommentCount: (n: number) => void
  sortBy: SortBy
  setSortBy: (s: SortBy) => void
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [localScore, setLocalScore] = useState(minInsightScore)
  const [localComments, setLocalComments] = useState(minCommentCount)

  const pillActive: React.CSSProperties = { borderRadius: "9999px", padding: "4px 12px", fontSize: "11px", fontWeight: "700", border: "none", cursor: "pointer", transition: "all 0.15s" }

  return (
    <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "12px" }}>
      {/* Sort */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Sort:</span>
        <button onClick={() => setSortBy("insight_score")} style={{ ...pillActive, backgroundColor: sortBy === "insight_score" ? "#7c3aed" : "#f1f5f9", color: sortBy === "insight_score" ? "white" : "#475569" }}>Insight Score</button>
        <button onClick={() => setSortBy("comments")} style={{ ...pillActive, backgroundColor: sortBy === "comments" ? "#7c3aed" : "#f1f5f9", color: sortBy === "comments" ? "white" : "#475569" }}>Comments</button>
        <button onClick={() => setFiltersOpen(o => !o)} style={{ ...pillActive, marginLeft: "auto", backgroundColor: "#f1f5f9", color: "#64748b" }}>
          {filtersOpen ? "Hide Filters" : "Filters"}
        </button>
      </div>
      {/* Filters */}
      {filtersOpen && (
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Categories:</span>
          {allCategories.map(cat => {
            const active = selectedCategories.includes(cat)
            return (
              <button key={cat} onClick={() => {
                setSelectedCategories(active ? selectedCategories.filter(c => c !== cat) : [...selectedCategories, cat])
              }} style={{
                ...pillActive,
                backgroundColor: active ? getCategoryColor(cat) : "#f1f5f9",
                color: active ? "white" : "#475569",
              }}>{cat}</button>
            )
          })}
          <div style={{ width: "1px", height: "20px", backgroundColor: "#e2e8f0", margin: "0 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", whiteSpace: "nowrap" }}>Min Score: {localScore}</span>
            <input type="range" min={0} max={10} step={0.5} value={localScore}
              onChange={e => setLocalScore(parseFloat(e.target.value))}
              onMouseUp={e => setMinInsightScore(parseFloat((e.target as HTMLInputElement).value))}
              onTouchEnd={e => setMinInsightScore(parseFloat((e.target as HTMLInputElement).value))}
              style={{ width: "100px" }} />
          </div>
          <div style={{ width: "1px", height: "20px", backgroundColor: "#e2e8f0", margin: "0 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", whiteSpace: "nowrap" }}>Min Comments: {localComments}</span>
            <input type="range" min={1} max={20} step={1} value={localComments}
              onChange={e => setLocalComments(parseInt(e.target.value))}
              onMouseUp={e => setMinCommentCount(parseInt((e.target as HTMLInputElement).value))}
              onTouchEnd={e => setMinCommentCount(parseInt((e.target as HTMLInputElement).value))}
              style={{ width: "100px" }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Utility ─────────────────────────────────────────────────────────────────────

function truncStr(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + "…" : s
}
