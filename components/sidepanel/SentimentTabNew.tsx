// Sentiment Tab - Inline-style replica of web-portal SentimentTab
// Sentiment breakdown bars + sample comments in 3-column grid

import { useState } from "react"
import type { VideoAnalysis, CommentObject } from "~types/analysis"
import { BlurredContent } from "~components/UpgradePrompt"
import { useTheme } from "~components/SidePanel"

interface SentimentTabNewProps {
  analysis: VideoAnalysis
  panelDock?: "left" | "right"
}

// Extract text from string or CommentObject
const commentText = (c: string | CommentObject): string =>
  typeof c === "string" ? c : c.text
const commentUser = (c: string | CommentObject): string =>
  typeof c === "string" ? "Viewer" : c.author_display_name || "Viewer"
const commentLikes = (c: string | CommentObject): number =>
  typeof c === "string" ? 0 : c.likes || 0

export const SentimentTabNew = ({ analysis }: SentimentTabNewProps) => {
  const { colors: C, mode } = useTheme()
  const isDark = mode === "dark"
  const sentimentData = (analysis as any)?.sentiment
  const tierRestriction = sentimentData?.tierRestriction

  if (!sentimentData?.distribution) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: C.ui.text.secondary }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>Sentiment data not available.</p>
      </div>
    )
  }

  const dist = sentimentData.distribution
  const total = dist.totalCommentsAnalyzed || (dist.positive + dist.neutral + dist.negative + (dist.mixed || 0)) || 1
  const positivePct = Math.round((dist.positive / total) * 100)
  const neutralPct = Math.round((dist.neutral / total) * 100)
  const negativePct = Math.round((dist.negative / total) * 100)
  const mixedPct = dist.mixed ? Math.round((dist.mixed / total) * 100) : 0

  const examples = dist.exampleComments || {}
  const posExamples: (string | CommentObject)[] = examples.positive || []
  const negExamples: (string | CommentObject)[] = examples.negative || []
  const neuExamples: (string | CommentObject)[] = examples.neutral || []
  const hasSamples = posExamples.length > 0 || negExamples.length > 0 || neuExamples.length > 0

  const filterMeta = sentimentData.filteringMetadata
  const relevant = filterMeta?.filtered_count ?? total
  const totalInput = filterMeta?.total_input ?? total
  const filtered = totalInput - relevant

  const content = (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Breakdown card */}
      <div style={{
        backgroundColor: C.ui.background, borderRadius: "16px",
        border: `1px solid ${C.ui.border}`, padding: "24px",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "16px", flexWrap: "wrap", gap: "8px",
        }}>
          <h4 style={{ margin: 0, fontWeight: "700", fontSize: "12px", color: C.ui.text.secondary, textTransform: "uppercase" }}>
            Sentiment Breakdown
          </h4>
          <span style={{ fontSize: "11px", color: C.ui.text.tertiary }}>
            <strong style={{ color: C.ui.text.primary }}>{relevant.toLocaleString()}</strong> relevant comments analyzed
            {filtered > 0 && <span> ({filtered.toLocaleString()} unrelated filtered out)</span>}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <SentimentBar label="Positive" percentage={positivePct} color="#10b981" count={dist.positive} />
          <SentimentBar label="Neutral" percentage={neutralPct} color="#94a3b8" count={dist.neutral} />
          <SentimentBar label="Negative" percentage={negativePct} color="#ef4444" count={dist.negative} />
          {mixedPct > 0 && <SentimentBar label="Mixed" percentage={mixedPct} color="#fbbf24" count={dist.mixed} />}
        </div>
      </div>

      {/* Sample comments */}
      {hasSamples && (
        <div style={{
          backgroundColor: C.ui.background, borderRadius: "16px",
          border: `1px solid ${C.ui.border}`, padding: "24px",
        }}>
          <h4 style={{ margin: "0 0 16px", fontWeight: "700", fontSize: "12px", color: C.ui.text.secondary, textTransform: "uppercase" }}>
            Sample Comments
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {posExamples.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#059669", textTransform: "uppercase" }}>
                    Positive ({dist.positive.toLocaleString()})
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {posExamples.slice(0, 5).map((c, i) => (
                    <CommentCard key={i} text={commentText(c)} user={commentUser(c)} likes={commentLikes(c)} type="positive" />
                  ))}
                </div>
              </div>
            )}
            {negExamples.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#DC2626", textTransform: "uppercase" }}>
                    Negative ({dist.negative.toLocaleString()})
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {negExamples.slice(0, 5).map((c, i) => (
                    <CommentCard key={i} text={commentText(c)} user={commentUser(c)} likes={commentLikes(c)} type="negative" />
                  ))}
                </div>
              </div>
            )}
            {neuExamples.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                    Neutral ({dist.neutral.toLocaleString()})
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {neuExamples.slice(0, 5).map((c, i) => (
                    <CommentCard key={i} text={commentText(c)} user={commentUser(c)} likes={commentLikes(c)} type="neutral" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (tierRestriction) {
    return <BlurredContent restriction={tierRestriction}>{content}</BlurredContent>
  }
  return content
}

// ── Sentiment bar ───────────────────────────────────────────────────────────────

const SentimentBar = ({ label, percentage, color, count }: { label: string; percentage: number; color: string; count?: number }) => {
  const { colors: C } = useTheme()
  return (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
      <span style={{ fontSize: "12px", fontWeight: "700", color: C.ui.text.primary }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize: "11px", color: C.ui.text.tertiary }}>{count.toLocaleString()}</span>
        )}
        <span style={{ fontSize: "12px", fontWeight: "700", color: C.ui.text.primary }}>{percentage}%</span>
      </div>
    </div>
    <div style={{ width: "100%", backgroundColor: C.ui.surface, height: "8px", borderRadius: "9999px", overflow: "hidden" }}>
      <div style={{ backgroundColor: color, height: "100%", width: `${percentage}%`, transition: "width 0.5s", borderRadius: "9999px" }} />
    </div>
  </div>
)
}

