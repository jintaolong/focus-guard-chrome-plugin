// FR-102 Tab 2: Viewer Insights
// Actionable Insights (FR-401 pattern)

import type { VideoAnalysis } from "~types/analysis"
import { COLORS, getColorSet } from "~lib/colors"
import { StatementBlock } from "~components/StatementBlock"
import { BlurredContent } from "~components/UpgradePrompt"

interface ViewerInsightsTabProps {
  analysis: VideoAnalysis
}

export const ViewerInsightsTab = ({ analysis }: ViewerInsightsTabProps) => {
  const viewerInsights = (analysis as any)?.viewerInsights

  const actionableInsights = viewerInsights?.actionableInsights ?? {
    highValue: Array.isArray(viewerInsights) ? viewerInsights : [],
    improvements: []
  }

  const content = (
    <div>
      {/* Comment Analysis Info */}
      {(analysis.maxCommentsRequested || analysis.actualCommentsFetched) && (
        <div style={{
          marginBottom: "16px",
          padding: "12px 16px",
          background: "linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)",
          border: "2px solid #2196F3",
          borderRadius: "12px",
          fontSize: "13px",
          fontWeight: "500",
          color: "#0D47A1",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "16px" }}>📊</span>
          <span>
            Comment Analysis: <strong>Requested: {analysis.maxCommentsRequested ?? 'N/A'}</strong> • 
            <strong>Analyzed: {analysis.actualCommentsFetched ?? 'N/A'}</strong>
          </span>
        </div>
      )}
      {/* Actionable Insights */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
          <span style={{ fontSize: "24px" }}>💬</span>
          <span>What Viewers Noticed</span>
        </h3>
        {((actionableInsights.highValue || []) as any[]).length === 0 ? (
          <p style={{ fontSize: "14px", color: COLORS.ui.textSecondary, fontStyle: "italic" }}>
            No common patterns found yet
          </p>
        ) : (
          (actionableInsights.highValue || []).map((insight: any, idx: number) => (
            <StatementBlock key={insight.id ?? `high-${idx}`} insight={insight} />
          ))
        )}
      </div>
    </div>
  )
  // Check for tier restriction and wrap with blur overlay
  if (viewerInsights && typeof viewerInsights === 'object' && 'tierRestriction' in viewerInsights && viewerInsights.tierRestriction) {
    return (
      <BlurredContent restriction={viewerInsights.tierRestriction}>
        {content}
      </BlurredContent>
    )
  }

  return <div style={{ padding: "24px" }}>{content}</div>
}
