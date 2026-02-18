// FR-102 Tab 3: Content Gaps
// Gap Coverage Score + Unanswered Questions (FR-401 pattern) + Bot Detection Toggle

import { useState } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { COLORS } from "~lib/colors"
import { StatementBlock } from "~components/StatementBlock"
import { BlurredContent } from "~components/UpgradePrompt"

interface ContentGapsTabProps {
  analysis: VideoAnalysis
  onBotFilterChange?: (enabled: boolean) => void
  panelDock?: "left" | "right"
}

export const ContentGapsTab = ({ analysis, onBotFilterChange, panelDock = "right" }: ContentGapsTabProps) => {
  const contentGaps = analysis?.contentGaps
  
  if (!contentGaps) return null
  const [botFilterEnabled, setBotFilterEnabled] = useState(contentGaps.botDetectionEnabled)

  const handleBotFilterToggle = () => {
    const newValue = !botFilterEnabled
    setBotFilterEnabled(newValue)
    onBotFilterChange?.(newValue)
  }

  // Determine color based on gap coverage score
  const getCoverageColor = (score: number) => {
    if (score >= 80) return COLORS.high
    if (score >= 50) return COLORS.medium
    return COLORS.low
  }

  const coverageScore = contentGaps.gapCoverageScore ?? 0
  const coverageColor = getCoverageColor(coverageScore)
  
  // Icon for coverage score
  const getCoverageIcon = (score: number) => {
    if (score >= 80) return "✅"
    if (score >= 50) return "⚠️"
    return "❌"
  }

  const content = (
    <div>
      {/* Comment Analysis Info */}
      {(analysis.maxCommentsRequested != null || analysis.actualCommentsFetched != null) && (
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
      
      {/* Topic Gap Filtering Pipeline Visualization */}
      {contentGaps?.filteringMetadata && contentGaps.filteringMetadata.after_layer2 !== undefined && (
        <div style={{
          marginBottom: "16px",
          padding: "12px 16px",
          background: "linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)",
          border: "2px solid #FF9800",
          borderRadius: "12px",
          fontSize: "13px",
          fontWeight: "500",
          color: "#E65100",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "16px" }}>🔬</span>
          <span>
            Question Extraction: <strong>{contentGaps.filteringMetadata.after_layer2} relevant questions</strong> identified from filtered comments
          </span>
        </div>
      )}
      {/* Gap Coverage Score */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Viewer Needs Coverage
        </h3>

        <div
          style={{
            padding: "24px",
            background: `linear-gradient(135deg, ${coverageColor.light} 0%, ${coverageColor.light}ee 100%)`,
            border: `3px solid ${coverageColor.primary}`,
            borderRadius: "16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px"
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "28px" }}>{getCoverageIcon(coverageScore)}</span>
              <span style={{ fontSize: "15px", fontWeight: "600", color: coverageColor.dark }}>
                Coverage
              </span>
            </div>
            <span style={{ fontSize: "42px", fontWeight: "800", color: coverageColor.primary }}>
              {coverageScore}%
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: "100%",
              height: "12px",
              backgroundColor: "white",
              borderRadius: "6px",
              overflow: "hidden",
              border: `1px solid ${coverageColor.primary}`
            }}>
            <div
              style={{
                width: `${coverageScore}%`,
                height: "100%",
                backgroundColor: coverageColor.primary,
                transition: "width 1s ease-out"
              }}
            />
          </div>

          <p
            style={{
              margin: "12px 0 0 0",
              fontSize: "13px",
              color: coverageColor.dark
            }}>
            {coverageScore >= 80
              ? "Great! Most viewer requests and curiosities are covered."
              : coverageScore >= 50
              ? "Good coverage, but some viewer requests are still missing."
              : "Many viewer requests are not covered in the video."}
          </p>
        </div>
      </div>

      {/* Bot Detection Filter Toggle */}
      {/* <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          backgroundColor: COLORS.ui.surface,
          border: `1px solid ${COLORS.ui.border}`,
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
        <div>
          <p
            style={{
              margin: "0 0 4px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: COLORS.ui.text.primary
            }}>
            Hide Bot/Spam Questions
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: COLORS.ui.text.secondary
            }}>
            Filter out questions with Human-Likeness Score {"<"} 5.0
          </p>
        </div>

        <button
          onClick={handleBotFilterToggle}
          style={{
            position: "relative",
            width: "48px",
            height: "28px",
            backgroundColor: botFilterEnabled ? COLORS.neutral.primary : COLORS.ui.border,
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
            transition: "background-color 0.2s",
            flexShrink: 0
          }}>
          <div
            style={{
              position: "absolute",
              top: "4px",
              left: botFilterEnabled ? "24px" : "4px",
              width: "20px",
              height: "20px",
              backgroundColor: "white",
              borderRadius: "50%",
              transition: "left 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}
          />
        </button>
      </div> */}

        {/* Unaddressed Viewer Requests */}
      <div>
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
          <span style={{ fontSize: "24px" }}>⚠️</span>
          <span>Unaddressed Viewer Requests</span>
        </h3>
        {(contentGaps.unansweredQuestions || []).length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              backgroundColor: COLORS.high.light,
              border: `1px solid ${COLORS.high.primary}`,
              borderRadius: "8px"
            }}>
            <p
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "600",
                color: COLORS.high.dark
              }}>
              🎉 Looks like the video covered most requests!
            </p>
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: "14px",
                color: COLORS.high.text
              }}>
              The video appears to cover most common viewer requests.
            </p>
          </div>
        ) : (
          <>
                <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "13px",
                    color: COLORS.ui.textSecondary
              }}>
              These viewer requests weren't clearly covered in the video:
            </p>
            {(contentGaps.unansweredQuestions || []).map((gap: any) => (
              <StatementBlock
                key={`${gap.id}-${gap.commentCount}`}
                insight={gap}
                showBotScores={botFilterEnabled}
                videoId={analysis.videoId}
                panelDock={panelDock}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )

  // Check for tier restriction and wrap with blur overlay
  if (contentGaps?.tierRestriction) {
    return (
      <BlurredContent restriction={contentGaps.tierRestriction}>
        {content}
      </BlurredContent>
    )
  }

  return <div style={{ padding: "24px" }}>{content}</div>
}