// ── Comment card with truncation ────────────────────────────────────────────────

const CommentCard = ({ text, user, likes, type }: { text: string; user: string; likes: number; type: "positive" | "negative" | "neutral" }) => {
  const [expanded, setExpanded] = useState(false)
  const { colors: C, mode } = useTheme()
  const isDark = mode === "dark"
  const TRUNCATE = 160
  const isLong = text.length > TRUNCATE

  const bgColors = isDark
    ? { positive: "rgba(6,78,59,0.3)", negative: "rgba(127,29,29,0.3)", neutral: C.ui.surface }
    : { positive: "#ECFDF5", negative: "#FEF2F2", neutral: "#F8FAFC" }
  const borderColors = isDark
    ? { positive: "rgba(52,211,153,0.3)", negative: "rgba(248,113,113,0.3)", neutral: C.ui.border }
    : { positive: "#D1FAE5", negative: "#FEE2E2", neutral: "#E2E8F0" }
  const readMoreColors = { positive: "#059669", negative: "#DC2626", neutral: "#64748b" }

  return (
    <div style={{
      backgroundColor: bgColors[type],
      border: `1px solid ${borderColors[type]}`,
      borderRadius: "8px", padding: "12px", fontSize: "11px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontWeight: "600", color: C.ui.text.primary }}>{user}</span>
        {likes > 0 && <span style={{ color: C.ui.text.tertiary }}>👍 {likes}</span>}
      </div>
      <p style={{ margin: 0, color: C.ui.text.secondary, lineHeight: "1.5" }}>
        {isLong && !expanded ? text.slice(0, TRUNCATE).trimEnd() + "…" : text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: "6px", padding: 0, background: "none", border: "none",
            cursor: "pointer", fontWeight: "600", fontSize: "11px",
            color: readMoreColors[type],
          }}>
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  )
}
