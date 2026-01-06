import { COLORS } from "~lib/colors"

interface ChannelCredibilitySubTabProps {
  channelCredibility: any
  credibilityScore: number
  credibilityFactors: any[]
}

export const ChannelCredibilitySubTab = ({ 
  channelCredibility, 
  credibilityScore, 
  credibilityFactors 
}: ChannelCredibilitySubTabProps) => {
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
                    fill={COLORS.high.primary}
                    fillOpacity={0.2}
                    stroke={COLORS.high.primary}
                    strokeWidth="2"
                  />

                  {/* Data points */}
                  {dataPoints.map((point: any, i: number) => (
                    <circle
                      key={`point-${i}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={COLORS.high.primary}
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
