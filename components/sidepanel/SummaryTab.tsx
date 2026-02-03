// FR-102 Tab 1: Summary & Score
// Executive Summary, Trust Score, Channel Credibility Gauge, Bot Detection

import { useState } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor } from "~lib/colors"
import { OverviewSubTab } from "./OverviewSubTab"
import { VideoCredibilitySubTab } from "./VideoCredibilitySubTab"
import { ChannelCredibilitySubTab } from "./ChannelCredibilitySubTab"

interface SummaryTabProps {
  analysis?: VideoAnalysis | null
}

export const SummaryTab = ({ analysis }: SummaryTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "video" | "channel">("video")
  const [isExecutiveSummaryExpanded, setIsExecutiveSummaryExpanded] = useState(false)
  
  if (!analysis) return null
  
  // Support both legacy and new data shapes
  const summary = (analysis.summary || {}) as any
  
  // Extract executive summary from analysis
  const executiveSummary = analysis.executiveSummary || "This video has been analyzed by Focus Guard AI to assess its relevancy, credibility, and viewer insights based on comments, transcript, and metadata."
  
  // Extract key takeaways from summary (from summary/v2 response)
  const keyTakeaways = summary.key_takeaways || summary.keyTakeaways || []
  
  // Channel trust data - support both old and new formats
  // Priority: channelTrust (new) > channelCredibility (old)
  const channelTrust = summary.channelTrust || analysis.channelTrust
  const channelCredibility = summary.channelCredibility || analysis.channelCredibility || {}
  
  // Use new format if available, otherwise fall back to old format
  const hasNewFormat = channelTrust && channelTrust.metrics
  const displayData = hasNewFormat ? channelTrust : channelCredibility
  const trustScore = hasNewFormat ? channelTrust.trust_score : (summary.trustScore ?? analysis.trustScore?.score ?? channelCredibility.score ?? 0)
  const trustColor = getTrustScoreColor(trustScore)
  const verdictColor = getClickbaitVerdictColor(summary.clickbaitVerdict?.label ?? "unknown")
  const trustFactors = hasNewFormat ? [] : (channelCredibility.factors || [])

  // Claims list (normalize type for TS inference)
  const claimsList = (summary.clickbaitVerdict?.claims || []) as any[]

  // Sub-tab navigation
  const subTabs = [
    { id: "overview" as const, label: "Summary" },
    { id: "video" as const, label: "Video Trust" },
    { id: "channel" as const, label: "Channel Trust" }
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: "calc(100vh - 120px)" }}>
      {/* Sub-tab Navigation */}
      <div style={{
        display: "flex",
        gap: "4px",
        padding: "8px 12px 0 12px",
        borderBottom: `2px solid ${COLORS.ui.border}`,
        backgroundColor: COLORS.ui.background
      }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "12px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: activeSubTab === tab.id ? COLORS.neutral.primary : COLORS.ui.textSecondary,
              backgroundColor: activeSubTab === tab.id ? COLORS.ui.surface : "transparent",
              border: "none",
              borderBottom: activeSubTab === tab.id ? `3px solid ${COLORS.neutral.primary}` : "3px solid transparent",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "center"
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {activeSubTab === "overview" && (
          <OverviewSubTab
            executiveSummary={executiveSummary}
            isExecutiveSummaryExpanded={isExecutiveSummaryExpanded}
            setIsExecutiveSummaryExpanded={setIsExecutiveSummaryExpanded}
            verdictColor={verdictColor}
            verdictLabel={summary.clickbaitVerdict?.label}
            keyTakeaways={keyTakeaways}
            maxCommentsRequested={analysis.maxCommentsRequested}
            actualCommentsFetched={analysis.actualCommentsFetched}
          />
        )}

        {activeSubTab === "video" && (
          <VideoCredibilitySubTab
            summary={summary}
            trustScore={trustScore}
            verdictColor={verdictColor}
            claimsList={claimsList}
          />
        )}

        {activeSubTab === "channel" && (
          <ChannelCredibilitySubTab
            channelCredibility={displayData}
            credibilityScore={trustScore}
            credibilityFactors={trustFactors}
          />
        )}
      </div>
    </div>
  )
}

