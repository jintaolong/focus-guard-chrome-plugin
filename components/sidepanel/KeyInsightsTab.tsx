// Enhanced Key Insights Tab with Topic Clustering
// Features: category filters, insight score sorting/filtering, parent theme grouping

import { useState, useMemo } from "react"
import type { VideoAnalysis } from "~types/analysis"
import { COLORS } from "~lib/colors"
import { BlurredContent } from "~components/UpgradePrompt"

interface SegmentHighlight {
  parent_comment_text: string
  highlighted_segment: string
  char_range: [number, number]
  is_full_comment: boolean
  user: string
  likes: number
}

interface TopicCluster {
  cluster_id: number
  statement: string
  count: number
  supporting_quotes: string[]
  insight_score: number
  category: string
  reasoning: string
  segment_highlights: SegmentHighlight[]
}

interface ParentTheme {
  parent_id: number
  child_clusters: TopicCluster[]
  child_count: number
  total_comment_count: number
  avg_insight_score: number
  categories: string[]
  rationale: string
  parent_statement: string
  description: string
}

interface TopicClustersData {
  clusters: TopicCluster[]
  parent_themes: ParentTheme[]
  hierarchy_map: Record<string, number>
  total_parent_themes: number
  method: string
  processing_time?: number
}

interface KeyInsightsTabProps {
  analysis: VideoAnalysis
  analysisState?: string
  analysisStatus?: any
}

// Helper function to render segment highlights - simplified with quotes
const renderSegmentHighlight = (highlight: SegmentHighlight) => {
  const { highlighted_segment } = highlight
  
  // Simple rendering with quotes and subtle underline
  return (
    <span style={{ 
      color: COLORS.ui.text.primary,
      borderBottom: `1px solid ${COLORS.ui.border}`,
      fontStyle: 'italic'
    }}>
      "{highlighted_segment}"
    </span>
  )
}

