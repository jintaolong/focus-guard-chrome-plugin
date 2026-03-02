// FR-102: Focus Guard Side-Panel Component
// Main collapsible panel with 4 tabs

import { useState } from "react"
import type { VideoAnalysis, AnalysisHistoryItem } from "~types/analysis"
import { COLORS } from "~lib/colors"
import { SummaryTab } from "./sidepanel/SummaryTab"
import { KeyInsightsTab } from "./sidepanel/KeyInsightsTab"
import { CommentSentimentTab } from "./sidepanel/CommentSentimentTab"
import { ContentGapsTab } from "./sidepanel/ContentGapsTab"
import { ReportTab } from "./sidepanel/ReportTab"

type TabId = "summary" | "sentiment" | "insights" | "gaps" | "report"

interface SidePanelProps {
  analysis: VideoAnalysis | null
  isLoading: boolean
  isOpen: boolean
  position?: "left" | "right"
  panelDock?: "left" | "right"
  history?: AnalysisHistoryItem[]
  onClose: () => void
  onDownloadReport?: (format: "PDF" | "TXT") => void
  onReAnalyze?: (videoId: string) => void
  onDownloadHistoryReport?: (videoId: string) => void
  onBotFilterChange?: (enabled: boolean) => void
  onForceRefresh?: () => void
  progressPercent?: number | null
  progressMessage?: string | null
}

