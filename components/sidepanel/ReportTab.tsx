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
  const executiveSummary = analysis?.executiveSummary || ""
  const keyTakeaways = (analysis?.summary as any)?.key_takeaways || []
  const availableFormats = analysis.reportInfo?.availableFormats || []
  console.log("🎯 ReportTab: received analysis -", { 
    hasReportInfo: !!(analysis as any)?.reportInfo,
    reportTierRestriction,
  })
  
  const content = (
    <div>
      {/* Executive Summary with download buttons tucked top-right */}
      {executiveSummary && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
            <h3 style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: "700",
              color: C.ui.text.primary,
            }}>
              Executive Summary
            </h3>
            {/* Download buttons — compact, top-right */}
            {availableFormats.length > 0 && onDownloadReport && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                {availableFormats.map((format: any) => (
                  <button
                    key={format}
                    onClick={async () => {
                      setSelectedFormat(format)
                      setIsDownloading(true)
                      try { await onDownloadReport(format) } finally { setIsDownloading(false) }
                    }}
                    disabled={isDownloading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px",
                      backgroundColor: C.ui.surface,
                      border: `1px solid ${C.ui.border}`,
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: C.ui.text.secondary,
                      cursor: isDownloading ? "wait" : "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.neutral.primary; e.currentTarget.style.color = C.ui.text.primary }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.ui.border; e.currentTarget.style.color = C.ui.text.secondary }}>
                    📥 {format}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{
            padding: "14px 16px",
            backgroundColor: C.ui.surface,
            border: `1px solid ${C.ui.border}`,
            borderRadius: "10px",
            fontSize: "13px",
            lineHeight: "1.7",
            color: C.ui.text.primary,
          }}>
            {executiveSummary.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : part
            )}
          </div>
          {analysis.reportInfo?.analysisDate && (
            <p style={{
              margin: "6px 0 0",
              fontSize: "10px",
              color: C.ui.text.tertiary,
              textAlign: "right",
            }}>
              {new Date(analysis.reportInfo.analysisDate).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Key Takeaways */}
      {keyTakeaways.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{
            margin: "0 0 8px 0",
            fontSize: "14px",
            fontWeight: "700",
            color: C.ui.text.primary,
          }}>
            Key Takeaways
          </h3>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}>
            {keyTakeaways.map((takeaway: string, i: number) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                padding: "10px 12px",
                backgroundColor: C.ui.surface,
                border: `1px solid ${C.ui.border}`,
                borderRadius: "8px",
                fontSize: "12px",
                lineHeight: "1.5",
                color: C.ui.text.primary,
              }}>
                <span style={{
                  flexShrink: 0,
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "rgba(37,99,235,0.2)" : "#dbeafe",
                  borderRadius: "50%",
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#2563eb",
                }}>
                  {i + 1}
                </span>
                <span>{takeaway}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Snapshots History */}
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