export const KeyInsightsTab = ({ analysis, analysisState, analysisStatus }: KeyInsightsTabProps) => {
  const topicClustersData = (analysis as any)?.topicClustersData as TopicClustersData | null
  const isRefreshing = analysisState === 'analyzing' || analysisState === 'polling'
  
  // Filter and sorting states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'insight_score' | 'count'>('insight_score')
  const [minInsightScore, setMinInsightScore] = useState(7.0)
  const [expandedThemes, setExpandedThemes] = useState<Set<number>>(new Set())
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set())
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [expandedReasonings, setExpandedReasonings] = useState<Set<number>>(new Set())
  
  // Get all unique categories
  const allCategories = useMemo(() => {
    if (!topicClustersData?.clusters) return []
    const categories = new Set<string>()
    topicClustersData.clusters.forEach(cluster => {
      if (cluster.category) categories.add(cluster.category)
    })
    return Array.from(categories).sort()
  }, [topicClustersData])
  
  // Get min/max comment counts from clusters
  const commentCountRange = useMemo(() => {
    if (!topicClustersData?.clusters || topicClustersData.clusters.length === 0) {
      return { min: 1, max: 50 }
    }
    const counts = topicClustersData.clusters.map(c => c.count)
    return {
      min: Math.min(...counts),
      max: Math.max(...counts)
    }
  }, [topicClustersData])
  
  // Initialize minCommentCount to the actual minimum from data
  const [minCommentCount, setMinCommentCount] = useState(commentCountRange.min)
  
  // Filter and sort clusters
  const filteredClusters = useMemo(() => {
    if (!topicClustersData?.clusters) return []
    
    return topicClustersData.clusters.filter(cluster => {
      // Filter by insight score
      if (cluster.insight_score < minInsightScore) return false
      
      // Filter by comment count
      if (cluster.count < minCommentCount) return false
      
      // Filter by category if any selected
      if (selectedCategories.length > 0 && !selectedCategories.includes(cluster.category)) {
        return false
      }
      
      return true
    })
  }, [topicClustersData, minInsightScore, minCommentCount, selectedCategories])
  
  // Group clusters by parent themes
  const groupedClusters = useMemo(() => {
    if (!topicClustersData?.parent_themes || topicClustersData.parent_themes.length === 0) {
      // No parent themes, return all filtered clusters ungrouped
      return [{
        parent: null,
        clusters: filteredClusters.sort((a, b) => {
          if (sortBy === 'insight_score') {
            return b.insight_score - a.insight_score
          }
          return b.count - a.count
        })
      }]
    }
    
    // Group by parent themes
    const groups: { parent: ParentTheme | null, clusters: TopicCluster[] }[] = []
    
    topicClustersData.parent_themes.forEach(parent => {
      const parentClusters = parent.child_clusters.filter(cluster => 
        filteredClusters.some(fc => fc.cluster_id === cluster.cluster_id)
      )
      
      if (parentClusters.length > 0) {
        // Sort clusters within parent
        parentClusters.sort((a, b) => {
          if (sortBy === 'insight_score') {
            return b.insight_score - a.insight_score
          }
          return b.count - a.count
        })
        
        groups.push({ parent, clusters: parentClusters })
      }
    })
    
    // Sort parent groups by their average insight score
    groups.sort((a, b) => {
      if (!a.parent || !b.parent) return 0
      return b.parent.avg_insight_score - a.parent.avg_insight_score
    })
    
    return groups
  }, [filteredClusters, topicClustersData, sortBy])
  
  const toggleTheme = (parentId: number) => {
    const newExpanded = new Set(expandedThemes)
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId)
    } else {
      newExpanded.add(parentId)
    }
    setExpandedThemes(newExpanded)
  }
  
  const toggleCluster = (clusterId: number) => {
    const newExpanded = new Set(expandedClusters)
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId)
    } else {
      newExpanded.add(clusterId)
    }
    setExpandedClusters(newExpanded)
  }
  
  const toggleComment = (commentKey: string) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(commentKey)) {
      newExpanded.delete(commentKey)
    } else {
      newExpanded.add(commentKey)
    }
    setExpandedComments(newExpanded)
  }
  
  const toggleReasoning = (clusterId: number) => {
    const newExpanded = new Set(expandedReasonings)
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId)
    } else {
      newExpanded.add(clusterId)
    }
    setExpandedReasonings(newExpanded)
  }
  
  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category))
    } else {
      setSelectedCategories([...selectedCategories, category])
    }
  }
  
  const getInsightScoreColor = (score: number) => {
    if (score >= 8) return COLORS.high.primary
    if (score >= 6) return COLORS.medium.primary
    return COLORS.low.primary
  }
  
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      narrative: '#8B5CF6',
      question: '#F59E0B',
      sentiment: '#10B981',
      issue: '#EF4444',
      observation: '#3B82F6'
    }
    return colors[category] || '#6B7280'
  }
  
  const content = (
    <div>
      {/* Refresh Progress Indicator */}
      {isRefreshing && (
        <div style={{
          marginBottom: "16px",
          padding: "16px",
          background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
          border: "2px solid #F59E0B",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <div style={{
            width: "20px",
            height: "20px",
            border: `3px solid ${COLORS.medium.light}`,
            borderTopColor: COLORS.medium.primary,
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: "14px",
              fontWeight: "600",
              color: COLORS.medium.dark,
              marginBottom: "4px"
            }}>
              Refreshing Analysis...
            </div>
            <div style={{
              fontSize: "12px",
              color: COLORS.medium.text
            }}>
              {analysisStatus?.isAnalyzing ? 'Processing video data...' : 'Fetching latest insights...'}
            </div>
          </div>
        </div>
      )}
      
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
      
      {/* Filters Section */}
      <div style={{
        marginBottom: "24px",
        padding: "16px",
        backgroundColor: COLORS.ui.surface,
        borderRadius: "12px",
        border: `1px solid ${COLORS.ui.border}`
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px"
        }}>
          <h3 style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.text.primary
          }}>
            Filters
          </h3>
          
          {/* Sort Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "12px",
              color: COLORS.ui.text.secondary,
              fontWeight: "500"
            }}>
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'insight_score' | 'count')}
              style={{
                padding: "6px 10px",
                fontSize: "13px",
                fontWeight: "500",
                borderRadius: "6px",
                border: `1px solid ${COLORS.ui.border}`,
                backgroundColor: "white",
                color: COLORS.ui.text.primary,
                cursor: "pointer",
                outline: "none"
              }}>
              <option value="insight_score">↓ Insight Score</option>
              <option value="count">↓ Comment Count</option>
            </select>
          </div>
        </div>
        
        {/* Category Filter */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            fontWeight: "500",
            color: COLORS.ui.text.secondary
          }}>
            Categories
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {allCategories.map(category => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: "500",
                  borderRadius: "16px",
                  border: selectedCategories.includes(category) 
                    ? `2px solid ${getCategoryColor(category)}`
                    : `1px solid ${COLORS.ui.border}`,
                  backgroundColor: selectedCategories.includes(category)
                    ? `${getCategoryColor(category)}20`
                    : "white",
                  color: selectedCategories.includes(category)
                    ? getCategoryColor(category)
                    : COLORS.ui.text.secondary,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                {category}
              </button>
            ))}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: "500",
                  borderRadius: "16px",
                  border: "none",
                  backgroundColor: COLORS.low.light,
                  color: COLORS.low.dark,
                  cursor: "pointer"
                }}>
                Clear All
              </button>
            )}
          </div>
        </div>
        
        {/* Insight Score Slider */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            fontWeight: "500",
            color: COLORS.ui.text.secondary
          }}>
            Minimum Insight Score: <strong style={{ color: getInsightScoreColor(minInsightScore) }}>{minInsightScore.toFixed(1)}</strong>
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={minInsightScore}
            onChange={(e) => setMinInsightScore(parseFloat(e.target.value))}
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "3px",
              outline: "none",
              cursor: "pointer"
            }}
          />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4px",
            fontSize: "11px",
            color: COLORS.ui.text.tertiary
          }}>
            <span>0.0</span>
            <span>10.0</span>
          </div>
        </div>
        
        {/* Comment Count Slider */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            fontWeight: "500",
            color: COLORS.ui.text.secondary
          }}>
            Minimum Comment Count: <strong style={{ color: COLORS.neutral.primary }}>{minCommentCount}</strong>
          </label>
          <input
            type="range"
            min={commentCountRange.min}
            max={commentCountRange.max}
            step="1"
            value={minCommentCount}
            onChange={(e) => setMinCommentCount(parseInt(e.target.value))}
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "3px",
              outline: "none",
              cursor: "pointer"
            }}
          />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4px",
            fontSize: "11px",
            color: COLORS.ui.text.tertiary
          }}>
            <span>{commentCountRange.min}</span>
            <span>{commentCountRange.max}</span>
          </div>
        </div>
      </div>
      
      {/* Results Summary */}
      <div style={{
        marginBottom: "16px",
        padding: "12px 16px",
        backgroundColor: COLORS.ui.surface,
        borderRadius: "8px",
        fontSize: "13px",
        color: COLORS.ui.text.secondary
      }}>
        Showing <strong style={{ color: COLORS.ui.text.primary }}>{filteredClusters.length}</strong> of <strong style={{ color: COLORS.ui.text.primary }}>{topicClustersData?.clusters?.length || 0}</strong> clusters
      </div>
      
      {/* Grouped Clusters */}
      <div>
        <h3 style={{
          margin: "0 0 16px 0",
          fontSize: "18px",
          fontWeight: "600",
          color: COLORS.ui.text.primary,
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "24px" }}>💡</span>
          <span>Key Insights</span>
        </h3>
        
        {filteredClusters.length === 0 ? (
          <div style={{
            padding: "32px",
            textAlign: "center",
            backgroundColor: COLORS.ui.surface,
            borderRadius: "12px",
            border: `1px dashed ${COLORS.ui.border}`
          }}>
            <p style={{
              margin: "0 0 8px 0",
              fontSize: "16px",
              fontWeight: "600",
              color: COLORS.ui.text.secondary
            }}>
              No insights match your filters
            </p>
            <p style={{
              margin: 0,
              fontSize: "14px",
              color: COLORS.ui.text.tertiary
            }}>
              Try adjusting your category or insight score filters
            </p>
          </div>
        ) : (
          groupedClusters.map((group, groupIdx) => {
            const { parent, clusters } = group
            
            if (!parent) {
              // No parent theme, render clusters directly
              return (
                <div key={`ungrouped-${groupIdx}`}>
                  {clusters.map(cluster => (
                    <ClusterCard
                      key={cluster.cluster_id}
                      cluster={cluster}
                      isExpanded={expandedClusters.has(cluster.cluster_id)}
                      onToggle={() => toggleCluster(cluster.cluster_id)}
                      expandedComments={expandedComments}
                      onToggleComment={toggleComment}
                      isReasoningExpanded={expandedReasonings.has(cluster.cluster_id)}
                      onToggleReasoning={() => toggleReasoning(cluster.cluster_id)}
                      getInsightScoreColor={getInsightScoreColor}
                      getCategoryColor={getCategoryColor}
                    />
                  ))}
                </div>
              )
            }
            
            const isThemeExpanded = expandedThemes.has(parent.parent_id)
            
            return (
              <div
                key={parent.parent_id}
                style={{
                  marginBottom: "20px",
                  border: `2px solid ${COLORS.neutral.primary}`,
                  borderRadius: "12px",
                  overflow: "hidden",
                  backgroundColor: "white"
                }}>
                {/* Parent Theme Header */}
                <div
                  onClick={() => toggleTheme(parent.parent_id)}
                  style={{
                    padding: "16px",
                    backgroundColor: `${COLORS.neutral.primary}15`,
                    cursor: "pointer",
                    borderBottom: isThemeExpanded ? `1px solid ${COLORS.ui.border}` : "none"
                  }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{
                      flexShrink: 0,
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.2s",
                      transform: isThemeExpanded ? "rotate(90deg)" : "rotate(0deg)"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M4 2L8 6L4 10"
                          stroke={COLORS.neutral.dark}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <h4 style={{
                        margin: "0 0 4px 0",
                        fontSize: "16px",
                        fontWeight: "700",
                        color: COLORS.neutral.dark
                      }}>
                        {parent.parent_statement}
                      </h4>
                      <p style={{
                        margin: "0 0 8px 0",
                        fontSize: "13px",
                        color: COLORS.ui.text.secondary,
                        lineHeight: "1.4"
                      }}>
                        {parent.description}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "12px",
                          color: COLORS.ui.text.tertiary
                        }}>
                          <strong>{parent.child_count}</strong> clusters • <strong>{parent.total_comment_count}</strong> comments
                        </span>
                        <div style={{
                          padding: "4px 10px",
                          backgroundColor: getInsightScoreColor(parent.avg_insight_score),
                          color: "white",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "700"
                        }}>
                          Avg Score: {parent.avg_insight_score.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Child Clusters */}
                {isThemeExpanded && (
                  <div style={{ padding: "12px" }}>
                    {clusters.map((cluster, idx) => (
                      <div key={cluster.cluster_id} style={{ marginBottom: idx < clusters.length - 1 ? "12px" : 0 }}>
                        <ClusterCard
                          cluster={cluster}
                          isExpanded={expandedClusters.has(cluster.cluster_id)}
                          onToggle={() => toggleCluster(cluster.cluster_id)}
                          expandedComments={expandedComments}
                          onToggleComment={toggleComment}
                          isReasoningExpanded={expandedReasonings.has(cluster.cluster_id)}
                          onToggleReasoning={() => toggleReasoning(cluster.cluster_id)}
                          getInsightScoreColor={getInsightScoreColor}
                          getCategoryColor={getCategoryColor}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
  
  // Check for tier restriction
  const viewerInsights = (analysis as any)?.viewerInsights
  if (viewerInsights && typeof viewerInsights === 'object' && 'tierRestriction' in viewerInsights && viewerInsights.tierRestriction) {
    return (
      <BlurredContent restriction={viewerInsights.tierRestriction}>
        {content}
      </BlurredContent>
    )
  }
  
  return (
    <>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ padding: "24px" }}>{content}</div>
    </>
  )
}

// Cluster Card Component
interface ClusterCardProps {
  cluster: TopicCluster
  isExpanded: boolean
  onToggle: () => void
  expandedComments: Set<string>
  onToggleComment: (commentKey: string) => void
  isReasoningExpanded: boolean
  onToggleReasoning: () => void
  getInsightScoreColor: (score: number) => string
  getCategoryColor: (category: string) => string
}

const ClusterCard = ({ 
  cluster, 
  isExpanded, 
  onToggle, 
  expandedComments, 
  onToggleComment, 
  isReasoningExpanded, 
  onToggleReasoning, 
  getInsightScoreColor, 
  getCategoryColor 
}: ClusterCardProps) => {
  return (
    <div style={{
      border: `2px solid ${getCategoryColor(cluster.category)}`,
      borderRadius: "10px",
      overflow: "hidden",
      backgroundColor: "white",
      boxShadow: isExpanded ? "0 4px 12px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)",
      transition: "all 0.3s ease"
    }}>
      {/* Cluster Header */}
      <div
        onClick={onToggle}
        style={{
          padding: "14px 16px",
          backgroundColor: `${getCategoryColor(cluster.category)}15`,
          borderBottom: isExpanded ? `1px solid ${COLORS.ui.border}` : "none",
          cursor: "pointer"
        }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{
            flexShrink: 0,
            width: "18px",
            height: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)"
          }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path
                d="M4 2L8 6L4 10"
                stroke={getCategoryColor(cluster.category)}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          
          <div style={{ flex: 1 }}>
            <p style={{
              margin: "0 0 8px 0",
              fontSize: "15px",
              fontWeight: "600",
              color: COLORS.ui.text.primary,
              lineHeight: "1.5"
            }}>
              {cluster.statement}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <div style={{
                padding: "4px 10px",
                backgroundColor: getCategoryColor(cluster.category),
                color: "white",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase"
              }}>
                {cluster.category}
              </div>
              <div style={{
                padding: "4px 10px",
                backgroundColor: getInsightScoreColor(cluster.insight_score),
                color: "white",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "700"
              }}>
                Score: {cluster.insight_score}
              </div>
              <span style={{
                fontSize: "12px",
                color: COLORS.ui.text.tertiary
              }}>
                {cluster.count} comments
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Cluster Details */}
      {isExpanded && (
        <div style={{ padding: "16px" }}>
          {/* Reasoning - Collapsible */}
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={onToggleReasoning}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                padding: "4px 0",
                cursor: "pointer",
                marginBottom: isReasoningExpanded ? "8px" : 0
              }}>
              <span style={{
                fontSize: "11px",
                fontWeight: "500",
                color: COLORS.ui.text.tertiary,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Why This Matters
              </span>
              <span style={{
                fontSize: "10px",
                color: COLORS.ui.text.tertiary,
                transition: "transform 0.2s",
                transform: isReasoningExpanded ? "rotate(90deg)" : "rotate(0deg)"
              }}>
                ▶
              </span>
            </button>
            {isReasoningExpanded && (
              <p style={{
                margin: 0,
                fontSize: "13px",
                color: COLORS.ui.text.secondary,
                lineHeight: "1.6"
              }}>
                {cluster.reasoning}
              </p>
            )}
          </div>
          
          {/* Segment Highlights */}
          {cluster.segment_highlights && cluster.segment_highlights.length > 0 && (
            <div>
              <h5 style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                fontWeight: "600",
                color: COLORS.ui.text.secondary,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Supporting Evidence ({cluster.segment_highlights.length})
              </h5>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {cluster.segment_highlights.map((highlight, idx) => {
                  const commentKey = `${cluster.cluster_id}-${idx}`
                  const isCommentExpanded = expandedComments.has(commentKey)
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "12px",
                        marginBottom: idx < cluster.segment_highlights.length - 1 ? "8px" : 0,
                        backgroundColor: COLORS.ui.surface,
                        borderRadius: "6px",
                        border: `1px solid ${COLORS.ui.border}`
                      }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "8px"
                      }}>
                        <span style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: COLORS.neutral.dark
                        }}>
                          {highlight.user}
                        </span>
                        {highlight.likes > 0 && (
                          <span style={{
                            fontSize: "11px",
                            color: COLORS.ui.text.tertiary
                          }}>
                            👍 {highlight.likes}
                          </span>
                        )}
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: "14px",
                        lineHeight: "1.6",
                        color: COLORS.ui.text.primary
                      }}>
                        {highlight.is_full_comment ? (
                          // When segment IS the full comment, always show full comment text normally
                          <span>{highlight.parent_comment_text}</span>
                        ) : (
                          // When segment is partial, show segment with quotes/underline or full comment when expanded
                          isCommentExpanded ? (
                            <span>{highlight.parent_comment_text}</span>
                          ) : (
                            renderSegmentHighlight(highlight)
                          )
                        )}
                      </p>
                      {!highlight.is_full_comment && (
                        <button
                          onClick={() => onToggleComment(commentKey)}
                          style={{
                            marginTop: "8px",
                            padding: "4px 8px",
                            fontSize: "11px",
                            fontWeight: "500",
                            color: COLORS.neutral.primary,
                            backgroundColor: "transparent",
                            border: `1px solid ${COLORS.neutral.primary}`,
                            borderRadius: "4px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = COLORS.neutral.light
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent"
                          }}>
                          {isCommentExpanded ? "Show less" : "Show full comment"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
