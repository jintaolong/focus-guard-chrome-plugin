import { COLORS } from "~lib/colors"

interface OverviewSubTabProps {
  executiveSummary: string
  isExecutiveSummaryExpanded: boolean
  setIsExecutiveSummaryExpanded: (expanded: boolean) => void
  verdictColor: "high" | "medium" | "low" | "neutral"
  verdictLabel?: string
  keyTakeaways?: string[]
  maxCommentsRequested?: number
  actualCommentsFetched?: number
}

export const OverviewSubTab = ({ 
  executiveSummary, 
  isExecutiveSummaryExpanded, 
  setIsExecutiveSummaryExpanded, 
  verdictColor,
  verdictLabel,
  keyTakeaways,
  maxCommentsRequested,
  actualCommentsFetched
}: OverviewSubTabProps) => {
  const isLongSummary = executiveSummary.length > 200
  const displaySummary = isLongSummary && !isExecutiveSummaryExpanded 
    ? executiveSummary.substring(0, 200) + "..." 
    : executiveSummary
  
  // Calculate credit cost based on actual comments fetched
  const creditCost = actualCommentsFetched ? Math.ceil(actualCommentsFetched / 100) : null

  return (
    <div>
      {/* Comment Analysis Info Badge */}
      {(maxCommentsRequested || actualCommentsFetched) && (
        <div style={{
          marginBottom: "16px",
          padding: "12px",
          backgroundColor: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <span style={{ fontSize: "20px" }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#0369a1",
              marginBottom: "4px"
            }}>
              Comment Analysis
            </div>
            <div style={{
              fontSize: "11px",
              color: "#0c4a6e",
              lineHeight: "1.4"
            }}>
              {maxCommentsRequested && actualCommentsFetched && (
                <>
                  Requested: <strong>{maxCommentsRequested}</strong> • 
                  Analyzed: <strong>{actualCommentsFetched}</strong> • 
                  Cost: <strong>{creditCost} credit{creditCost !== 1 ? 's' : ''}</strong>
                </>
              )}
              {!maxCommentsRequested && actualCommentsFetched && (
                <>
                  Analyzed: <strong>{actualCommentsFetched}</strong> comments • 
                  Cost: <strong>{creditCost} credit{creditCost !== 1 ? 's' : ''}</strong>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.textPrimary
          }}>
          Summary
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
          Key Takeaways From Comments
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
            No comment takeaways available for this video
          </div>
        )}
      </div>
    </div>
  )
}
