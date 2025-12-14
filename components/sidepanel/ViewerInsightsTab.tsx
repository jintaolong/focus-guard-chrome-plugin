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
      {/* Actionable Insights - High Value */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: getColorSet("high").text
          }}>
          🌟 High-Value Insights
        </h3>
        {((actionableInsights.highValue || []) as any[]).length === 0 ? (
          <p style={{ fontSize: "14px", color: COLORS.ui.textSecondary, fontStyle: "italic" }}>
            No high-value insights identified
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
