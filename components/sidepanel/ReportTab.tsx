// FR-102 Tab 4: Report & Account
// Report Download + Analysis History

import { useState } from "react"
import type { VideoAnalysis, AnalysisHistoryItem } from "~types/analysis"
import { COLORS, getTrustScoreColor } from "~lib/colors"

interface ReportTabProps {
  analysis: VideoAnalysis
  history?: AnalysisHistoryItem[]
  onDownloadReport?: (format: "PDF" | "TXT") => void
  onReAnalyze?: (videoId: string) => void
  onDownloadHistoryReport?: (videoId: string) => void
}

export const ReportTab = ({
  analysis,
  history = [],
  onDownloadReport,
  onReAnalyze,
  onDownloadHistoryReport
}: ReportTabProps) => {
  const [selectedFormat, setSelectedFormat] = useState<"PDF" | "TXT">("PDF")
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (!onDownloadReport) return
    setIsDownloading(true)
    try {
      await onDownloadReport(selectedFormat)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div style={{ padding: "24px" }}>
      {/* Report Download Section */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.text.primary
          }}>
          Download Report
        </h3>

        {/* Format Selector */}
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: COLORS.ui.text.secondary
            }}>
            Select Format:
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            {analysis.reportInfo.availableFormats.map((format) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor:
                    selectedFormat === format ? COLORS.neutral.primary : "white",
                  color: selectedFormat === format ? "white" : COLORS.ui.text.primary,
                  border: `2px solid ${COLORS.neutral.primary}`,
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (selectedFormat !== format) {
                    e.currentTarget.style.backgroundColor = COLORS.neutral.light
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFormat !== format) {
                    e.currentTarget.style.backgroundColor = "white"
                  }
                }}>
                {format}
              </button>
            ))}
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          style={{
            width: "100%",
            padding: "14px",
            backgroundColor: isDownloading ? COLORS.ui.border : COLORS.neutral.primary,
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600",
            cursor: isDownloading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
          onMouseEnter={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.backgroundColor = COLORS.neutral.dark
            }
          }}
          onMouseLeave={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.backgroundColor = COLORS.neutral.primary
            }
          }}>
          {isDownloading ? (
            <>
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid white",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}
              />
              <span>Preparing Download...</span>
            </>
          ) : (
            <>
              <span>📥</span>
              <span>Download {selectedFormat} Report</span>
            </>
          )}
        </button>

        {/* Analysis Date */}
        <p
          style={{
            margin: "12px 0 0 0",
            fontSize: "12px",
            color: COLORS.ui.text.secondary,
            textAlign: "center"
          }}>
          Analysis performed: {new Date(analysis.reportInfo.analysisDate).toLocaleString()}
        </p>
      </div>

      {/* Analysis History */}
      <div>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: COLORS.ui.text.primary
          }}>
          Recent Analysis History
        </h3>

        {history.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              backgroundColor: COLORS.ui.surface,
              border: `1px solid ${COLORS.ui.border}`,
              borderRadius: "8px"
            }}>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: COLORS.ui.text.secondary
              }}>
              No analysis history yet
            </p>
          </div>
        ) : (
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
            {history.map((item) => {
              const trustColor = getTrustScoreColor(item.trustScore)
              return (
                <div
                  key={item.videoId}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "12px",
                    backgroundColor: "white",
                    border: `1px solid ${COLORS.ui.border}`,
                    borderRadius: "8px",
                    transition: "box-shadow 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none"
                  }}>
                  {/* Thumbnail */}
                  <img
                    src={item.videoThumbnail}
                    alt={item.videoTitle}
                    style={{
                      width: "80px",
                      height: "45px",
                      borderRadius: "4px",
                      objectFit: "cover",
                      flexShrink: 0
                    }}
                  />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: "0 0 6px 0",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: COLORS.ui.text.primary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                      {item.videoTitle}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px"
                      }}>
                      <div
                        style={{
                          padding: "2px 8px",
                          backgroundColor: COLORS[trustColor].light,
                          border: `1px solid ${COLORS[trustColor].primary}`,
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "700",
                          color: COLORS[trustColor].text
                        }}>
                        {item.trustScore.toFixed(1)}
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: COLORS.ui.text.secondary
                        }}>
                        {new Date(item.analyzedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px" }}>
                      {onReAnalyze && (
                        <button
                          onClick={() => onReAnalyze(item.videoId)}
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: "600",
                            color: COLORS.neutral.primary,
                            backgroundColor: "transparent",
                            border: `1px solid ${COLORS.neutral.primary}`,
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}>
                          Re-analyze
                        </button>
                      )}
                      {onDownloadHistoryReport && item.reportUrl && (
                        <button
                          onClick={() => onDownloadHistoryReport(item.videoId)}
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: "600",
                            color: COLORS.neutral.primary,
                            backgroundColor: "transparent",
                            border: `1px solid ${COLORS.neutral.primary}`,
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}>
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
