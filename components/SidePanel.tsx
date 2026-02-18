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
  // SidePanel is controlled by `isOpen` prop from parent

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

        <div style={{ display: "flex", gap: "8px" }}>
          {/* Force Refresh Button - only show when not collapsed */}
          {!isCollapsed && onForceRefresh && analysis && (
            <button
              onClick={onForceRefresh}
              style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                border: `1px solid ${COLORS.ui.border}`,
                borderRadius: "6px",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.ui.surface
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
              title="Force refresh analysis">
              <span style={{ fontSize: "16px" }}>🔄</span>
            </button>
          )}
          
          {/* Collapse/Expand Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
              border: `1px solid ${COLORS.ui.border}`,
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.ui.surface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
            }}
            title={isCollapsed ? "Expand" : "Collapse"}>
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
              {isCollapsed ? (position === "right" ? "«" : "»") : position === "right" ? "»" : "«"}
            </span>
          </button>

          {/* Close Button */}
          {!isCollapsed && (
            <button
              onClick={() => {
                onClose()
              }}
              style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                border: `1px solid ${COLORS.ui.border}`,
                borderRadius: "6px",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.low.light
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
              title="Close">
              <span style={{ fontSize: "18px" }}>✕</span>
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
                  analysis.sentiment?.distribution ? (
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
                  analysis.viewerInsights && !Array.isArray(analysis.viewerInsights) && analysis.viewerInsights.sentimentBreakdown ? (
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
                  analysis.contentGaps?.unansweredQuestions ? (
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
