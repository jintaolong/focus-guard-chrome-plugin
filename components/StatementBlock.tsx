// FR-401: Statement and Supporting Comments Pattern
// Reusable component for Tabs 2 and 3

import { useState } from "react"
import type { InsightWithComments } from "~types/analysis"
import { COLORS, getInsightTypeColor, getColorSet } from "~lib/colors"
import { CommentDisplay } from "~components/CommentDisplay"

interface StatementBlockProps {
  insight: InsightWithComments
  showBotScores?: boolean
  videoId?: string // Required for YouTube anchor links
}

export const StatementBlock = ({ insight, showBotScores = false, videoId = "" }: StatementBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(insight.isExpanded || false)
  
  const comments = Array.isArray(insight.supportingComments) ? insight.supportingComments : []
  const commentCount = insight.commentCount || comments.length || 0
  
  // For viewer insights (benefit), use neutral color with intensity based on comment count
  // For gaps, use the existing color system
  const color = insight.type === "benefit" ? "neutral" : getInsightTypeColor(insight.type as any)
  const colorSet = getColorSet(color)
  
  // Calculate color intensity based on comment count (for viewer insights)
  // More comments = darker/more intense color
  const getIntensityStyle = (count: number) => {
    if (insight.type !== "benefit") return {}
    
    // Normalize count to opacity range 0.3-1.0
    const maxCount = 50 // Assume 50+ comments is "high"
    const normalizedCount = Math.min(count / maxCount, 1)
    const opacity = 0.3 + (normalizedCount * 0.7)
    
    return {
      backgroundColor: `rgba(59, 130, 246, ${opacity * 0.15})`, // blue with varying opacity
      borderColor: `rgba(59, 130, 246, ${opacity})`
    }
  }
  
  const intensityStyle = getIntensityStyle(commentCount)

  // Icon for different types (no icon for benefit/viewer insights)
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "benefit": return null // No icon for viewer insights
      case "issue": return "⚠️"
      case "gap": return "❓"
      default: return "💬"
    }
  }
  
  const typeIcon = getTypeIcon(insight.type)

  return (
    <div
      style={{
        marginBottom: "12px",
        border: `2px solid ${intensityStyle.borderColor || colorSet.primary}`,
        borderRadius: "10px",
        overflow: "hidden",
        backgroundColor: "white",
        boxShadow: isExpanded ? "0 4px 12px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)",
        transition: "all 0.3s ease"
      }}>
      {/* Statement Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: "14px 16px",
          backgroundColor: intensityStyle.backgroundColor || colorSet.light,
          borderBottom: isExpanded ? `2px solid ${intensityStyle.borderColor || colorSet.primary}` : "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          const bgColor = intensityStyle.backgroundColor || colorSet.light
          e.currentTarget.style.backgroundColor = bgColor
          e.currentTarget.style.filter = "brightness(0.95)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "brightness(1)"
        }}>
        {/* Type Icon (only for gaps/issues, not for viewer insights) */}
        {typeIcon && (
          <div
            style={{
              flexShrink: 0,
              fontSize: "20px",
              lineHeight: "1"
            }}>
            {typeIcon}
          </div>
        )}

        {/* Expand/Collapse Icon */}
        <div
          style={{
            flexShrink: 0,
            width: "18px",
            height: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)"
          }}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            style={{ color: colorSet.text }}>
            <path
              d="M4 2L8 6L4 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Statement Text */}
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: "600",
              color: colorSet.dark,
              lineHeight: "1.5"
            }}>
            {insight.statement}
          </p>
        </div>

        {/* Comment Count Badge */}
        <div
          style={{
            flexShrink: 0,
            padding: "6px 12px",
            backgroundColor: intensityStyle.borderColor || colorSet.primary,
            color: "white",
            borderRadius: "16px",
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
          }}>
          {commentCount}
        </div>
      </div>

      {/* Supporting Comments (Collapsible) */}
      {isExpanded && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "white",
            maxHeight: "400px",
            overflowY: "auto"
          }}>
            {comments.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "12px",
                fontSize: "14px",
                color: COLORS.ui.text.secondary,
                textAlign: "center",
                fontStyle: "italic"
              }}>
              No supporting comments available
            </p>
          ) : (
            comments.map((comment: any, index: number) => {
              const commentKey = comment.id ?? `comment-${index}`
              
              return (
                <div key={commentKey} style={{ marginBottom: index < comments.length - 1 ? "8px" : 0 }}>
                  <CommentDisplay
                    comment={comment}
                    videoId={videoId}
                    showLikes={true}
                    showAuthor={true}
                    borderColor={colorSet.primary}
                  />
                  
                  {/* Bot Score Tag (Optional) - shown below comment if available */}
                  {showBotScores && comment.humanLikenessScore != null && (
                    <div
                      style={{
                        marginTop: "4px",
                        marginLeft: "12px",
                        display: "inline-block",
                        padding: "2px 8px",
                        backgroundColor:
                          comment.humanLikenessScore >= 7
                            ? COLORS.high.light
                            : comment.humanLikenessScore >= 4
                            ? COLORS.medium.light
                            : COLORS.low.light,
                        border: `1px solid ${
                          comment.humanLikenessScore >= 7
                            ? COLORS.high.primary
                            : comment.humanLikenessScore >= 4
                            ? COLORS.medium.primary
                            : COLORS.low.primary
                        }`,
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "600",
                        color:
                          comment.humanLikenessScore >= 7
                            ? COLORS.high.text
                            : comment.humanLikenessScore >= 4
                            ? COLORS.medium.text
                            : COLORS.low.text
                      }}>
                      Human: {comment.humanLikenessScore.toFixed(1)}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
