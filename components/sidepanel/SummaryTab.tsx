// FR-102 Tab 1: Overview
// Executive Summary + Key Takeaways (no sub-tabs — claims and trust are now independent tabs)

import { useState } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { getClickbaitVerdictColor } from "~lib/colors"
import { useTheme } from "~components/SidePanel"
import { renderBoldMarkup } from "~lib/renderBoldText"

interface SummaryTabProps {
  analysis?: VideoAnalysis | null
  panelDock?: "left" | "right"
}

export const SummaryTab = ({ analysis }: SummaryTabProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const { colors: C, mode } = useTheme()
  const isDark = mode === "dark"

  if (!analysis) return null

  const summary = (analysis.summary || {}) as any
  const executiveSummary = analysis.executiveSummary || "This video has been analyzed by Comment Verdict AI."
  const keyTakeaways: string[] = summary.key_takeaways || summary.keyTakeaways || []
  const verdictColor = getClickbaitVerdictColor(summary.clickbaitVerdict?.label ?? "unknown")
  const verdictColors = C[verdictColor] || C.neutral
  // Dark mode: use more muted tones for exec summary header/takeaways
  const execBg = isDark ? `${verdictColors.primary}22` : (verdictColors.light || C.ui.surface)
  const execBorder = verdictColors.primary || C.ui.border
  const execText = isDark ? verdictColors.primary : (verdictColors.text || C.ui.text.primary)
  const isLong = executiveSummary.length > 200
  const displayText = isLong && !isExpanded ? executiveSummary.slice(0, 200) + "…" : executiveSummary

  const creditCost = analysis.actualCommentsFetched ? Math.ceil(analysis.actualCommentsFetched / 100) : null

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Comment Analysis Info */}
      {(analysis.maxCommentsRequested || analysis.actualCommentsFetched) && (
        <div style={{
          padding: "12px 16px", borderRadius: "12px",
          backgroundColor: isDark ? C.neutral.light : "#eff6ff", border: `1px solid ${isDark ? C.ui.border : "#bfdbfe"}`,
          display: "flex", alignItems: "center", gap: "10px",
          fontSize: "12px", color: isDark ? C.neutral.text : "#1e40af", fontWeight: "600",
        }}>
          <span style={{ fontSize: "16px" }}>📊</span>
          <span>
            {analysis.maxCommentsRequested && analysis.actualCommentsFetched
              ? <>Requested: <strong>{analysis.maxCommentsRequested}</strong> · Analyzed: <strong>{analysis.actualCommentsFetched}</strong>{creditCost != null && <> · Cost: <strong>{creditCost} credit{creditCost !== 1 ? "s" : ""}</strong></>}</>
              : analysis.actualCommentsFetched
                ? <>Analyzed: <strong>{analysis.actualCommentsFetched}</strong> comments{creditCost != null && <> · Cost: <strong>{creditCost} credit{creditCost !== 1 ? "s" : ""}</strong></>}</>
                : null}
          </span>
        </div>
      )}

      {/* Executive Summary */}
      <div style={{
        borderRadius: "16px", border: `1px solid ${C.ui.border}`, overflow: "hidden",
        backgroundColor: C.ui.background, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          padding: "10px 20px",
          backgroundColor: execBg,
          borderBottom: `1px solid ${execBorder}`,
          fontSize: "10px", fontWeight: "900", textTransform: "uppercase" as const,
          letterSpacing: "0.1em",
          color: execText,
        }}>
          Executive Summary
        </div>
        <div style={{ padding: "20px" }}>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.7", color: C.ui.text.primary, fontWeight: "500" }}>
            {renderBoldMarkup(displayText)}
          </p>
          {isLong && (
            <button onClick={() => setIsExpanded(!isExpanded)} style={{
              marginTop: "8px", padding: "4px 8px", fontSize: "12px",
              color: C.neutral.primary, background: "none", border: "none",
              cursor: "pointer", textDecoration: "underline",
            }}>
              {isExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Key Takeaways */}
        {keyTakeaways.length > 0 && (
          <div style={{
            padding: "16px 20px",
            borderTop: `1px solid ${execBorder}`,
            backgroundColor: execBg,
          }}>
            <div style={{
              fontSize: "10px", fontWeight: "900", textTransform: "uppercase" as const,
              letterSpacing: "0.1em", marginBottom: "10px",
              color: execText,
            }}>
              ✨ Key Takeaway{keyTakeaways.length > 1 ? "s" : ""}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
              {keyTakeaways.map((item: string, i: number) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <span style={{
                    marginTop: "6px", width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                    backgroundColor: execBorder,
                  }} />
                  <span style={{ fontSize: "13px", fontWeight: "600", color: C.ui.text.primary, lineHeight: "1.5" }}>{renderBoldMarkup(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
        {analysis.actualCommentsFetched && (
          <StatCard label="Comments" value={analysis.actualCommentsFetched.toLocaleString()} colorKey="neutral" />
        )}
        {(analysis.channelTrust?.trust_score ?? analysis.channelCredibility?.trust_score) != null && (
          <StatCard label="Channel Trust" value={`${Math.round(analysis.channelTrust?.trust_score ?? analysis.channelCredibility?.trust_score ?? 0)}/100`} colorKey="neutral" />
        )}
        {summary.clickbaitVerdict?.claims?.length > 0 && (
          <StatCard label="Key Insights" value={String(analysis.topicClustersData?.clusters?.length || summary.clickbaitVerdict.claims.length)} colorKey="medium" />
        )}
        {(() => {
          const dist = (analysis as any)?.sentiment?.distribution
          if (!dist) return null
          const total = dist.totalCommentsAnalyzed || (dist.positive + dist.neutral + dist.negative + (dist.mixed || 0))
          if (!total) return null
          const posPct = Math.round((dist.positive / total) * 100)
          return <StatCard label="Positive Sentiment" value={`${posPct}%`} colorKey="high" />
        })()}
        {analysis.contentGaps?.unansweredQuestions?.length != null && (
          <StatCard label="Gaps" value={String(analysis.contentGaps.unansweredQuestions.length)} colorKey="low" />
        )}
      </div>
    </div>
  )
}

const StatCard = ({ label, value, colorKey }: { label: string; value: string; colorKey: "high" | "medium" | "low" | "neutral" }) => {
  const { colors: C } = useTheme()
  const ck = C[colorKey]
  return (
    <div style={{ padding: "12px", borderRadius: "12px", backgroundColor: ck.light, border: `1px solid ${ck.primary}` }}>
      <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase" as const, color: ck.text }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: "900", color: ck.text, marginTop: "2px" }}>{value}</div>
    </div>
  )
}

