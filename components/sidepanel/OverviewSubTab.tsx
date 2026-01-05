import { COLORS } from "~lib/colors"

interface OverviewSubTabProps {
  executiveSummary: string
  isExecutiveSummaryExpanded: boolean
  setIsExecutiveSummaryExpanded: (expanded: boolean) => void
  verdictColor: "high" | "medium" | "low" | "neutral"
  keyTakeaways?: string[]
}

export const OverviewSubTab = ({ 
  executiveSummary, 
  isExecutiveSummaryExpanded, 
  setIsExecutiveSummaryExpanded, 
  verdictColor,
  keyTakeaways 
}: OverviewSubTabProps) => {
  const isLongSummary = executiveSummary.length > 200
  const displaySummary = isLongSummary && !isExecutiveSummaryExpanded 
    ? executiveSummary.substring(0, 200) + "..." 
    : executiveSummary

  return (
    <div>
      {/* Executive Summary */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Executive Summary
        </h3>
        <div
          style={{
            backgroundColor: COLORS.neutral.light,
            padding: "16px",
            borderRadius: "8px",
            borderLeft: `4px solid ${COLORS[verdictColor].primary}`
          }}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              lineHeight: "1.6",
              color: COLORS.ui.textSecondary
            }}>
            {displaySummary}
          </p>
          {isLongSummary && (
            <button
              onClick={() => setIsExecutiveSummaryExpanded(!isExecutiveSummaryExpanded)}
              style={{
                marginTop: "8px",
                padding: "4px 8px",
                fontSize: "12px",
                color: COLORS.neutral.primary,
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline"
              }}>
              {isExecutiveSummaryExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>

      {/* Key Takeaways */}
      <div>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Key Takeaways
        </h3>
        {keyTakeaways && keyTakeaways.length > 0 ? (
          <div
            style={{
              backgroundColor: COLORS.neutral.light,
              padding: "16px",
              borderRadius: "8px"
            }}>
            <ul style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "14px",
              lineHeight: "1.8",
              color: COLORS.ui.textSecondary
            }}>
              {keyTakeaways.map((takeaway, idx) => (
                <li key={idx} style={{ marginBottom: "8px" }}>
                  {takeaway}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: COLORS.neutral.light,
              padding: "16px",
              borderRadius: "8px",
              fontSize: "14px",
              color: COLORS.ui.textSecondary,
              fontStyle: "italic"
            }}>
            No key takeaways available for this video
          </div>
        )}
      </div>
    </div>
  )
}