export const SidePanel = ({
  analysis,
  isLoading,
  isOpen,
  position = "right",
  panelDock,
  history,
  onClose,
  onDownloadReport,
  onReAnalyze,
  onDownloadHistoryReport,
  onBotFilterChange,
  onForceRefresh,
  progressPercent,
  progressMessage
}: SidePanelProps) => {
  const dock = panelDock ?? position
  const [activeTab, setActiveTab] = useState<TabId>("summary")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const sentimentData = (analysis as any)?.sentiment
  const viewerInsightsData = (analysis as any)?.viewerInsights
  const hasSentimentDataOrRestriction = Boolean(
    sentimentData?.distribution || sentimentData?.tierRestriction
  )
  const hasViewerInsightsDataOrRestriction = Boolean(
    (viewerInsightsData && !Array.isArray(viewerInsightsData) && viewerInsightsData.sentimentBreakdown) ||
      viewerInsightsData?.tierRestriction
  )
  const contentGapsData = (analysis as any)?.contentGaps
  const hasContentGapsDataOrRestriction = Boolean(
    contentGapsData?.unansweredQuestions || contentGapsData?.tierRestriction
  )
  // SidePanel is controlled by `isOpen` prop from parent

  // ── Shared icon-button style ────────────────────────────────────────────────
  const iconBtn: React.CSSProperties = {
    width: "30px",
    height: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    border: `1px solid ${COLORS.ui.border}`,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background-color 0.15s",
    flexShrink: 0,
  }

  // ── Share helpers ───────────────────────────────────────────────────────────
  const verdictEmoji = (v?: string) => {
    switch ((v || "").toUpperCase()) {
      case "LEGIT":       return "✅"
      case "MISLEADING": return "⚠️"
      case "CLICKBAIT":  return "🚨"
      default:           return "🔍"
    }
  }

  const buildShareText = () => {
    const title   = analysis?.videoTitle || "this video"
    const verdict = analysis?.clickbaitVerdict?.verdict ||
                    (analysis?.summary as any)?.clickbaitVerdict?.label || "?"
    const score   = analysis?.trustScore?.score != null
      ? `${(analysis.trustScore.score as number).toFixed(1)}/10`
      : null
    const emoji   = verdictEmoji(verdict)

    // Build the shareable URL – prefer UUID share_code, fall back to snapshot_id (integer),
    // always use the web portal report link rather than the YouTube URL.
    const portalBase = (process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "https://app.commentverdict.com").replace(/\/+$/, "")
    const shareCode  = analysis?.snapshotShareCode
    const snapshotId = analysis?.snapshotId
    const reportId   = shareCode ?? (snapshotId != null ? String(snapshotId) : null)
    const reportUrl  = reportId ? `${portalBase}/report/${reportId}` : null
    const url        = reportUrl || analysis?.videoUrl || window.location.href

    const scorePart = score ? ` | Trust Score: ${score}` : ""
    const linkLabel = reportUrl ? "\nFull report ↗ " + reportUrl : ""
    return {
      text: `Just analyzed "${title}" using Comment Verdict 🔍\nVerdict: ${emoji} ${verdict}${scorePart}${linkLabel}\n#CommentVerdict`,
      url,
    }
  }

  const shareOnPlatform = (platform: "twitter" | "linkedin" | "reddit" | "copy") => {
    const { text, url } = buildShareText()
    const encoded = encodeURIComponent
    if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encoded(text)}&url=${encoded(url)}`, "_blank")
    } else if (platform === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded(url)}`, "_blank")
    } else if (platform === "reddit") {
      const title = analysis?.videoTitle || "Comment Verdict analysis"
      window.open(`https://reddit.com/submit?url=${encoded(url)}&title=${encoded(title)}`, "_blank")
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      })
    }
    if (platform !== "copy") setIsShareOpen(false)
  }

  const tabs = [
    { id: "summary" as TabId, label: "Summary", icon: "📊" },
    { id: "sentiment" as TabId, label: "Content Satisfaction", icon: "�" },
    { id: "insights" as TabId, label: "Viewer Insights", icon: "💬" },
    { id: "gaps" as TabId, label: "Content Gaps", icon: "🔍" },
    { id: "report" as TabId, label: "Report", icon: "📄" }
  ]

  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        [position]: 0,
        width: isCollapsed ? "60px" : "420px",
        height: "100vh",
        backgroundColor: "white",
        boxShadow: position === "right" ? "-4px 0 16px rgba(0,0,0,0.1)" : "4px 0 16px rgba(0,0,0,0.1)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: `2px solid ${COLORS.ui.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: COLORS.ui.surface
        }}>
        {!isCollapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={chrome.runtime.getURL("assets/blue.png")} alt="Comment Verdict" style={{ width: "24px", height: "24px" }} />
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "700",
                color: COLORS.ui.text.primary
              }}>
              Comment Verdict
            </h2>
          </div>
        )}

        {/* ── Header button row ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>

          {/* ── Group A: analysis actions (Share + Refresh) ── */}
          {!isCollapsed && analysis && (
            <>
              {/* Share button + dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  style={{
                    ...iconBtn,
                    backgroundColor: isShareOpen ? COLORS.neutral.light : "transparent",
                    border: `1px solid ${isShareOpen ? COLORS.neutral.primary : COLORS.ui.border}`,
                    color: isShareOpen ? COLORS.neutral.primary : "inherit",
                  }}
                  onMouseEnter={(e) => { if (!isShareOpen) e.currentTarget.style.backgroundColor = COLORS.ui.hover }}
                  onMouseLeave={(e) => { if (!isShareOpen) e.currentTarget.style.backgroundColor = "transparent" }}
                  onClick={() => setIsShareOpen(!isShareOpen)}
                  title="Share analysis">
                  <span style={{ fontSize: "15px" }}>📤</span>
                </button>

                {isShareOpen && (
                  <>
                    {/* Transparent backdrop – click anywhere outside to dismiss */}
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 10000 }}
                      onClick={() => setIsShareOpen(false)}
                    />
                    {/* Dropdown panel */}
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: dock === "right" ? 0 : undefined,
                      left:  dock === "left"  ? 0 : undefined,
                      zIndex: 10001,
                      backgroundColor: "white",
                      border: `1px solid ${COLORS.ui.border}`,
                      borderRadius: "10px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      minWidth: "176px",
                      overflow: "hidden",
                    }}>
                      {/* Dropdown header */}
                      <div style={{
                        padding: "10px 14px 8px",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: COLORS.ui.text.secondary,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${COLORS.ui.border}`,
                      }}>Share analysis</div>

                      {/* Share items */}
                      {([
                        { id: "twitter",  label: "Post on X",      icon: "𝕏" },
                        { id: "linkedin", label: "Share on LinkedIn", icon: "in" },
                        { id: "reddit",   label: "Post to Reddit",  icon: "r/" },
                      ] as const).map(({ id, label, icon }) => (
                        <button
                          key={id}
                          onClick={() => shareOnPlatform(id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            width: "100%",
                            padding: "9px 14px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "13px",
                            color: COLORS.ui.text.primary,
                            textAlign: "left",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.ui.surface }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none" }}>
                          <span style={{
                            width: "22px",
                            height: "22px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: "700",
                            background: COLORS.ui.surface,
                            borderRadius: "4px",
                            flexShrink: 0,
                          }}>{icon}</span>
                          {label}
                        </button>
                      ))}

                      {/* Copy link – with feedback */}
                      <div style={{ borderTop: `1px solid ${COLORS.ui.border}` }}>
                        <button
                          onClick={() => shareOnPlatform("copy")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            width: "100%",
                            padding: "9px 14px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "13px",
                            color: shareCopied ? COLORS.high.text : COLORS.ui.text.primary,
                            textAlign: "left",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.ui.surface }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none" }}>
                          <span style={{
                            width: "22px",
                            height: "22px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            background: shareCopied ? COLORS.high.light : COLORS.ui.surface,
                            borderRadius: "4px",
                            flexShrink: 0,
                            transition: "background 0.2s",
                          }}>{shareCopied ? "✓" : "🔗"}</span>
                          {shareCopied ? "Copied!" : "Copy link + summary"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Force Refresh */}
              {onForceRefresh && (
                <button
                  style={iconBtn}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.ui.hover }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
                  onClick={onForceRefresh}
                  title="Force refresh analysis">
                  <span style={{ fontSize: "15px" }}>🔄</span>
                </button>
              )}

              {/* Thin vertical divider between action group and panel controls */}
              <div style={{
                width: "1px",
                height: "20px",
                backgroundColor: COLORS.ui.border,
                margin: "0 2px",
                flexShrink: 0,
              }} />
            </>
          )}

          {/* ── Group B: panel controls (Collapse + Close) ── */}
          <button
            style={iconBtn}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.ui.hover }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand panel" : "Collapse panel"}>
            <span style={{ fontSize: "13px", fontWeight: "bold", lineHeight: 1 }}>
              {isCollapsed
                ? (position === "right" ? "«" : "»")
                : (position === "right" ? "»" : "«")}
            </span>
          </button>

          {!isCollapsed && (
            <button
              style={iconBtn}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.low.light }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
              onClick={onClose}
              title="Close panel">
              <span style={{ fontSize: "16px", lineHeight: 1 }}>✕</span>
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${COLORS.ui.border}`,
              backgroundColor: "white"
            }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  backgroundColor: activeTab === tab.id ? "white" : COLORS.ui.surface,
                  color:
                    activeTab === tab.id ? COLORS.neutral.primary : COLORS.ui.text.secondary,
                  border: "none",
                  borderBottom:
                    activeTab === tab.id ? `3px solid ${COLORS.neutral.primary}` : "3px solid transparent",
                  fontSize: "12px",
                  fontWeight: activeTab === tab.id ? "700" : "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.backgroundColor = COLORS.ui.surface
                    e.currentTarget.style.opacity = "0.8"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1"
                }}>
                <span style={{ fontSize: "16px" }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              backgroundColor: "white"
            }}>
            {isLoading ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center"
                }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    margin: "0 auto 16px",
                    border: `4px solid ${COLORS.ui.border}`,
                    borderTopColor: COLORS.neutral.primary,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}
                />
                <p
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "600",
                    color: COLORS.ui.text.primary
                  }}>
                  Analyzing Video...
                </p>
                {progressPercent !== null && progressPercent !== undefined ? (
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      fontSize: "18px",
                      fontWeight: "700",
                      color: COLORS.neutral.primary
                    }}>
                    {progressPercent}%
                  </p>
                ) : null}
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "14px",
                    color: COLORS.ui.text.secondary
                  }}>
                  {progressMessage || "This may take 10-20 seconds"}
                </p>
                <style>
                  {`
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  `}
                </style>
              </div>
            ) : !analysis ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center"
                }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "600",
                    color: COLORS.ui.text.secondary
                  }}>
                  No analysis data available
                </p>
              </div>
            ) : (
              <>
                {activeTab === "summary" && <SummaryTab analysis={analysis} panelDock={dock} />}
                {activeTab === "sentiment" && (
                  hasSentimentDataOrRestriction ? (
                    <CommentSentimentTab analysis={analysis} panelDock={dock} />
                  ) : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "48px 24px",
                      color: COLORS.ui.text.secondary
                    }}>
                      <div style={{
                        fontSize: "32px",
                        marginBottom: "16px",
                        animation: "spin 1s linear infinite"
                      }}>⏳</div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>Loading sentiment analysis...</p>
                      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                  )
                )}
                {activeTab === "insights" && (
                  hasViewerInsightsDataOrRestriction ? (
                    <KeyInsightsTab analysis={analysis} analysisState={isLoading ? 'analyzing' : 'complete'} analysisStatus={analysis?.summary} panelDock={dock} />
                  ) : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "48px 24px",
                      color: COLORS.ui.text.secondary
                    }}>
                      <div style={{
                        fontSize: "32px",
                        marginBottom: "16px",
                        animation: "spin 1s linear infinite"
                      }}>⏳</div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>Loading viewer insights...</p>
                    </div>
                  )
                )}
                {activeTab === "gaps" && (
                  hasContentGapsDataOrRestriction ? (
                    <ContentGapsTab
                      analysis={analysis}
                      onBotFilterChange={onBotFilterChange}
                      panelDock={dock}
                    />
                  ) : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "48px 24px",
                      color: COLORS.ui.text.secondary
                    }}>
                      <div style={{
                        fontSize: "32px",
                        marginBottom: "16px",
                        animation: "spin 1s linear infinite"
                      }}>⏳</div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>Loading content gaps...</p>
                    </div>
                  )
                )}
                {activeTab === "report" && (
                  <ReportTab
                    analysis={analysis}
                    history={history}
                    onDownloadReport={onDownloadReport}
                    onReAnalyze={onReAnalyze}
                    onDownloadHistoryReport={onDownloadHistoryReport}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Collapsed State - Vertical Tabs */}
      {isCollapsed && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "16px 8px"
          }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setIsCollapsed(false)
              }}
              style={{
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: activeTab === tab.id ? COLORS.neutral.light : "transparent",
                border: `2px solid ${activeTab === tab.id ? COLORS.neutral.primary : COLORS.ui.border}`,
                borderRadius: "8px",
                fontSize: "20px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              title={tab.label}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.ui.surface
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.backgroundColor = "transparent"
                }
              }}>
              {tab.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
