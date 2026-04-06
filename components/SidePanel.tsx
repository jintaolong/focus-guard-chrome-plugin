// FR-102: Focus Guard Side-Panel Component
// Major UI overhaul: 80% screen width, dark/light mode, web-portal design alignment

import { useState, useEffect, useMemo, createContext, useContext } from "react"
import type { VideoAnalysis, AnalysisHistoryItem } from "~types/analysis"
import { COLORS, DARK_COLORS, type ThemeMode } from "~lib/colors"
import { LayoutGrid, Search, ShieldCheck, SmilePlus, MessageSquare, AlertTriangle, FileText, ExternalLink, Share2, RefreshCw, Moon, Sun, PanelLeft, PanelRight, Columns2, X, Users, Copy, Check, MessageCircle } from "lucide-react"
import { SummaryTab } from "./sidepanel/SummaryTab"
import { KeyInsightsTab } from "./sidepanel/KeyInsightsTab"
import { CommentSentimentTab } from "./sidepanel/CommentSentimentTab"
import { ContentGapsTab } from "./sidepanel/ContentGapsTab"
import { ReportTab } from "./sidepanel/ReportTab"
import { ClaimsTabNew } from "./sidepanel/ClaimsTabNew"
import { SentimentTabNew } from "./sidepanel/SentimentTabNew"
import { InsightsTabNew } from "./sidepanel/InsightsTabNew"
import { GapsTabNew } from "./sidepanel/GapsTabNew"
import { ChannelCredibilitySubTab } from "./sidepanel/ChannelCredibilitySubTab"
import { ChatPanel } from "./sidepanel/ChatPanel"

// ── Theme Context ─────────────────────────────────────────────────────────────
export const ThemeContext = createContext<{ mode: ThemeMode; colors: typeof COLORS }>({
  mode: 'light',
  colors: COLORS,
})
export const useTheme = () => useContext(ThemeContext)

type TabId = "overview" | "claims" | "trust" | "sentiment" | "insights" | "gaps" | "report" | "chat"
type PanelLayout = "center" | "left" | "right"

interface SidePanelProps {
  analysis: VideoAnalysis | null
  isLoading: boolean
  isOpen: boolean
  position?: "left" | "right"
  panelDock?: "left" | "right"
  history?: AnalysisHistoryItem[]
  onClose: () => void
  onDownloadReport?: (format: "PDF" | "TXT") => void
  onReAnalyze?: (videoId: string) => void
  onDownloadHistoryReport?: (videoId: string) => void
  onBotFilterChange?: (enabled: boolean) => void
  onForceRefresh?: () => void
  onLoadHistoryItem?: (item: AnalysisHistoryItem) => void
  progressPercent?: number | null
  progressMessage?: string | null
  userTier?: string
  onLoadSnapshot?: (snapshotData: any) => void
}

