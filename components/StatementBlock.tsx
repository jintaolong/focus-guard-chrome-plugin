// FR-401: Statement and Supporting Comments Pattern
// Reusable component for Tabs 2 and 3

import { useState } from "react"
import type { InsightWithComments } from "~types/analysis"
import { COLORS, getInsightTypeColor, getColorSet } from "~lib/colors"

interface StatementBlockProps {
  insight: InsightWithComments
  showBotScores?: boolean
}

export const StatementBlock = ({ insight, showBotScores = false }: StatementBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(insight.isExpanded || false)
  
  const color = getInsightTypeColor(insight.type as any)
  const colorSet = getColorSet(color)
  const comments = Array.isArray(insight.supportingComments) ? insight.supportingComments : []
  const commentCount = insight.commentCount || comments.length || 0

  return (
    <div
      style={{
        marginBottom: "16px",
        border: `1px solid ${colorSet.light}`,
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "white"
      }}>
      {/* Statement Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: "16px",
          backgroundColor: colorSet.light,
          borderLeft: `4px solid ${colorSet.primary}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          transition: "background-color 0.2s"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colorSet.light
          e.currentTarget.style.opacity = "0.9"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1"
        }}>
        {/* Expand/Collapse Icon */}
        <div
          style={{
            flexShrink: 0,
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)"
          }}>
          <svg
            width="12"
            height="12"
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
            padding: "4px 10px",
            backgroundColor: colorSet.primary,
            color: "white",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "700"
          }}>
          {commentCount} Comment{commentCount !== 1 ? "s" : ""}
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
            comments.map((comment: any, index: number) => (
              <div
                key={comment.id ?? `comment-${index}`}
                style={{
                  padding: "12px",
                  marginBottom: index < comments.length - 1 ? "8px" : 0,
                  backgroundColor: COLORS.ui.surface,
                  borderRadius: "6px",
                  border: `1px solid ${COLORS.ui.border}`
                }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "8px"
                  }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: COLORS.ui.text.primary,
                      lineHeight: "1.6",
                      flex: 1
                    }}>
                    "{comment.text}"
                  </p>

                  {/* Bot Score Tag (Optional) */}
                  {showBotScores && comment.humanLikenessScore != null && (
                    <div
                      style={{
                        flexShrink: 0,
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

                {/* Optional timestamp */}
                {comment.timestamp && (
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      fontSize: "12px",
                      color: COLORS.ui.text.secondary
                    }}>
                    {comment.timestamp}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
