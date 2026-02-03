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
  // Debug logging
  console.log("ChannelCredibilitySubTab - channelCredibility:", channelCredibility)
  console.log("ChannelCredibilitySubTab - credibilityScore:", credibilityScore)
  console.log("ChannelCredibilitySubTab - credibilityFactors:", credibilityFactors)
  
  // Support both old and new format
  const isNewFormat = channelCredibility?.metrics && channelCredibility?.trust_score !== undefined
  console.log("ChannelCredibilitySubTab - isNewFormat:", isNewFormat)
  
  const score = isNewFormat ? channelCredibility.trust_score : credibilityScore
  
  // Determine color theme based on trust score
  const trustColorKey = getTrustScoreColor(score)
  const chartColor = COLORS[trustColorKey].primary

  // Render NEW format with 5 metrics
  if (isNewFormat) {
    const metrics = channelCredibility.metrics
    const rawMetrics = channelCredibility.raw_metrics?.channel
    const metricDetails = channelCredibility.metric_details || {}
    
    // Extract metrics array for spider chart
    // Backend returns MetricBreakdown objects directly (score, normalized_value, description, raw_value)
    const metricsArray = (Object.keys(METRIC_CONFIG) as Array<keyof typeof METRIC_CONFIG>).map(key => ({
      key,
      ...METRIC_CONFIG[key],
      // metrics[key] is already a MetricBreakdown object
      metricData: metrics[key]
    }))
    
    // Helper functions to get category labels (matching report_generation_service.py)
    const getReachLabel = (subscribers: number): string => {
      if (subscribers >= 1000000) return "Mega Channel"
      if (subscribers >= 100000) return "Large Channel"
      if (subscribers >= 10000) return "Medium Channel"
      if (subscribers >= 1000) return "Small Channel"
      return "Micro Channel"
    }
    
    const getAuthorityLabel = (ageYears: number, videoCount: number): string => {
      if (ageYears >= 5 && videoCount >= 500) return "Veteran Creator"
      if (ageYears >= 3 && videoCount >= 200) return "Established Creator"
      if (ageYears >= 1 && videoCount >= 50) return "Growing Creator"
      if (videoCount >= 20) return "New Creator"
      return "Beginner"
    }
    
    const getFocusLabel = (score: number): string => {
      if (score >= 80) return "Highly Focused"
      if (score >= 60) return "Moderately Focused"
      if (score >= 40) return "Diverse Topics"
      return "Scattered Content"
    }
    
    const getLoyaltyLabel = (likeRatio: number | null): string => {
      if (likeRatio === null || likeRatio === undefined) return "N/A"
      if (likeRatio >= 0.04) return "Exceptional"
      if (likeRatio >= 0.02) return "Strong"
      if (likeRatio >= 0.01) return "Good"
      if (likeRatio >= 0.005) return "Fair"
      return "Weak"
    }
    
    const getFreshnessLabel = (avgGapDays: number | null): string => {
      if (avgGapDays === null || avgGapDays === undefined) return "N/A"
      if (avgGapDays < 7) return "Daily Upload"
      if (avgGapDays < 30) return "Weekly Upload"
      if (avgGapDays < 90) return "Monthly Upload"
      return "Dormant"
    }
    
    // Extract raw metric values from each metric's raw_value field
    const audienceReachData = metrics.audience_reach?.raw_value || {}
    const authorityData = metrics.creator_authority?.raw_value || {}
    const focusData = metrics.niche_focus?.raw_value || {}
    const loyaltyData = metrics.community_loyalty?.raw_value || {}
    const freshnessData = metrics.content_freshness?.raw_value || {}
    
    // Extract channel-level metrics from audience_reach and creator_authority
    const subscribers = audienceReachData.subscribers || 0
    const totalViews = audienceReachData.total_views || 0
    const ageDays = authorityData.account_age_days || 0
    const videoCount = authorityData.video_count || 0
    const ageYears = ageDays / 365.25
    const hasTopicLabels = focusData.has_topic_labels || false
    
    const primaryCategory = focusData.primary_category_name
    const likeRatio = loyaltyData.ratio
    const totalLikes = loyaltyData.total_likes ?? null
    const avgGapDays = freshnessData.avg_gap_days

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
                    // metricData.score is the 0-100 score from MetricBreakdown
                    const normalizedScore = (metric.metricData?.score || 0) / 100
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
                            {words.map((word: string, wordIdx: number) => (
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

            {/* 5-Pillar Trust Framework Table */}
            <div style={{
              marginTop: "24px",
              backgroundColor: COLORS.ui.surface,
              borderRadius: "8px",
              padding: "16px",
              border: `1px solid ${COLORS.ui.border}`
            }}>
              <h4 style={{ 
                margin: "0 0 16px 0", 
                fontSize: "14px", 
                fontWeight: "600",
                color: COLORS.ui.textPrimary,
                borderBottom: `2px solid ${COLORS.ui.border}`,
                paddingBottom: "8px"
              }}>
                5-Pillar Trust Framework
              </h4>
              
              {/* Metric 1: Audience Reach */}
              <div style={{ marginBottom: "20px", borderBottom: `1px solid ${COLORS.ui.border}`, paddingBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: COLORS.ui.textPrimary }}>
                      📊 Audience Reach
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.high.primary, fontWeight: "600", marginTop: "2px" }}>
                      {getReachLabel(subscribers)}
                    </div>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: metrics.audience_reach?.score >= 70 ? COLORS.high.primary : COLORS.medium.primary }}>
                    {Math.round(metrics.audience_reach?.score || 0)}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, fontStyle: "italic", marginBottom: "8px" }}>
                  Shows the 'size of the room' this creator speaks to. Balances subscribers with views to filter out 'dead' channels.
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, marginBottom: "6px" }}>
                  Formula: Geometric mean of subscriber and view counts, normalized to 0-100 scale
                </div>
                <div style={{ fontSize: "12px", color: COLORS.ui.textPrimary }}>
                  <div>• Subscribers: <strong>{formatNumber(subscribers)}</strong></div>
                  <div>• Total Views: <strong>{formatNumber(totalViews)}</strong></div>
                </div>
              </div>
              
              {/* Metric 2: Creator Authority */}
              <div style={{ marginBottom: "20px", borderBottom: `1px solid ${COLORS.ui.border}`, paddingBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: COLORS.ui.textPrimary }}>
                      ⭐ Creator Authority
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.high.primary, fontWeight: "600", marginTop: "2px" }}>
                      {getAuthorityLabel(ageYears, videoCount)}
                    </div>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: metrics.creator_authority?.score >= 70 ? COLORS.high.primary : COLORS.medium.primary }}>
                    {Math.round(metrics.creator_authority?.score || 0)}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, fontStyle: "italic", marginBottom: "8px" }}>
                  Separates 'viral hit wonders' from seasoned veterans. Rewards longevity and library depth, signaling reliability.
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, marginBottom: "6px" }}>
                  Formula: Weighted combination of channel age (years) and video count, normalized to 0-100
                </div>
                <div style={{ fontSize: "12px", color: COLORS.ui.textPrimary }}>
                  <div>• Channel Age: <strong>{ageYears.toFixed(1)} years</strong> ({ageDays} days)</div>
                  <div>• Total Videos: <strong>{formatNumber(videoCount)}</strong></div>
                </div>
              </div>
              
              {/* Metric 3: Niche Focus */}
              <div style={{ marginBottom: "20px", borderBottom: `1px solid ${COLORS.ui.border}`, paddingBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: COLORS.ui.textPrimary }}>
                      🎯 Niche Focus
                    </div>
                    <div style={{ fontSize: "11px", color: metrics.niche_focus?.score >= 60 ? COLORS.high.primary : COLORS.medium.primary, fontWeight: "600", marginTop: "2px" }}>
                      {getFocusLabel(metrics.niche_focus?.score || 0)}
                    </div>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: metrics.niche_focus?.score >= 70 ? COLORS.high.primary : metrics.niche_focus?.score >= 40 ? COLORS.medium.primary : COLORS.low.primary }}>
                    {Math.round(metrics.niche_focus?.score || 0)}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, fontStyle: "italic", marginBottom: "8px" }}>
                  High consistency = dedicated expert; chaos = trend-chaser. Measures content specialization vs 'jack of all trades' approach.
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, marginBottom: "6px" }}>
                  Formula: Category consistency in recent 10 videos, scaled to 0-100
                </div>
                <div style={{ fontSize: "12px", color: COLORS.ui.textPrimary }}>
                  <div>• Primary Category: <strong>{primaryCategory || "None found"}</strong></div>
                  <div>• Topic Labels: <strong>{hasTopicLabels ? "✓ Enabled" : "✗ Disabled"}</strong></div>
                </div>
              </div>
              
              {/* Metric 4: Community Loyalty */}
              <div style={{ marginBottom: "20px", borderBottom: `1px solid ${COLORS.ui.border}`, paddingBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: COLORS.ui.textPrimary }}>
                      ❤️ Community Loyalty
                    </div>
                    <div style={{ fontSize: "11px", color: ((likeRatio !== null && likeRatio !== undefined) || (totalLikes !== null && totalLikes !== undefined)) ? COLORS.medium.primary : COLORS.ui.textSecondary, fontWeight: "600", marginTop: "2px" }}>
                      {getLoyaltyLabel(likeRatio)}
                    </div>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: metrics.community_loyalty?.score >= 70 ? COLORS.high.primary : COLORS.medium.primary }}>
                    {Math.round(metrics.community_loyalty?.score || 0)}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, fontStyle: "italic", marginBottom: "8px" }}>
                  Views can be bought; engagement ratios prove real fans. High like-to-view ratio means the audience actually cares.
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, marginBottom: "6px" }}>
                  Formula: Like-to-view ratio clamped between 0.5% (floor) and 5% (ceiling), scaled to 0-100
                </div>
                <div style={{ fontSize: "12px", color: COLORS.ui.textPrimary }}>
                  {((likeRatio !== null && likeRatio !== undefined) || (totalLikes !== null && totalLikes !== undefined)) ? (
                    (likeRatio !== null && likeRatio !== undefined) ? (
                      <div>
                        • Like Ratio: <strong>{(likeRatio * 100).toFixed(2)}%</strong>
                        {totalLikes ? <span> • <strong>{formatNumber(totalLikes)}</strong> likes</span> : null}
                      </div>
                    ) : (
                      <div>• Total Likes: <strong>{formatNumber(totalLikes)}</strong></div>
                    )
                  ) : (
                    <div>• Like Ratio: <strong>N/A</strong> (no engagement data available)</div>
                  )}
                </div>
              </div>
              
              {/* Metric 5: Content Freshness */}
              <div style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: COLORS.ui.textPrimary }}>
                      🔄 Content Freshness
                    </div>
                    <div style={{ fontSize: "11px", color: avgGapDays ? COLORS.medium.primary : COLORS.ui.textSecondary, fontWeight: "600", marginTop: "2px" }}>
                      {getFreshnessLabel(avgGapDays)}
                    </div>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: metrics.content_freshness?.score >= 70 ? COLORS.high.primary : COLORS.medium.primary }}>
                    {Math.round(metrics.content_freshness?.score || 0)}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, fontStyle: "italic", marginBottom: "8px" }}>
                  Dead channels shouldn't be rated 'credible'. Active creators provide current, relevant information.
                </div>
                <div style={{ fontSize: "11px", color: COLORS.ui.textSecondary, marginBottom: "6px" }}>
                  Formula: Average upload gap in days, inverted and scaled (shorter gap = higher score)
                </div>
                <div style={{ fontSize: "12px", color: COLORS.ui.textPrimary }}>
                  <div>• Average Upload Gap: <strong>{avgGapDays ? `${avgGapDays.toFixed(1)} days` : "N/A"}</strong></div>
                  <div style={{ fontSize: "10px", color: COLORS.ui.textSecondary, marginTop: "4px" }}>
                    (&lt;7d = Daily | &lt;30d = Weekly | &lt;90d = Monthly | &gt;90d = Dormant)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render OLD format (legacy support) - ONLY if not in new format
  // This prevents showing old credibilityFactors table when new format is available
  if (!isNewFormat) {
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
          // Map old factor names to new metric names
          const factorNameMapping: Record<string, string> = {
            'subscriberCount': 'Audience Reach',
            'subscriber_count': 'Audience Reach',
            'videoCount': 'Creator Authority',
            'video_count': 'Creator Authority',
            'viewCount': 'Audience Reach',
            'view_count': 'Audience Reach',
            'accountAgeDays': 'Creator Authority',
            'account_age_days': 'Creator Authority',
            'hasTopicLabels': 'Niche Focus',
            'has_topic_labels': 'Niche Focus',
            'topicLabels': 'Niche Focus'
          }
          
          // Debug: log raw factor data
          console.log("ChannelCredibilitySubTab: Raw credibilityFactors:", credibilityFactors)
          
          // Use backend values directly, but handle 0-1 normalized range
          const visualFactors = credibilityFactors.map((factor: any) => {
            const backendWeight = Number(factor.weight) || 0
            // If backend sends 0-1 range (normalized), convert to 0-100 for display
            // Otherwise use the value as-is (already in 0-100 range)
            const displayScore = backendWeight <= 1 ? backendWeight * 100 : backendWeight
            
            // Get the display name from mapping, or format the original name
            let displayName = factorNameMapping[factor.name] || factor.name
              .replace(/_/g, ' ')
              .replace(/([A-Z])/g, ' $1')
              .trim()
              .split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
            
            return { 
              ...factor, 
              displayName,
              displayScore,
              visualScore: displayScore // Use for chart
            }
          })
          
          console.log("ChannelCredibilitySubTab: Visual factors (backend values):", visualFactors)
          
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
                    
                    // Use the pre-computed display name from the factor
                    const displayName = factor.displayName || factor.name
                    
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
                        {displayName.split(' ').map((word: string, wordIdx: number, arr: string[]) => (
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
                  <div>Metric Category</div>
                  <div style={{ textAlign: "right" }}>Score</div>
                  <div style={{ textAlign: "right" }}>Raw Value</div>
                </div>
                {visualFactors.map((factor: any, index: number) => {
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
                        {factor.displayName}
                      </div>
                      <div style={{ 
                        textAlign: "right",
                        fontWeight: "700",
                        color: factor.displayScore >= 70 ? COLORS.high.primary : factor.displayScore >= 40 ? COLORS.medium.primary : COLORS.low.primary
                      }}>
                        {Math.round(factor.displayScore)}
                      </div>
                      <div style={{ 
                        textAlign: "right",
                        color: COLORS.ui.textSecondary,
                        fontSize: "11px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {/* Format values appropriately */}
                        {factor.name.toLowerCase().includes('hastopiclabels') || factor.name.toLowerCase().includes('has_topic_labels')
                          ? (factor.value == 1 || factor.value === true || factor.value === 'true' ? '✓ Yes' : '✗ No')
                          : factor.name.toLowerCase() === 'verified' 
                          ? (factor.value == 1 || factor.value === true || factor.value === 'true' ? '✓ Yes' : '✗ No')
                          : typeof factor.value === 'number' && factor.value >= 1000
                          ? formatNumber(factor.value)
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
                Scores are normalized (0-100) based on channel metrics across the platform.
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
  }
  
  // If neither old nor new format, show error message
  return (
    <div style={{ padding: "20px", textAlign: "center", color: COLORS.ui.textSecondary }}>
      <p>Channel trust data is not available in a recognized format.</p>
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
