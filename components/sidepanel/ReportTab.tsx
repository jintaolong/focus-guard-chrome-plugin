// FR-102 Tab 4: Report & Account
// Report Download + Analysis History

import { useState, useEffect, useCallback } from "react"
import type { VideoAnalysis, AnalysisHistoryItem } from "~types/analysis"
import { COLORS, getTrustScoreColor } from "~lib/colors"
import { BlurredContent } from "~components/UpgradePrompt"
import { useTheme } from "~components/SidePanel"
import { AuthService } from "~lib/auth"

interface ReportTabProps {
  analysis: VideoAnalysis
  history?: AnalysisHistoryItem[]
  onDownloadReport?: (format: "PDF" | "TXT") => void
  onReAnalyze?: (videoId: string) => void
  onDownloadHistoryReport?: (videoId: string) => void
  onLoadHistoryItem?: (item: AnalysisHistoryItem) => void
  onLoadSnapshot?: (snapshotData: any) => void
}

export const ReportTab = ({
  analysis,
  history = [],
  onDownloadReport,
  onReAnalyze,
  onDownloadHistoryReport,
  onLoadHistoryItem,
  onLoadSnapshot
}: ReportTabProps) => {
  const [selectedFormat, setSelectedFormat] = useState<"PDF" | "TXT">("PDF")
  const [isDownloading, setIsDownloading] = useState(false)
  const { colors: C, mode } = useTheme()
  const isDark = mode === "dark"

  // Snapshot history state
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false)
  const [loadingSnapshotId, setLoadingSnapshotId] = useState<number | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Fetch snapshots for this video
  useEffect(() => {
    const videoId = (analysis as any)?.videoId
    if (!videoId) return

    let cancelled = false
    const fetchSnapshots = async () => {
      setIsLoadingSnapshots(true)
      try {
        const accessToken = await AuthService.ensureValidToken()
        const resp = await chrome.runtime.sendMessage({
          type: "FETCH_SNAPSHOTS_BY_VIDEO",
          payload: {
            video_id: videoId,
            authHeaders: { Authorization: `Bearer ${accessToken}` },
          },
        })
        if (!cancelled && resp?.success && resp.data?.snapshots) {
          setSnapshots(resp.data.snapshots)
        }
      } catch {}
      if (!cancelled) setIsLoadingSnapshots(false)
    }
    fetchSnapshots()
    return () => { cancelled = true }
  }, [(analysis as any)?.videoId])

  const handleSnapshotClick = useCallback(async (shareToken: string, snapshotId: number) => {
    setLoadingSnapshotId(snapshotId)
    try {
      const resp = await chrome.runtime.sendMessage({
        type: "FETCH_REPORT_BY_SHARE_TOKEN",
        payload: { share_token: shareToken },
      })
      if (resp?.success && resp.data) {
        onLoadSnapshot?.(resp.data)
      }
    } catch {}
    setLoadingSnapshotId(null)
  }, [onLoadSnapshot])

  const handleDeleteSnapshot = useCallback(async (snapshotId: number) => {
    setIsDeletingId(snapshotId)
    setDeleteError(null)
    try {
      const accessToken = await AuthService.ensureValidToken()
      const resp = await chrome.runtime.sendMessage({
        type: "DELETE_SNAPSHOT",
        payload: {
          snapshot_id: snapshotId,
          authHeaders: { Authorization: `Bearer ${accessToken}` },
        },
      })
      if (resp?.success) {
        setSnapshots(prev => prev.filter(s => s.snapshot_id !== snapshotId))
      } else {
        setDeleteError(
          resp?.error === "forbidden" || resp?.error?.includes?.("403")
            ? "Not authorized to delete this snapshot."
            : "Failed to delete snapshot. Please try again."
        )
      }
    } catch {
      setDeleteError("Failed to delete snapshot. Please try again.")
    }
    setIsDeletingId(null)
    setConfirmingDeleteId(null)
  }, [])

  const handleDownload = async () => {
    if (!onDownloadReport) return
    setIsDownloading(true)
    try {
      await onDownloadReport(selectedFormat)
    } finally {
      setIsDownloading(false)
    }
  }

  // Check for tier restriction (Report is Pro-only)
  const reportTierRestriction = (analysis as any)?.reportInfo?.tierRestriction
  const currentSnapshotId = Number((analysis as any)?.snapshotId)
  console.log("🎯 ReportTab: received analysis -", { 
    hasReportInfo: !!(analysis as any)?.reportInfo,
    reportTierRestriction,
  })
  
  const content = (
    <div>
      {/* Report Download Section */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "14px",
            fontWeight: "700",
            color: C.ui.text.primary
          }}>
          Download Report
        </h3>

        {/* Format Selector */}
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: "12px",
              fontWeight: "600",
              color: C.ui.text.secondary
            }}>
            Select Format:
          </p>
            <div style={{ display: "flex", gap: "12px" }}>
            {(analysis.reportInfo?.availableFormats || []).map((format: any) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                style={{
                  flex: 1,
                  padding: "8px",
                  backgroundColor:
                    selectedFormat === format ? C.neutral.primary : C.ui.background,
                  color: selectedFormat === format ? "white" : C.ui.text.primary,
                  border: `1.5px solid ${C.neutral.primary}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (selectedFormat !== format) {
                    e.currentTarget.style.backgroundColor = C.neutral.light
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFormat !== format) {
                    e.currentTarget.style.backgroundColor = C.ui.background
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
            padding: "10px",
            backgroundColor: isDownloading ? C.ui.border : C.neutral.primary,
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
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
              e.currentTarget.style.backgroundColor = C.neutral.dark
            }
          }}
          onMouseLeave={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.backgroundColor = C.neutral.primary
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
            margin: "8px 0 0 0",
            fontSize: "11px",
              color: C.ui.text.secondary,
            textAlign: "center"
          }}>
          Analysis performed: {analysis.reportInfo?.analysisDate ? new Date(analysis.reportInfo.analysisDate).toLocaleString() : "Unknown"}
        </p>
      </div>

      {/* Report Snapshots from Backend */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "14px",
            fontWeight: "700",
            color: C.ui.text.primary
          }}>
          Report History
        </h3>

        {isLoadingSnapshots ? (
          <div style={{
            padding: "20px", textAlign: "center",
            backgroundColor: C.ui.surface, border: `1px solid ${C.ui.border}`, borderRadius: "8px",
          }}>
            <div style={{
              width: "20px", height: "20px", margin: "0 auto 8px",
              border: `2px solid ${C.ui.border}`, borderTopColor: C.neutral.primary,
              borderRadius: "50%", animation: "spin 1s linear infinite",
            }} />
            <p style={{ margin: 0, fontSize: "12px", color: C.ui.text.secondary }}>Loading snapshots...</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{
            padding: "16px", textAlign: "center",
            backgroundColor: C.ui.surface, border: `1px solid ${C.ui.border}`, borderRadius: "8px",
          }}>
            <p style={{ margin: 0, fontSize: "12px", color: C.ui.text.secondary }}>No report snapshots available</p>
          </div>
        ) : (
          <>
          <div style={{
            maxHeight: "300px", overflowY: "auto",
            display: "flex", flexDirection: "column", gap: "8px",
          }}>
            {snapshots.map((snap: any) => {
              const isLoading = loadingSnapshotId === snap.snapshot_id
              const isSelected = Number.isFinite(currentSnapshotId) && currentSnapshotId === snap.snapshot_id
              const isDeleting = isDeletingId === snap.snapshot_id
              const isConfirmingDelete = confirmingDeleteId === snap.snapshot_id
              const snapDate = snap.created_at
                ? new Date(snap.created_at).toLocaleString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "Unknown"
              const commentCount = snap.actual_comments_fetched ?? snap.comment_count
              return (
                <div
                  key={snap.snapshot_id}
                  onClick={() => !isLoading && !isConfirmingDelete && snap.share_token && handleSnapshotClick(snap.share_token, snap.snapshot_id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px",
                    backgroundColor: isSelected ? C.neutral.light : C.ui.background,
                    border: `1.5px solid ${isSelected ? C.neutral.primary : C.ui.border}`,
                    borderRadius: "8px",
                    cursor: isLoading ? "wait" : "pointer",
                    opacity: isLoading || isDeleting ? 0.6 : 1,
                    transition: "box-shadow 0.2s, border-color 0.2s, background-color 0.2s",
                    boxShadow: isSelected ? "0 0 0 2px rgba(59,130,246,0.15)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = isSelected
                      ? "0 0 0 2px rgba(59,130,246,0.18), 0 4px 12px rgba(0,0,0,0.08)"
                      : "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = isSelected
                      ? "0 0 0 2px rgba(59,130,246,0.15)"
                      : "none"
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: C.ui.text.primary }}>
                        {snapDate}
                      </span>
                      {isSelected && (
                        <span style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          color: "white",
                          backgroundColor: C.neutral.primary,
                          borderRadius: "999px",
                          padding: "2px 8px",
                        }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {commentCount != null && (
                        <span style={{
                          fontSize: "10px", fontWeight: "600",
                          color: C.neutral.primary,
                        }}>
                          {commentCount} comments
                        </span>
                      )}
                      {snap.query_context && (
                        <span style={{
                          fontSize: "10px", padding: "1px 6px",
                          backgroundColor: C.ui.surface, borderRadius: "4px",
                          color: C.ui.text.secondary, border: `1px solid ${C.ui.border}`,
                        }}>
                          {snap.query_context}
                        </span>
                      )}
                    </div>
                  </div>
                  {isDeleting ? (
                    <div style={{
                      width: "16px", height: "16px",
                      border: `2px solid ${C.ui.border}`, borderTopColor: "#ef4444",
                      borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0,
                    }} />
                  ) : isConfirmingDelete ? (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}>
                      <span style={{ fontSize: "11px", color: C.ui.text.secondary, whiteSpace: "nowrap" }}>Delete?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(snap.snapshot_id) }}
                        style={{
                          fontSize: "11px", fontWeight: "600",
                          padding: "2px 8px", border: "none", borderRadius: "4px",
                          backgroundColor: "#ef4444", color: "white", cursor: "pointer",
                        }}>
                        Yes
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null) }}
                        style={{
                          fontSize: "11px", fontWeight: "600",
                          padding: "2px 8px", border: `1px solid ${C.ui.border}`, borderRadius: "4px",
                          backgroundColor: C.ui.background, color: C.ui.text.secondary, cursor: "pointer",
                        }}>
                        No
                      </button>
                    </div>
                  ) : isLoading ? (
                    <div style={{
                      width: "16px", height: "16px",
                      border: `2px solid ${C.ui.border}`, borderTopColor: C.neutral.primary,
                      borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0,
                    }} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <button
                        title="Delete snapshot"
                        onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(snap.snapshot_id); setDeleteError(null) }}
                        style={{
                          background: "none", border: "none", padding: "2px 4px",
                          cursor: "pointer", fontSize: "13px", color: C.ui.text.tertiary,
                          borderRadius: "4px", lineHeight: 1,
                          opacity: 0.6,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#ef4444" }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.color = C.ui.text.tertiary }}>
                        🗑
                      </button>
                      <span style={{ fontSize: "10px", color: C.ui.text.tertiary }}>→</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {deleteError && (
            <p style={{
              margin: "8px 0 0 0", fontSize: "11px",
              color: "#ef4444", textAlign: "center",
            }}>
              {deleteError}
            </p>
          )}
          </>
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

  // Wrap with tier restriction UI if needed
  if (reportTierRestriction) {
    return (
      <BlurredContent restriction={reportTierRestriction}>
        {content}
      </BlurredContent>
    )
  }

  return <div style={{ padding: "24px" }}>{content}</div>
}
