// FR-102 Tab: Content Satisfaction Analysis
// Sentiment Overview (Donut Chart) + Example Comments by Sentiment

import { useState, useRef, useEffect } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { COLORS, getSentimentColor } from "~lib/colors"
import { BlurredContent } from "~components/UpgradePrompt"

interface CommentSentimentTabProps {
  analysis: VideoAnalysis
}

export const CommentSentimentTab = ({ analysis }: CommentSentimentTabProps) => {
  const sentiment = (analysis as any)?.sentiment
  const viewerInsights = (analysis as any)?.viewerInsights
  const [isDonutCollapsed, setIsDonutCollapsed] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Auto-collapse donut chart when scrolling down
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      if (target && target.scrollTop > 100) {
        setIsDonutCollapsed(true)
      } else if (target && target.scrollTop < 50) {
        setIsDonutCollapsed(false)
      }
    }
    
    const scrollContainer = contentRef.current?.closest('[style*="overflow"]') as HTMLElement
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)
      return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Normalize shapes: provide defaults when fields are missing
  const sentimentBreakdown = viewerInsights?.sentimentBreakdown ?? {
    positive: 0,
    negative: 0,
    neutral: 0,
    totalCommentsAnalyzed: Array.isArray(viewerInsights) ? viewerInsights.length : 0
  }

  // Calculate percentages for donut chart (without mixed)
  const total =
    (sentimentBreakdown.positive || 0) +
    (sentimentBreakdown.negative || 0) +
    (sentimentBreakdown.neutral || 0) || 1

  const percentages = {
    positive: ((sentimentBreakdown.positive || 0) / total) * 100,
    negative: ((sentimentBreakdown.negative || 0) / total) * 100,
    neutral: ((sentimentBreakdown.neutral || 0) / total) * 100
  }

  // Create donut chart segments
  let currentAngle = -90 // Start at top
  const segments = [
    { type: "positive" as const, value: percentages.positive, count: sentimentBreakdown.positive || 0 },
    { type: "negative" as const, value: percentages.negative, count: sentimentBreakdown.negative || 0 },
    { type: "neutral" as const, value: percentages.neutral, count: sentimentBreakdown.neutral || 0 }
  ]

  const sentimentLabels: Record<string, string> = {
    positive: "Liked",
    neutral: "Mixed",
    negative: "Disliked"
  }

  const content = (
    <div ref={contentRef}>
      {/* Sentiment Overview */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          onClick={() => setIsDonutCollapsed(!isDonutCollapsed)}
          style={{
            margin: "0 0 24px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
          <span style={{
            transition: "transform 0.2s",
            transform: isDonutCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
            display: "inline-block"
          }}>▼</span>
          <span>Comment Mood</span>
        </h3>
        <p style={{ 
          fontSize: "13px", 
          color: COLORS.ui.textSecondary, 
          margin: "0 0 16px 0",
          fontStyle: "italic"
        }}>
          Overall vibe based on comment tone.
        </p>

        {!isDonutCollapsed && (
          <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
          {/* Donut Chart */}
          <div style={{ position: "relative", width: "160px", height: "160px", flexShrink: 0 }}>
            <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              {segments.map((segment, index) => {
                if (segment.value === 0) return null
                
                const angle = (segment.value / 100) * 360
                const color = COLORS[getSentimentColor(segment.type)].primary
                
                // Create arc path
                const radius = 85
                const innerRadius = 60
                const startAngle = currentAngle
                const endAngle = currentAngle + angle
                
                const start = polarToCartesian(100, 100, radius, startAngle)
                const end = polarToCartesian(100, 100, radius, endAngle)
                const innerStart = polarToCartesian(100, 100, innerRadius, endAngle)
                const innerEnd = polarToCartesian(100, 100, innerRadius, startAngle)
                
                const largeArcFlag = angle > 180 ? 1 : 0
                
                const pathData = [
                  `M ${start.x} ${start.y}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
                  `L ${innerStart.x} ${innerStart.y}`,
                  `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}`,
                  'Z'
                ].join(' ')
                
                currentAngle += angle
                
                return (
                  <path
                    key={segment.type}
                    d={pathData}
                    fill={color}
                    style={{ transition: "all 0.5s ease-out" }}
                  />
                )
              })}
            </svg>

            {/* Center text */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center"
              }}>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  color: COLORS.ui.textPrimary
                }}>
                {sentimentBreakdown.totalCommentsAnalyzed}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: COLORS.ui.textSecondary
                }}>
                Comments
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
            {segments.map((segment) => (
              <div
                key={segment.type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "4px",
                    backgroundColor: COLORS[getSentimentColor(segment.type)].primary,
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: COLORS.ui.textPrimary,
                        textTransform: "capitalize"
                      }}>
                      {sentimentLabels[segment.type] ?? segment.type}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: COLORS.ui.textSecondary
                      }}>
                      {segment.value.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: COLORS.ui.text.secondary }}>
                    {segment.count} comment{segment.count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Example Comments by Sentiment */}
      <div>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Example Comments
        </h3>
        {renderExampleComments(analysis)}
      </div>
    </div>
  )

  // Check for tier restriction and wrap with blur overlay
  if (sentiment?.tierRestriction) {
    return (
      <BlurredContent restriction={sentiment.tierRestriction}>
        {content}
      </BlurredContent>
    )
  }

  return <div style={{ padding: "24px" }}>{content}</div>
}

// Helper to render example comments for each sentiment type
function renderExampleComments(analysis: VideoAnalysis) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  
  const sentiment = (analysis as any)?.sentiment
  const exampleComments = sentiment?.distribution?.exampleComments
  
  if (!exampleComments) {
    return (
      <p style={{ fontSize: "14px", color: COLORS.ui.textSecondary, fontStyle: "italic" }}>
        No example comments available
      </p>
    )
  }

  const sentimentTypes = [
    { type: "positive", label: "Liked", comments: exampleComments.positive || [] },
    { type: "neutral", label: "Mixed", comments: exampleComments.neutral || [] },
    { type: "negative", label: "Disliked", comments: exampleComments.negative || [] }
  ]

  const toggleSection = (type: string) => {
    setExpandedSections(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const toggleComment = (commentId: string) => {
    setExpandedComments(prev => ({ ...prev, [commentId]: !prev[commentId] }))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {sentimentTypes.map(({ type, label, comments }) => {
        const topComments = comments.slice(0, 7)
        if (topComments.length === 0) return null
        const isExpanded = expandedSections[type]

        return (
          <div key={type}>
            <button
              onClick={() => toggleSection(type)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                backgroundColor: COLORS.ui.surface,
                border: `1px solid ${COLORS.ui.border}`,
                borderRadius: "6px",
                cursor: "pointer",
                marginBottom: isExpanded ? "8px" : "0"
              }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: COLORS.ui.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                {label} ({topComments.length})
              </h4>
              <span style={{ fontSize: "14px", color: COLORS.ui.textSecondary }}>
                {isExpanded ? "−" : "+"}
              </span>
            </button>
            {isExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {topComments.map((comment: any, idx: number) => {
                  const commentId = `${type}-${idx}`
                  const commentText = comment.text || comment
                  const isLong = commentText.length > 150
                  const isCommentExpanded = expandedComments[commentId]
                  const displayText = isLong && !isCommentExpanded 
                    ? commentText.substring(0, 150) + "..." 
                    : commentText

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: COLORS.ui.background,
                        borderLeft: `3px solid ${COLORS[getSentimentColor(type as any)].primary}`,
                        borderRadius: "4px",
                        fontSize: "13px",
                        lineHeight: "1.5",
                        color: COLORS.ui.textPrimary
                      }}>
                      {displayText}
                      {isLong && (
                        <button
                          onClick={() => toggleComment(commentId)}
                          style={{
                            marginLeft: "8px",
                            padding: "2px 6px",
                            fontSize: "11px",
                            color: COLORS.neutral.primary,
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            textDecoration: "underline"
                          }}>
                          {isCommentExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Helper function to convert polar coordinates to cartesian
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  }
}
