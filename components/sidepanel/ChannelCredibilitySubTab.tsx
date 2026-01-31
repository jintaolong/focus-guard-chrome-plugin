import { COLORS, getTrustScoreColor } from "~lib/colors"

interface ChannelCredibilitySubTabProps {
  channelCredibility: any
  credibilityScore: number
  credibilityFactors: any[]
}

// Metric configuration with icons and labels
const METRIC_CONFIG = {
  audience_reach: {
    icon: "📊",
    label: "Audience Reach",
    shortLabel: "Reach"
  },
  creator_authority: {
    icon: "⭐",
    label: "Creator Authority",
    shortLabel: "Authority"
  },
  niche_focus: {
    icon: "🎯",
    label: "Niche Focus",
    shortLabel: "Focus"
  },
  community_loyalty: {
    icon: "❤️",
    label: "Community Loyalty",
    shortLabel: "Loyalty"
  },
  content_freshness: {
    icon: "🔄",
    label: "Content Freshness",
    shortLabel: "Freshness"
  }
}

export const ChannelCredibilitySubTab = ({ 
  channelCredibility, 
  credibilityScore, 
  credibilityFactors 
}: ChannelCredibilitySubTabProps) => {
  // Support both old and new format
  const isNewFormat = channelCredibility?.metrics && channelCredibility?.trust_score !== undefined
  const score = isNewFormat ? channelCredibility.trust_score : credibilityScore
  
  // Determine color theme based on trust score
  const trustColorKey = getTrustScoreColor(score)
  const chartColor = COLORS[trustColorKey].primary

  // Render NEW format with 5 metrics
  if (isNewFormat) {
    const metrics = channelCredibility.metrics
    const rawMetrics = channelCredibility.raw_metrics?.channel
    
    // Extract metrics array for spider chart
    const metricsArray = Object.keys(METRIC_CONFIG).map(key => ({
      key,
      ...METRIC_CONFIG[key],
      data: metrics[key]
    }))

    return (
      <div>
        {/* Channel Trust */}
        <div style={{ marginBottom: "32px" }}>
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "600",
              color: COLORS.ui.textPrimary
            }}>
            Channel Trust
          </h3>

          {/* Overall Score */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "12px",
              padding: "16px 24px",
              backgroundColor: COLORS.neutral.light,
              borderRadius: "12px",
              border: `2px solid ${score >= 70 ? COLORS.high.primary : score >= 40 ? COLORS.medium.primary : COLORS.low.primary}`
            }}>
              <div style={{
                fontSize: "42px",
                fontWeight: "700",
                color: score >= 70 ? COLORS.high.primary : score >= 40 ? COLORS.medium.primary : COLORS.low.primary
              }}>
                {Math.round(score)}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Overall Trust
                </div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                  out of 100
                </div>
              </div>
            </div>
          </div>

          {/* Spider/Radar Chart */}
          <div>
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <svg viewBox="0 0 350 350" style={{ width: "100%", maxWidth: "350px", height: "auto" }}>
                {(() => {
                  const centerX = 175
                  const centerY = 175
                  const radius = 100
                  const numMetrics = metricsArray.length
                  const webLevels = [0.2, 0.4, 0.6, 0.8, 1.0]
                  
                  // Calculate data points
                  const dataPoints = metricsArray.map((metric, i) => {
                    const angle = (Math.PI * 2 * i) / numMetrics - Math.PI / 2
                    const normalizedScore = (metric.data?.score || 0) / 100
                    const x = centerX + radius * normalizedScore * Math.cos(angle)
                    const y = centerY + radius * normalizedScore * Math.sin(angle)
                    return { x, y, angle, score: normalizedScore, metric }
                  })

                  // Calculate axis endpoints
                  const axisPoints = metricsArray.map((metric, i) => {
                    const angle = (Math.PI * 2 * i) / numMetrics - Math.PI / 2
                    return {
                      x: centerX + radius * Math.cos(angle),
                      y: centerY + radius * Math.sin(angle),
                      angle,
                      metric
                    }
                  })

                  return (
                    <>
                      {/* Background web circles */}
                      {webLevels.map((level, idx) => (
                        <circle
                          key={`web-${idx}`}
                          cx={centerX}
                          cy={centerY}
                          r={radius * level}
                          fill="none"
                          stroke={COLORS.ui.border}
                          strokeWidth="1"
                          opacity={0.3}
                        />
                      ))}

                      {/* Axis lines */}
                      {axisPoints.map((point, i) => (
                        <line
                          key={`axis-${i}`}
                          x1={centerX}
                          y1={centerY}
                          x2={point.x}
                          y2={point.y}
                          stroke={COLORS.ui.border}
                          strokeWidth="1"
                          opacity={0.5}
                        />
                      ))}

                      {/* Data polygon */}
                      <polygon
                        points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={chartColor}
                        fillOpacity={0.2}
                        stroke={chartColor}
                        strokeWidth="2"
                      />

                      {/* Data points */}
                      {dataPoints.map((point, i) => (
                        <circle
                          key={`point-${i}`}
                          cx={point.x}
                          cy={point.y}
                          r="4"
                          fill={chartColor}
                          stroke="white"
                          strokeWidth="2"
                        />
                      ))}

                      {/* Labels */}
                      {axisPoints.map((point, i) => {
                        const labelDistance = radius + 40
                        const labelX = centerX + labelDistance * Math.cos(point.angle)
                        const labelY = centerY + labelDistance * Math.sin(point.angle)
                        const words = point.metric.shortLabel.split(' ')
                        
                        return (
                          <text
                            key={`label-${i}`}
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="10"
                            fontWeight="600"
                            fill={COLORS.ui.textPrimary}
                            style={{ userSelect: 'none' }}>
                            {words.map((word, wordIdx) => (
                              <tspan 
                                key={wordIdx} 
                                x={labelX} 
                                dy={wordIdx === 0 ? 0 : "1.1em"}
                                textAnchor="middle">
                                {word}
                              </tspan>
                            ))}
                          </text>
                        )
                      })}
                    </>
                  )
                })()}
              </svg>
            </div>

            {/* Metrics Details Cards */}
            <div style={{ 
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "24px"
            }}>
              {metricsArray.map(metric => {
                const metricData = metric.data
                const metricScore = metricData?.score || 0
                const metricColor = metricScore >= 70 ? COLORS.high.primary : metricScore >= 40 ? COLORS.medium.primary : COLORS.low.primary
                
                return (
                  <div
                    key={metric.key}
                    style={{
                      backgroundColor: COLORS.neutral.light,
                      borderRadius: "8px",
                      padding: "12px",
                      border: `1px solid ${COLORS.ui.border}`
                    }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "18px" }}>{metric.icon}</span>
                        <span style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                          {metric.label}
                        </span>
                      </div>
                      <div style={{
                        fontSize: "20px",
                        fontWeight: "700",
                        color: metricColor
                      }}>
                        {Math.round(metricScore)}
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: COLORS.ui.textSecondary, marginBottom: "8px" }}>
                      {metricData?.description || "No description available"}
                    </div>
                    {metricData?.raw_value && (
                      <div style={{ 
                        fontSize: "11px", 
                        color: COLORS.ui.textSecondary,
                        backgroundColor: COLORS.ui.surface,
                        padding: "6px 8px",
                        borderRadius: "4px",
                        marginTop: "6px"
                      }}>
                        {renderRawValue(metric.key, metricData.raw_value, rawMetrics)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Channel Info Summary */}
            {rawMetrics && (
              <div style={{
                marginTop: "20px",
                backgroundColor: COLORS.neutral.light,
                borderRadius: "8px",
                padding: "12px",
                border: `1px solid ${COLORS.ui.border}`
              }}>
                <h4 style={{ 
                  margin: "0 0 8px 0", 
                  fontSize: "13px", 
                  fontWeight: "600",
                  color: COLORS.ui.textPrimary 
                }}>
                  Channel Overview
                </h4>
                <div style={{ fontSize: "12px", color: COLORS.ui.textSecondary }}>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Subscribers:</strong> {formatNumber(rawMetrics.subscriber_count)}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Total Videos:</strong> {formatNumber(rawMetrics.video_count)}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Total Views:</strong> {formatNumber(rawMetrics.view_count)}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Account Age:</strong> {Math.round(rawMetrics.account_age_days / 365)} years ({rawMetrics.account_age_days} days)
                  </div>
                  {rawMetrics.topic_categories && rawMetrics.topic_categories.length > 0 && (
                    <div style={{ marginBottom: "4px" }}>
                      <strong>Topic Categories:</strong> {rawMetrics.topic_categories.join(", ")}
                    </div>
                  )}
                  <div>
                    <strong>YouTube Topics Assigned:</strong> {rawMetrics.has_topic_labels ? "✓ Yes" : "✗ No"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render OLD format (legacy support)
  return (
    <div>
      {/* Channel Credibility */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Channel Trust
        </h3>

        {/* Note: Factor scores are normalized percentages (0-100) representing relative weight/importance 
            in credibility calculation, NOT raw values. For example, 300K subscribers might show as 30% 
            because it represents moderate weight in the overall credibility score calculation. 
            See "Value" column for actual raw values. */}

        {/* Overall Score */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "12px",
            padding: "16px 24px",
            backgroundColor: COLORS.neutral.light,
            borderRadius: "12px",
            border: `2px solid ${credibilityScore >= 70 ? COLORS.high.primary : credibilityScore >= 40 ? COLORS.medium.primary : COLORS.low.primary}`
          }}>
            <div style={{
              fontSize: "42px",
              fontWeight: "700",
              color: credibilityScore >= 70 ? COLORS.high.primary : credibilityScore >= 40 ? COLORS.medium.primary : COLORS.low.primary
            }}>
              {credibilityScore}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Channel Trust
              </div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: COLORS.ui.textPrimary }}>
                out of 100
              </div>
            </div>
          </div>
        </div>

        {/* Spider/Radar Chart */}
        {credibilityFactors.length > 0 && (() => {
          // Debug: log raw factor data
          console.log("SummaryTab: Raw credibilityFactors:", credibilityFactors)
          
          // Normalize factor weights to 0-100 range first (in case they're 0-1)
          const factorsWithScores = credibilityFactors.map((factor: any) => {
            const rawWeight = Number(factor.weight) || 0
            // If weight is between 0-1, convert to 0-100
            const normalizedWeight = rawWeight <= 1 ? rawWeight * 100 : rawWeight
            return { ...factor, normalizedWeight }
          })
          
          console.log("SummaryTab: Factors after first normalization:", factorsWithScores)
          
          // Use the normalized weights directly for visualization (no min-max scaling)
          // This ensures that the visual representation matches the actual percentage values
          const visualFactors = factorsWithScores.map((f: any) => ({
            ...f,
            visualScore: f.normalizedWeight // Use actual percentage for chart
          }))
          
          console.log("SummaryTab: Visual factors for radar chart:", visualFactors)
          
          const centerX = 175
          const centerY = 175
          const radius = 100
          const numFactors = visualFactors.length
          
          // Calculate points for the web and the data
          const webLevels = [0.2, 0.4, 0.6, 0.8, 1.0] // 5 concentric levels
          const dataPoints = visualFactors.map((factor: any, i: number) => {
            const angle = (Math.PI * 2 * i) / numFactors - Math.PI / 2 // Start from top
            const normalizedScore = factor.visualScore / 100 // Use visualScore for chart
            const x = centerX + radius * normalizedScore * Math.cos(angle)
            const y = centerY + radius * normalizedScore * Math.sin(angle)
            return { x, y, angle, score: normalizedScore, factor }
          })

          // Generate axis points (endpoints)
          const axisPoints = visualFactors.map((factor: any, i: number) => {
            const angle = (Math.PI * 2 * i) / numFactors - Math.PI / 2
            return {
              x: centerX + radius * Math.cos(angle),
              y: centerY + radius * Math.sin(angle),
              angle,
              factor
            }
          })

          return (
            <div>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <svg viewBox="0 0 350 350" style={{ width: "100%", maxWidth: "350px", height: "auto" }}>
                  {/* Background web circles */}
                  {webLevels.map((level, idx) => (
                    <circle
                      key={`web-${idx}`}
                      cx={centerX}
                      cy={centerY}
                      r={radius * level}
                      fill="none"
                      stroke={COLORS.ui.border}
                      strokeWidth="1"
                      opacity={0.3}
                    />
                  ))}

                  {/* Axis lines */}
                  {axisPoints.map((point: any, i: number) => (
                    <line
                      key={`axis-${i}`}
                      x1={centerX}
                      y1={centerY}
                      x2={point.x}
                      y2={point.y}
                      stroke={COLORS.ui.border}
                      strokeWidth="1"
                      opacity={0.5}
                    />
                  ))}

                  {/* Data polygon */}
                  <polygon
                    points={dataPoints.map((p: any) => `${p.x},${p.y}`).join(' ')}
                    fill={chartColor}
                    fillOpacity={0.2}
                    stroke={chartColor}
                    strokeWidth="2"
                  />

                  {/* Data points */}
                  {dataPoints.map((point: any, i: number) => (
                    <circle
                      key={`point-${i}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={chartColor}
                      stroke="white"
                      strokeWidth="2"
                    />
                  ))}

                  {/* Labels */}
                  {axisPoints.map((point: any, i: number) => {
                    const factor = point.factor
                    const labelDistance = radius + 35
                    const labelX = centerX + labelDistance * Math.cos(point.angle)
                    const labelY = centerY + labelDistance * Math.sin(point.angle)
                    
                    // Format factor name for display (capitalized words)
                    const displayName = factor.name
                      .replace(/_/g, ' ')
                      .replace(/([A-Z])/g, ' $1') // Handle camelCase
                      .trim()
                      .split(' ')
                      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')
                    
                    // Special case for HasTopicLabels
                    const finalDisplayName = displayName.toLowerCase().includes('has topic labels') 
                      ? 'Topic Consistency' 
                      : displayName
                    
                    return (
                      <text
                        key={`label-${i}`}
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill={COLORS.ui.textPrimary}
                        style={{ 
                          userSelect: 'none',
                          maxWidth: '70px'
                        }}>
                        {/* Split long names into multiple lines */}
                        {finalDisplayName.split(' ').map((word: string, wordIdx: number, arr: string[]) => (
                          <tspan 
                            key={wordIdx} 
                            x={labelX} 
                            dy={wordIdx === 0 ? 0 : "1.1em"}
                            textAnchor="middle">
                            {word}
                          </tspan>
                        ))}
                      </text>
                    )
                  })}
                </svg>
              </div>

              {/* Factor Details Table */}
              <div style={{ 
                marginTop: "16px",
                backgroundColor: COLORS.neutral.light,
                borderRadius: "8px",
                padding: "12px",
                fontSize: "12px"
              }}>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr 80px 80px",
                  gap: "8px",
                  fontWeight: "600",
                  paddingBottom: "8px",
                  borderBottom: `1px solid ${COLORS.ui.border}`,
                  color: COLORS.ui.textSecondary
                }}>
                  <div>Factor</div>
                  <div style={{ textAlign: "right" }}>Normalized Score</div>
                  <div style={{ textAlign: "right" }}>Value</div>
                </div>
                {visualFactors.map((factor: any, index: number) => {
                  // Format factor name for display (capitalized words)
                  const displayName = factor.name
                    .replace(/_/g, ' ')
                    .replace(/([A-Z])/g, ' $1') // Handle camelCase
                    .trim()
                    .split(' ')
                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                  
                  // Special case for HasTopicLabels
                  const finalDisplayName = displayName.toLowerCase().includes('has topic labels') 
                    ? 'Topic Consistency' 
                    : displayName
                  
                  return (
                    <div
                      key={index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 80px 80px",
                        gap: "8px",
                        paddingTop: "8px",
                        alignItems: "center"
                      }}>
                      <div style={{ 
                        fontWeight: "500", 
                        color: COLORS.ui.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {finalDisplayName}
                      </div>
                      <div style={{ 
                        textAlign: "right",
                        fontWeight: "700",
                        color: factor.normalizedWeight >= 70 ? COLORS.high.primary : factor.normalizedWeight >= 40 ? COLORS.medium.primary : COLORS.low.primary
                      }}>
                        {Math.round(factor.normalizedWeight)}%
                      </div>
                      <div style={{ 
                        textAlign: "right",
                        color: COLORS.ui.textSecondary,
                        fontSize: "11px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {/* Special handling for boolean metrics */}
                        {factor.name.toLowerCase().includes('hastopiclabels') || factor.name.toLowerCase().includes('has_topic_labels')
                          ? (factor.value == 1 || factor.value === true || factor.value === 'true' ? 'True' : 'False')
                          : factor.name.toLowerCase() === 'verified' 
                          ? (factor.value == 1 || factor.value === true || factor.value === 'true' ? 'Yes' : 'No')
                          : factor.value
                        }
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ 
                marginTop: "12px",
                fontSize: "11px",
                color: COLORS.ui.textSecondary,
                textAlign: "center",
                fontStyle: "italic"
              }}>
                Normalized Score shows how much each item contributes (0-100).
              </div>

              <div style={{
                marginTop: "8px",
                fontSize: "11px",
                color: COLORS.ui.textSecondary,
                textAlign: "center"
              }}>
                <em>Topic Consistency is based on whether YouTube has assigned topic tags to this channel.</em>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// Helper function to render raw values in a user-friendly way
function renderRawValue(metricKey: string, rawValue: any, channelMetrics: any): string {
  switch (metricKey) {
    case "audience_reach":
      return `${formatNumber(rawValue.subscribers)} subscribers • ${formatNumber(rawValue.total_views)} total views`
    
    case "creator_authority":
      const years = Math.floor(rawValue.account_age_days / 365)
      const remainingDays = rawValue.account_age_days % 365
      return `${years}y ${remainingDays}d old • ${formatNumber(rawValue.video_count)} videos`
    
    case "niche_focus":
      const categories = rawValue.categories || []
      const primaryCat = rawValue.primary_category || "Unknown"
      const primaryCount = rawValue.primary_count || 0
      const total = categories.length
      const percentage = total > 0 ? Math.round((primaryCount / total) * 100) : 0
      return `Primary: ${getCategoryName(primaryCat)} (${percentage}% of ${total} videos)`
    
    case "community_loyalty":
      const ratio = rawValue.ratio || 0
      const percentage2 = (ratio * 100).toFixed(2)
      return `${formatNumber(rawValue.total_likes)} likes on ${formatNumber(rawValue.total_views)} views (${percentage2}%)`
    
    case "content_freshness":
      const avgGap = Math.round(rawValue.avg_gap_days)
      const totalDays = rawValue.total_elapsed_days
      const videoCount = rawValue.video_count
      return `Posts every ${avgGap} days on avg (${videoCount} videos in ${totalDays} days)`
    
    default:
      return JSON.stringify(rawValue)
  }
}

// Helper to format numbers with commas
function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + "B"
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

// Helper to get category name from YouTube category ID
function getCategoryName(categoryId: string): string {
  const categories: Record<string, string> = {
    "1": "Film & Animation",
    "2": "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "19": "Travel & Events",
    "20": "Gaming",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism"
  }
  return categories[categoryId] || `Category ${categoryId}`
}