export const SidePanel = ({
  analysis,
  isLoading,
  isOpen,
  position = "right",
  panelDock,
  history,
  onClose,
  onDownloadReport,
  onReAnalyze,
  onDownloadHistoryReport,
  onBotFilterChange,
  onForceRefresh,
  onLoadHistoryItem,
  progressPercent,
  progressMessage,
  userTier,
  onLoadSnapshot
}: SidePanelProps) => {
  const dock = panelDock ?? position
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem("cv-theme") as ThemeMode) || "dark" }
    catch { return "dark" }
  })
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(() => {
    try { return (localStorage.getItem("cv-panel-layout") as PanelLayout) || "center" }
    catch { return "center" }
  })

  const C = themeMode === "dark" ? DARK_COLORS : COLORS

  useEffect(() => {
    try { localStorage.setItem("cv-theme", themeMode) } catch {}
  }, [themeMode])

  useEffect(() => {
    try { localStorage.setItem("cv-panel-layout", panelLayout) } catch {}
  }, [panelLayout])

  const isFullyPublic = !!(analysis as any)?.isFullyPublic
  const sentimentData = (analysis as any)?.sentiment
  const viewerInsightsData = (analysis as any)?.viewerInsights
  const hasSentimentDataOrRestriction = Boolean(
    isFullyPublic || sentimentData?.distribution || sentimentData?.tierRestriction
  )
  const hasViewerInsightsDataOrRestriction = Boolean(
    isFullyPublic ||
    (viewerInsightsData && !Array.isArray(viewerInsightsData) && viewerInsightsData.sentimentBreakdown) ||
      viewerInsightsData?.tierRestriction
  )
  const contentGapsData = (analysis as any)?.contentGaps
  const hasContentGapsDataOrRestriction = Boolean(
    isFullyPublic || contentGapsData?.unansweredQuestions || contentGapsData?.tierRestriction
  )

  // ── Report URL builder ──────────────────────────────────────────────────────
  const getReportUrl = () => {
    const portalBase = (process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "https://app.commentverdict.com").replace(/\/+$/, "")
    const shareCode = analysis?.snapshotShareCode
    const snapshotId = analysis?.snapshotId
    const reportId = shareCode ?? (snapshotId != null ? String(snapshotId) : null)
    return reportId ? `${portalBase}/report/${reportId}` : null
  }

  // ── Shared icon-button style ────────────────────────────────────────────────
  const iconBtn: React.CSSProperties = {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.15s",
    flexShrink: 0,
    color: "white",
  }

  // ── Share helpers ───────────────────────────────────────────────────────────
  const verdictEmoji = (v?: string) => {
    switch ((v || "").toUpperCase()) {
      case "LEGIT":       return "✅"
      case "MISLEADING":  return "⚠️"
      case "CLICKBAIT":   return "🚨"
      default:            return "🔍"
    }
  }

  // Lucide icon size for tab bar
  const tabIconSize = 14

  const buildShareText = () => {
    const title   = analysis?.videoTitle || "this video"
    const verdict = analysis?.clickbaitVerdict?.verdict ||
                    (analysis?.summary as any)?.clickbaitVerdict?.label || "?"
    const score   = analysis?.trustScore?.score != null
      ? `${(analysis.trustScore.score as number).toFixed(1)}/10`
      : null
    const emoji   = verdictEmoji(verdict)
    const reportUrl = getReportUrl()
    const url = reportUrl || analysis?.videoUrl || window.location.href
    const scorePart = score ? ` | Trust Score: ${score}` : ""
    const linkLabel = reportUrl ? "\nFull report ↗ " + reportUrl : ""
    return {
      text: `Just analyzed "${title}" using Comment Verdict 🔍\nVerdict: ${emoji} ${verdict}${scorePart}${linkLabel}\n#CommentVerdict`,
      url,
    }
  }

  const shareOnPlatform = (platform: "twitter" | "linkedin" | "reddit" | "copy") => {
    const { text, url } = buildShareText()
    const encoded = encodeURIComponent
    if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encoded(text)}&url=${encoded(url)}`, "_blank")
    } else if (platform === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded(url)}`, "_blank")
    } else if (platform === "reddit") {
      const title = analysis?.videoTitle || "Comment Verdict analysis"
      window.open(`https://reddit.com/submit?url=${encoded(url)}&title=${encoded(title)}`, "_blank")
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      })
    }
    if (platform !== "copy") setIsShareOpen(false)
  }

  // ── Verdict color map for hero gauge ─────────────────────────────────────
  const stampColorMap: Record<string, { bg: string; text: string; border: string; arc: string }> = {
    LEGIT:      { bg: '#D1FAE5', text: '#065F46', border: '#10B981', arc: '#10B981' },
    CLICKBAIT:  { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444', arc: '#EF4444' },
    DANGEROUS:  { bg: '#FEE2E2', text: '#7F1D1D', border: '#991B1B', arc: '#991B1B' },
    DISPUTED:   { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', arc: '#F59E0B' },
    MISLEADING: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', arc: '#F59E0B' },
    MIXED:      { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', arc: '#3B82F6' },
  }

  const verdictRaw = analysis?.clickbaitVerdict?.verdict
    || (analysis?.summary as any)?.clickbaitVerdict?.label
    || ""
  const verdictUpper = verdictRaw.toUpperCase()
  const verdictSC = stampColorMap[verdictUpper] ?? stampColorMap.MIXED
  const confidenceScore = (analysis?.summary as any)?.clickbaitVerdict?.confidence
    ?? analysis?.trustScore?.score
    ?? 0

  // ── Sentiment percentages for hero bar ──────────────────────────────────
  const sentimentPcts = useMemo(() => {
    const dist = (analysis as any)?.sentiment?.distribution
    if (!dist) return null
    // dist.positive/neutral/negative are raw counts
    const pos = dist.positive || 0
    const neu = dist.neutral || 0
    const neg = dist.negative || 0
    const mix = dist.mixed || 0
    const total = pos + neu + neg + mix
    if (total === 0) return null
    // Largest-remainder method to guarantee percentages sum to 100
    const rawPos = (pos / total) * 100
    const rawNeu = (neu / total) * 100
    const rawNeg = (neg / total) * 100
    const rawMix = (mix / total) * 100
    let pPos = Math.floor(rawPos)
    let pNeu = Math.floor(rawNeu)
    let pNeg = Math.floor(rawNeg)
    let pMix = Math.floor(rawMix)
    const rem = 100 - pPos - pNeu - pNeg - pMix
    const fracs = [
      { key: 'pos', frac: rawPos - pPos },
      { key: 'neu', frac: rawNeu - pNeu },
      { key: 'neg', frac: rawNeg - pNeg },
      { key: 'mix', frac: rawMix - pMix },
    ].sort((a, b) => b.frac - a.frac)
    for (let i = 0; i < rem; i++) {
      const k = fracs[i].key
      if (k === 'pos') pPos++
      else if (k === 'neu') pNeu++
      else if (k === 'neg') pNeg++
      else pMix++
    }
    return { positive: pPos, neutral: pNeu, negative: pNeg, mixed: pMix }
  }, [analysis])

  const likelyChannelId = (name?: string | null): boolean =>
    typeof name === "string" && /^UC[a-zA-Z0-9_-]{20,}$/.test(name.trim())

  const headerChannelName = (() => {
    const names = [analysis?.channelName, analysis?.channelTrust?.channel_name]
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter(Boolean)
    const readable = names.find((n) => !likelyChannelId(n))
    return readable || names[0] || null
  })()

  // ── Tab definitions with counts ─────────────────────────────────────────
  const claimsCount = (analysis?.summary as any)?.clickbaitVerdict?.claims?.length ?? 0
  const gapsCount = analysis?.contentGaps?.unansweredQuestions?.length ?? 0
  const insightsCount = analysis?.topicClustersData?.clusters?.length ?? 0
  const isHydratingSecondary = Boolean((analysis as any)?.isHydratingSecondary)
  const hasTrustData = Boolean(
    (analysis?.summary as any)?.channelTrust ||
    (analysis?.summary as any)?.channelCredibility ||
    analysis?.channelTrust ||
    analysis?.channelCredibility
  )
  console.log("🎯 SidePanel: analysis.isFullyPublic =", (analysis as any)?.isFullyPublic, "→ isFullyPublic =", isFullyPublic)

  const sentimentIsLocked = !isFullyPublic && !!(analysis as any)?.sentiment?.tierRestriction
  const insightsIsLocked = !isFullyPublic && !!(analysis as any)?.viewerInsights?.tierRestriction
  const gapsIsLocked = !isFullyPublic && !!(analysis as any)?.contentGaps?.tierRestriction
  const reportIsLocked = !isFullyPublic && !!(analysis as any)?.reportInfo?.tierRestriction
  console.log("🎯 Lock status:", { sentimentIsLocked, insightsIsLocked, gapsIsLocked, reportIsLocked })

  const sentimentRequiredTier = sentimentIsLocked ? (analysis as any)?.sentiment?.tierRestriction?.required_tier as "starter" | "pro" | undefined : undefined
  const insightsRequiredTier = insightsIsLocked ? (analysis as any)?.viewerInsights?.tierRestriction?.required_tier as "starter" | "pro" | undefined : undefined
  const gapsRequiredTier = gapsIsLocked ? (analysis as any)?.contentGaps?.tierRestriction?.required_tier as "starter" | "pro" | undefined : undefined
  const reportRequiredTier = reportIsLocked ? (analysis as any)?.reportInfo?.tierRestriction?.required_tier as "starter" | "pro" | undefined : undefined

  // When the snapshot is fully public, strip all tier restrictions from the analysis
  // before passing it to child components — mirrors the web portal canView(isFullyPublic) pattern.
  const displayAnalysis = useMemo((): VideoAnalysis | null => {
    if (!analysis || !isFullyPublic) {
      console.log("🎯 displayAnalysis: returning original analysis (isFullyPublic=false)")
      return analysis
    }
    const stripped = {
      ...analysis,
      sentiment: analysis.sentiment ? { ...analysis.sentiment, tierRestriction: undefined } : analysis.sentiment,
      contentGaps: analysis.contentGaps ? { ...analysis.contentGaps, tierRestriction: undefined } : analysis.contentGaps,
      viewerInsights: (analysis.viewerInsights && typeof analysis.viewerInsights === 'object' && !Array.isArray(analysis.viewerInsights))
        ? { ...(analysis.viewerInsights as any), tierRestriction: undefined }
        : analysis.viewerInsights,
      reportInfo: analysis.reportInfo ? { ...analysis.reportInfo, tierRestriction: undefined } : analysis.reportInfo,
    }
    console.log("🎯 displayAnalysis: stripped restrictions -", { 
      sentimentHasRestriction: !!stripped.sentiment?.tierRestriction,
      insightsHasRestriction: !!(stripped.viewerInsights as any)?.tierRestriction,
      gapsHasRestriction: !!stripped.contentGaps?.tierRestriction,
      reportHasRestriction: !!stripped.reportInfo?.tierRestriction,
    })
    return stripped
  }, [analysis, isFullyPublic])

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number; locked?: boolean; requiredTier?: "starter" | "pro" }[] = [
    { id: "overview",   label: "Overview",    icon: <LayoutGrid size={tabIconSize} /> },
    { id: "claims",     label: "Claims",      icon: <Search size={tabIconSize} />, count: claimsCount || undefined },
    { id: "trust",      label: "Trust",       icon: <ShieldCheck size={tabIconSize} /> },
    { id: "sentiment",  label: "Sentiment",   icon: <SmilePlus size={tabIconSize} />, locked: sentimentIsLocked, requiredTier: sentimentRequiredTier },
    { id: "insights",   label: "Insights",    icon: <MessageSquare size={tabIconSize} />, count: insightsCount || undefined, locked: insightsIsLocked, requiredTier: insightsRequiredTier },
    { id: "gaps",       label: "Gaps",        icon: <AlertTriangle size={tabIconSize} />, count: gapsCount || undefined, locked: gapsIsLocked, requiredTier: gapsRequiredTier },
    { id: "report",     label: "Report",      icon: <FileText size={tabIconSize} />, locked: reportIsLocked, requiredTier: reportRequiredTier },
    { id: "chat",       label: "Chat",        icon: <MessageCircle size={tabIconSize} />, locked: userTier !== undefined && userTier !== "pro", requiredTier: userTier !== undefined && userTier !== "pro" ? "pro" : undefined }
  ]

  if (!isOpen) return null

  // ── Panel positioning ─────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      position: "fixed",
      top: 0,
      height: "100vh",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      backgroundColor: C.ui.background,
      color: C.ui.text.primary,
    }

    if (panelLayout === "center") {
      return {
        ...base,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(80vw, 1200px)",
        borderRadius: "0 0 16px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }
    }

    // Docked left or right
    const side = panelLayout
    return {
      ...base,
      [side]: 0,
      width: "min(80vw, 1200px)",
      boxShadow: side === "right" ? "-4px 0 24px rgba(0,0,0,0.15)" : "4px 0 24px rgba(0,0,0,0.15)",
    }
  })()

  const reportUrl = getReportUrl()

  return (
    <ThemeContext.Provider value={{ mode: themeMode, colors: C as typeof COLORS }}>
      {/* Backdrop overlay for center layout */}
      {panelLayout === "center" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 9998,
            transition: "opacity 0.3s",
          }}
          onClick={onClose}
        />
      )}

      <div style={panelStyle}>
        {/* ── Header (dark slate, matching web-portal) ────────────────────── */}
        <div
          style={{
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#0f172a",
            color: "white",
            flexShrink: 0,
          }}>
          {/* Left: Logo + title */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              backgroundColor: "#2563eb",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <img
                src={chrome.runtime.getURL("assets/stroke.png")}
                alt="CV"
                style={{ width: "20px", height: "20px" }}
              />
            </div>
            <span style={{ fontWeight: "800", fontSize: "15px", letterSpacing: "-0.01em" }}>
              Comment Verdict
            </span>
          </div>

          {/* Right: Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Open web report */}
            {analysis && reportUrl && (
              <button
                style={iconBtn}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)" }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
                onClick={() => window.open(reportUrl, "_blank")}
                title="Open full report in browser">
                <ExternalLink size={14} />
              </button>
            )}

            {/* Share */}
            {analysis && (
              <div style={{ position: "relative" }}>
                <button
                  style={{
                    ...iconBtn,
                    backgroundColor: isShareOpen ? "rgba(255,255,255,0.15)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!isShareOpen) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)" }}
                  onMouseLeave={(e) => { if (!isShareOpen) e.currentTarget.style.backgroundColor = "transparent" }}
                  onClick={() => setIsShareOpen(!isShareOpen)}
                  title="Share analysis">
                  <Share2 size={14} />
                </button>

                {isShareOpen && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 10000 }}
                      onClick={() => setIsShareOpen(false)}
                    />
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      zIndex: 10001,
                      backgroundColor: themeMode === "dark" ? "#1e293b" : "white",
                      border: `1px solid ${C.ui.border}`,
                      borderRadius: "12px",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
                      minWidth: "180px",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        padding: "10px 14px 8px",
                        fontSize: "10px",
                        fontWeight: "700",
                        color: C.ui.text.secondary,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${C.ui.border}`,
                      }}>Share analysis</div>
                      {([
                        { id: "twitter" as const,  label: "Post on X",         icon: "𝕏" },
                        { id: "linkedin" as const, label: "Share on LinkedIn", icon: "in" },
                        { id: "reddit" as const,   label: "Post to Reddit",   icon: "r/" },
                      ]).map(({ id, label, icon }) => (
                        <button
                          key={id}
                          onClick={() => shareOnPlatform(id)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            width: "100%", padding: "9px 14px",
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: "13px", color: C.ui.text.primary, textAlign: "left",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = C.ui.surface }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none" }}>
                          <span style={{
                            width: "22px", height: "22px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: "700",
                            background: C.ui.surface, borderRadius: "4px", flexShrink: 0,
                          }}>{icon}</span>
                          {label}
                        </button>
                      ))}
                      <div style={{ borderTop: `1px solid ${C.ui.border}` }}>
                        <button
                          onClick={() => shareOnPlatform("copy")}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            width: "100%", padding: "9px 14px",
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: "13px",
                            color: shareCopied ? C.high.text : C.ui.text.primary,
                            textAlign: "left",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = C.ui.surface }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none" }}>
                          <span style={{
                            width: "22px", height: "22px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "14px",
                            background: shareCopied ? C.high.light : C.ui.surface,
                            borderRadius: "4px", flexShrink: 0,
                          }}>{shareCopied ? <Check size={12} /> : <Copy size={12} />}</span>
                          {shareCopied ? "Copied!" : "Copy link"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Force Refresh */}
            {analysis && onForceRefresh && (
              <button
                style={iconBtn}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)" }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
                onClick={onForceRefresh}
                title="Force refresh analysis">
                <RefreshCw size={14} />
              </button>
            )}

            {/* Divider */}
            <div style={{ width: "1px", height: "20px", backgroundColor: "rgba(255,255,255,0.2)", margin: "0 4px", flexShrink: 0 }} />

            {/* Theme toggle */}
            <button
              style={iconBtn}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)" }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
              onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
              title={`Switch to ${themeMode === "light" ? "dark" : "light"} mode`}>
              {themeMode === "light" ? <Moon size={14} /> : <Sun size={14} />}
            </button>

            {/* Layout toggle (center / dock) */}
            <button
              style={iconBtn}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)" }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
              onClick={() => {
                const cycle: PanelLayout[] = ["center", "right", "left"]
                const idx = cycle.indexOf(panelLayout)
                setPanelLayout(cycle[(idx + 1) % cycle.length])
              }}
              title={`Layout: ${panelLayout} (click to change)`}>
              {panelLayout === "center" ? <Columns2 size={14} /> : panelLayout === "right" ? <PanelRight size={14} /> : <PanelLeft size={14} />}
            </button>

            {/* Close */}
            <button
              style={{
                ...iconBtn,
                width: "28px",
                height: "28px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.3)" }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
              onClick={onClose}
              title="Close panel">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Hero section (verdict gauge + sentiment bar, web-portal style) ── */}
        {analysis && verdictRaw && (
          <div style={{
            padding: "16px 24px 12px",
            backgroundColor: themeMode === "dark" ? "#1e293b" : "white",
            borderBottom: `1px solid ${C.ui.border}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              {/* Thumbnail */}
              {analysis.videoThumbnail && (
                <img
                  src={analysis.videoThumbnail}
                  alt="Video"
                  style={{ width: "120px", height: "72px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }}
                />
              )}
              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{
                  margin: 0, fontSize: "16px", fontWeight: "900",
                  color: C.ui.text.primary, lineHeight: "1.3",
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}>
                  {analysis.videoTitle || "Untitled Video"}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", fontSize: "11px", color: C.ui.text.secondary, flexWrap: "wrap" }}>
                  {headerChannelName && (
                    <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <Users size={11} /> {headerChannelName}
                    </span>
                  )}
                  {analysis.actualCommentsFetched && (
                    <span>{analysis.actualCommentsFetched.toLocaleString()} comments analyzed</span>
                  )}
                </div>
              </div>
              {/* Verdict gauge circle */}
              <div style={{ flexShrink: 0, width: "120px", height: "120px", position: "relative", transform: "rotate(-8deg)" }}>
                <svg width="120" height="120" viewBox="0 0 130 130">
                  <circle cx="65" cy="65" r={52} fill={verdictSC.bg} stroke="#e2e8f0" strokeWidth="8" />
                  <circle cx="65" cy="65" r={52} fill="none" stroke={verdictSC.arc} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(confidenceScore / 100) * 2 * Math.PI * 52} ${(1 - confidenceScore / 100) * 2 * Math.PI * 52}`}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "65px 65px", transition: "stroke-dasharray 0.8s ease" }} />
                </svg>
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  transform: "rotate(8deg)",
                }}>
                  <span style={{
                    fontWeight: "900", letterSpacing: "0.05em", textAlign: "center", lineHeight: 1,
                    color: verdictSC.text,
                    fontSize: `${verdictUpper.length > 7 ? 12 : verdictUpper.length > 5 ? 14 : 16}px`,
                  }}>
                    {verdictUpper}
                  </span>
                  <span style={{ fontSize: "9px", fontWeight: "700", marginTop: "3px", color: verdictSC.text, opacity: 0.7 }}>
                    {confidenceScore}% confidence
                  </span>
                </div>
              </div>
            </div>

            {/* Sentiment bar under hero */}
            {sentimentPcts && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", color: C.ui.text.tertiary, textTransform: "uppercase", flexShrink: 0 }}>Sentiment</span>
                <div style={{ flex: 1, display: "flex", height: "8px", borderRadius: "9999px", overflow: "hidden", backgroundColor: themeMode === "dark" ? "#334155" : "#f1f5f9", minWidth: "100px" }}>
                  <div style={{ width: `${sentimentPcts.positive}%`, backgroundColor: "#10b981", transition: "width 0.5s" }} />
                  <div style={{ width: `${sentimentPcts.neutral}%`, backgroundColor: "#94a3b8", transition: "width 0.5s" }} />
                  <div style={{ width: `${sentimentPcts.negative}%`, backgroundColor: "#ef4444", transition: "width 0.5s" }} />
                  {sentimentPcts.mixed > 0 && <div style={{ width: `${sentimentPcts.mixed}%`, backgroundColor: "#f59e0b", transition: "width 0.5s" }} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: C.ui.text.tertiary, flexShrink: 0, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }} />{sentimentPcts.positive}%</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />{sentimentPcts.neutral}%</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />{sentimentPcts.negative}%</span>
                  {sentimentPcts.mixed > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#f59e0b", display: "inline-block" }} />{sentimentPcts.mixed}%</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Bar (sticky, web-portal style) ─────────────────────────── */}
        <div style={{
          display: "flex",
          gap: "4px",
          padding: "6px 16px",
          minHeight: "44px",
          backgroundColor: themeMode === "dark" ? "#1e293b" : "white",
          borderBottom: `1px solid ${C.ui.border}`,
          overflowX: "auto",
          flexShrink: 0,
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { if (!tab.locked) setActiveTab(tab.id) }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                flexShrink: 0,
                backgroundColor: activeTab === tab.id ? "#2563eb" : "transparent",
                color: activeTab === tab.id ? "white" : tab.locked ? C.ui.text.tertiary : C.ui.text.secondary,
                cursor: tab.locked ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id && !tab.locked) {
                  e.currentTarget.style.backgroundColor = C.ui.hover
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.backgroundColor = "transparent"
                }
              }}>
              <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>
              {tab.label}
              {tab.locked && (() => {
                const isStarter = tab.requiredTier === "starter"
                const label = isStarter ? "STARTER" : "PRO"
                return (
                  <span style={{
                    padding: "1px 5px", borderRadius: "4px", fontSize: "10px", fontWeight: "700",
                    backgroundColor: activeTab === tab.id ? "rgba(255,255,255,0.25)" : (themeMode === "dark"
                      ? (isStarter ? "rgba(234,179,8,0.2)" : "rgba(59,130,246,0.2)")
                      : (isStarter ? "#fef9c3" : "#dbeafe")),
                    color: activeTab === tab.id ? "white" : (themeMode === "dark"
                      ? (isStarter ? "#fcd34d" : "#93c5fd")
                      : (isStarter ? "#92400e" : "#1d4ed8")),
                  }}>{label}</span>
                )
              })()}
              {tab.count !== undefined && (
                <span style={{
                  padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700",
                  backgroundColor: activeTab === tab.id ? "rgba(255,255,255,0.2)" : (themeMode === "dark" ? "rgba(255,255,255,0.1)" : "#e2e8f0"),
                  color: activeTab === tab.id ? "white" : (themeMode === "dark" ? "#94a3b8" : "#475569"),
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: C.ui.background,
          }}>
          {isLoading && !analysis ? (
            // ── Full loading screen for fresh (first-time) analysis ──
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px",
                margin: "0 auto 20px",
                border: `4px solid ${C.ui.border}`,
                borderTopColor: "#2563eb",
                borderRadius: "50%",
                animation: "cv-spin 1s linear infinite"
              }} />
              <p style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: C.ui.text.primary }}>
                Analyzing Video...
              </p>
              {progressPercent != null && (
                <p style={{ margin: "10px 0 0", fontSize: "22px", fontWeight: "800", color: "#2563eb" }}>
                  {progressPercent}%
                </p>
              )}
              <p style={{ margin: "10px 0 0", fontSize: "14px", color: C.ui.text.secondary }}>
                {progressMessage || "This may take 10-20 seconds"}
              </p>
              <style>{`@keyframes cv-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              {/* ── Inline refresh progress banner (force-refresh while panel is open) ── */}
              {isLoading && analysis && (
                <div style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  backgroundColor: themeMode === "dark" ? "#1e3a5f" : "#dbeafe",
                  borderBottom: `1px solid ${themeMode === "dark" ? "#2563eb55" : "#93c5fd"}`,
                  padding: "10px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}>
                  <div style={{
                    width: "16px", height: "16px", flexShrink: 0,
                    border: "2px solid rgba(37,99,235,0.3)",
                    borderTopColor: "#2563eb",
                    borderRadius: "50%",
                    animation: "cv-spin 0.8s linear infinite",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: themeMode === "dark" ? "#93c5fd" : "#1d4ed8" }}>
                        {progressMessage || "Re-analyzing video..."}
                      </span>
                      {progressPercent != null && (
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#2563eb" }}>
                          {progressPercent}%
                        </span>
                      )}
                    </div>
                    <div style={{
                      width: "100%", height: "4px", borderRadius: "2px",
                      backgroundColor: themeMode === "dark" ? "rgba(37,99,235,0.2)" : "#bfdbfe",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: "2px",
                        backgroundColor: "#2563eb",
                        width: progressPercent != null ? `${progressPercent}%` : "30%",
                        transition: "width 0.4s ease",
                        ...(progressPercent == null ? {
                          animation: "cv-indeterminate 1.4s ease-in-out infinite",
                        } : {}),
                      }} />
                    </div>
                  </div>
                  <style>{`
                    @keyframes cv-spin { to { transform: rotate(360deg); } }
                    @keyframes cv-indeterminate {
                      0% { transform: translateX(-100%); width: 40%; }
                      50% { transform: translateX(150%); width: 40%; }
                      100% { transform: translateX(150%); width: 40%; }
                    }
                  `}</style>
                </div>
              )}
              {!analysis ? (
                <div style={{ padding: "64px 24px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: C.ui.text.secondary }}>
                    No analysis data available
                  </p>
                </div>
              ) : (
                <div style={{ maxWidth: "900px", margin: "0 auto" }}>
              {activeTab === "overview" && <SummaryTab analysis={analysis} panelDock={dock} />}
              {activeTab === "claims" && (
                isHydratingSecondary && claimsCount === 0 ? (
                  <LoadingPlaceholder label="Loading claims analysis..." colors={C} />
                ) : (
                  <ClaimsTabNew analysis={analysis} panelDock={dock} />
                )
              )}
              {activeTab === "trust" && (
                (() => {
                  const summary = analysis.summary || {} as any
                  const channelTrust = summary.channelTrust || analysis.channelTrust
                  const channelCredibility = summary.channelCredibility || analysis.channelCredibility || null
                  const hasNewFormat = channelTrust && channelTrust.metrics
                  const displayData = hasNewFormat ? channelTrust : channelCredibility
                  const trustScore = hasNewFormat ? channelTrust.trust_score : (channelCredibility?.score !== undefined ? channelCredibility.score : (summary.trustScore ?? analysis.trustScore?.score ?? 0))
                  const trustFactors = hasNewFormat ? [] : (channelCredibility?.factors || [])
                  if (isHydratingSecondary && !hasTrustData) {
                    return <LoadingPlaceholder label="Loading trust analysis..." colors={C} />
                  }
                  return displayData ? (
                    <div style={{ padding: "24px" }}>
                      <ChannelCredibilitySubTab
                        channelCredibility={displayData}
                        credibilityScore={trustScore}
                        credibilityFactors={trustFactors}
                      />
                    </div>
                  ) : (
                    <LoadingPlaceholder label="No channel trust data available" colors={C} />
                  )
                })()
              )}
              {activeTab === "sentiment" && (
                hasSentimentDataOrRestriction ? (
                  <SentimentTabNew analysis={displayAnalysis!} panelDock={dock} />
                ) : isHydratingSecondary ? (
                  <LoadingPlaceholder label="Loading sentiment analysis..." colors={C} />
                ) : (
                  <LoadingPlaceholder label="Sentiment analysis not yet available" colors={C} />
                )
              )}
              {activeTab === "insights" && (
                hasViewerInsightsDataOrRestriction ? (
                  <InsightsTabNew analysis={displayAnalysis!} panelDock={dock} />
                ) : isHydratingSecondary ? (
                  <LoadingPlaceholder label="Loading viewer insights..." colors={C} />
                ) : (
                  <LoadingPlaceholder label="Viewer insights not yet available" colors={C} />
                )
              )}
              {activeTab === "gaps" && (
                hasContentGapsDataOrRestriction ? (
                  <GapsTabNew analysis={displayAnalysis!} panelDock={dock} />
                ) : isHydratingSecondary ? (
                  <LoadingPlaceholder label="Loading content gaps..." colors={C} />
                ) : (
                  <LoadingPlaceholder label="Content gaps not yet available" colors={C} />
                )
              )}
              {activeTab === "report" && (
                <ReportTab
                  analysis={displayAnalysis!}
                  history={history}
                  onDownloadReport={onDownloadReport}
                  onReAnalyze={onReAnalyze}
                  onDownloadHistoryReport={onDownloadHistoryReport}
                  onLoadHistoryItem={onLoadHistoryItem}
                  onLoadSnapshot={onLoadSnapshot}
                />
              )}
              {activeTab === "chat" && (
                <div style={{ height: "calc(100vh - 320px)", minHeight: "300px" }}>
                  <ChatPanel
                    videoId={analysis?.videoId ?? null}
                    analysis={analysis ?? null}
                    userTier={userTier}
                    sessionScopeId={analysis?.snapshotShareCode ?? (analysis?.snapshotId != null ? String(analysis.snapshotId) : null)}
                  />
                </div>
              )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {analysis && (
          <div style={{
            padding: "8px 16px",
            borderTop: `1px solid ${C.ui.border}`,
            backgroundColor: themeMode === "dark" ? "#1e293b" : C.ui.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            fontSize: "11px",
            color: C.ui.text.tertiary,
          }}>
            <span>
              {analysis.actualCommentsFetched
                ? `${analysis.actualCommentsFetched} comments analyzed`
                : "Analysis complete"}
            </span>
            {reportUrl && (
              <button
                onClick={() => window.open(reportUrl, "_blank")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline" }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none" }}>
                Open Web Report ↗
              </button>
            )}
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  )
}

// ── Reusable loading placeholder ────────────────────────────────────────────
const LoadingPlaceholder = ({ label, colors }: { label: string; colors: typeof COLORS | typeof DARK_COLORS }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "64px 24px", color: colors.ui.text.secondary,
  }}>
    <div style={{
      fontSize: "32px", marginBottom: "16px",
      animation: "cv-spin 1s linear infinite",
    }}>⏳</div>
    <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>{label}</p>
    <style>{`@keyframes cv-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)
