// Sentiment Tab - Inline-style replica of web-portal SentimentTab
// Sentiment breakdown bars + sample comments in 3-column grid

import { useState } from "react"
import type { VideoAnalysis, CommentObject } from "~types/analysis"
import { BlurredContent } from "~components/UpgradePrompt"

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
  const sentimentData = (analysis as any)?.sentiment
  const tierRestriction = sentimentData?.tierRestriction

  if (!sentimentData?.distribution) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#6b7280" }}>
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
        backgroundColor: "white", borderRadius: "16px",
        border: "1px solid #e2e8f0", padding: "24px",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "16px", flexWrap: "wrap", gap: "8px",
        }}>
          <h4 style={{ margin: 0, fontWeight: "700", fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>
            Sentiment Breakdown
          </h4>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            <strong style={{ color: "#475569" }}>{relevant.toLocaleString()}</strong> relevant comments analyzed
            {filtered > 0 && <span> ({filtered.toLocaleString()} unrelated filtered out)</span>}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <SentimentBar label="Positive" percentage={positivePct} color="#10b981" />
          <SentimentBar label="Neutral" percentage={neutralPct} color="#94a3b8" />
          <SentimentBar label="Negative" percentage={negativePct} color="#ef4444" />
          {mixedPct > 0 && <SentimentBar label="Mixed" percentage={mixedPct} color="#fbbf24" />}
        </div>
      </div>

      {/* Sample comments */}
      {hasSamples && (
        <div style={{
          backgroundColor: "white", borderRadius: "16px",
          border: "1px solid #e2e8f0", padding: "24px",
        }}>
          <h4 style={{ margin: "0 0 16px", fontWeight: "700", fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>
            Sample Comments
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {posExamples.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#059669", textTransform: "uppercase" }}>
                    Positive ({posExamples.length})
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
                    Negative ({negExamples.length})
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
                    Neutral ({neuExamples.length})
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

const SentimentBar = ({ label, percentage, color }: { label: string; percentage: number; color: string }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
      <span style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>{percentage}%</span>
    </div>
    <div style={{ width: "100%", backgroundColor: "#f1f5f9", height: "8px", borderRadius: "9999px", overflow: "hidden" }}>
      <div style={{ backgroundColor: color, height: "100%", width: `${percentage}%`, transition: "width 0.5s", borderRadius: "9999px" }} />
    </div>
  </div>
)

// ── Comment card with truncation ────────────────────────────────────────────────

const CommentCard = ({ text, user, likes, type }: { text: string; user: string; likes: number; type: "positive" | "negative" | "neutral" }) => {
  const [expanded, setExpanded] = useState(false)
  const TRUNCATE = 160
  const isLong = text.length > TRUNCATE

  const bgColors = { positive: "#ECFDF5", negative: "#FEF2F2", neutral: "#F8FAFC" }
  const borderColors = { positive: "#D1FAE5", negative: "#FEE2E2", neutral: "#E2E8F0" }
  const readMoreColors = { positive: "#059669", negative: "#DC2626", neutral: "#64748b" }

  return (
    <div style={{
      backgroundColor: bgColors[type],
      border: `1px solid ${borderColors[type]}`,
      borderRadius: "8px", padding: "12px", fontSize: "11px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontWeight: "600", color: "#334155" }}>{user}</span>
        {likes > 0 && <span style={{ color: "#94a3b8" }}>👍 {likes}</span>}
      </div>
      <p style={{ margin: 0, color: "#475569", lineHeight: "1.5" }}>
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
