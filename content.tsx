import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

import { ResultsList } from "~components/ResultsList"
import { SearchInterface } from "~components/SearchInterface"
import { ToggleButton } from "~components/ToggleButton"
import { SidePanel } from "~components/SidePanel"
import { PreWatchPopover } from "~components/PreWatchPopover"
import { FocusGuardAPI } from "~lib/api"
import { AuthService } from "~lib/auth"
import { SubscriptionService } from "~lib/subscription"
import { getRandomMockAnalysis } from "~lib/mockData"
import type { VideoResult, UserStats } from "~types"
import type {
  VideoAnalysis,
  VideoAnalysisStatus,
  AnalysisHistoryItem
} from "~types/analysis"
import type { FocusGuardSettings } from "~types/popup"

// Configure content-script matches. Use a static literal so Plasmo can
// generate a valid manifest. During development we accept broader matches
// so the content script can be debugged across YouTube pages. Narrow this
// before packaging for production if desired.
export const config: PlasmoCSConfig = {
  matches: [
    "https://*.youtube.com/*", 
    "https://youtube.com/*", 
    "https://youtu.be/*"],
  all_frames: false
}

// Helper to extract video ID from YouTube URL
function getVideoIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    
    // Standard watch page: /watch?v={id}
    const urlParams = new URLSearchParams(urlObj.search)
    const vParam = urlParams.get("v")
    if (vParam) return vParam
    
    // YouTube Shorts: /shorts/{id}
    const pathMatch = urlObj.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/)
    if (pathMatch) return pathMatch[1]
    
    return null
  } catch (e) {
    return null
  }
}

// Helper to check if we're on a watch page or shorts page
function isWatchPage(): boolean {
  const pathname = window.location.pathname
  // Check for standard watch page
  if (pathname === "/watch" && !!getVideoIdFromUrl(window.location.href)) {
    return true
  }
  // Check for YouTube Shorts
  if (pathname.startsWith("/shorts/") && !!getVideoIdFromUrl(window.location.href)) {
    return true
  }
  return false
}

// Debug mode: enable extended injection on any YouTube page when set.
// Read debug flag from environment at build time (set by `dev:debug` script).
// Use a direct `process.env.FOCUS_GUARD_DEBUG` access so the bundler can
// statically replace the value during the build (avoid optional chaining).
const BUILD_DEBUG = (process.env.FOCUS_GUARD_DEBUG === "1" || process.env.FOCUS_GUARD_DEBUG === "true")

// Runtime debug fallback: allow enabling debug via URL param or
// `localStorage.focusGuard.debug = '1'` so you can toggle on-the-fly
// without restarting the dev server. Effective debug is true if either
// build-time or runtime toggles are enabled.
function runtimeDebugEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get("focusGuardDebug") === "1") return true
    const byStorage = localStorage.getItem("focusGuard.debug")
    if (byStorage === "1") return true
  } catch (e) {
    // If access to search/localStorage is blocked, silently ignore
  }
  return false
}

const RUNTIME_DEBUG = runtimeDebugEnabled()
const DEBUG = BUILD_DEBUG || RUNTIME_DEBUG

function isYouTubeDomain(): boolean {
  const host = window.location.hostname || ""
  return host.endsWith("youtube.com") || host === "youtu.be"
}

const ContentScript = () => {
  // Original feed replacement state
  const [results, setResults] = useState<VideoResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isYouTubeHome, setIsYouTubeHome] = useState(false)
  const [settings, setSettings] = useState<FocusGuardSettings | null>(null)

  // FR-102 & FR-103: Watch page analysis state
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const currentVideoIdRef = useRef<string | null>(null)
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<VideoAnalysisStatus | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisState, setAnalysisState] = useState<"idle" | "analyzing" | "complete">("idle")
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [panelDock, setPanelDock] = useState<"left" | "right">(() => {
    try {
      const v = localStorage.getItem("focus-guard-toggle-dock")
      return v === "left" ? "left" : "right"
    } catch (e) {
      return "right"
    }
  })
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([])
  const [onWatchPage, setOnWatchPage] = useState(false)
  const [showPreWatchPopover, setShowPreWatchPopover] = useState(false)
  const [preWatchDismissed, setPreWatchDismissed] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isCached, setIsCached] = useState<boolean | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isCheckingCache, setIsCheckingCache] = useState(false)

  useEffect(() => {
    // Check if we're on YouTube home page or watch page
    console.log("Focus Guard content script loaded");
    // Print build-time debug flag so we can confirm whether the bundle
    // was built with `FOCUS_GUARD_DEBUG=1`.
    console.log("Focus Guard BUILD_DEBUG=", BUILD_DEBUG)
    console.log("Focus Guard RUNTIME_DEBUG=", RUNTIME_DEBUG, "DEBUG=", DEBUG)
    
    // Load user stats and analysis history
    loadUserStats()
    loadAnalysisHistory()
    
    const checkPageType = () => {
      const isHome =
        window.location.pathname === "/" ||
        window.location.pathname === "/feed/subscriptions" ||
        window.location.pathname === "/feed/trending"

      // Respect debug mode: if enabled via build-time flag, runtime localStorage,
      // or URL param, treat any YouTube domain page as a watch page so the UI can
      // be inspected on non-watch paths during development.
      const debug = DEBUG && isYouTubeDomain()
      // When debug is enabled, treat YouTube domain pages (including Home)
      // as watch pages so the UI can be inspected. This makes it easy to
      // view chips and the side panel on the Home feed during development.
      const isWatch = isWatchPage() || debug || (DEBUG && isHome)

      setIsYouTubeHome(isHome)
      setOnWatchPage(isWatch)
      console.log("Focus Guard checkPageType: isHome=", isHome, "isWatch=", isWatch, "debug=", debug, "href=", window.location.href)

      // FR-202: Auto-activate analysis on watch page
      if (isWatch) {
        const videoId = getVideoIdFromUrl(window.location.href)
        console.log("Focus Guard: detected videoId=", videoId, "currentVideoIdRef=", currentVideoIdRef.current)
        if (videoId && videoId !== currentVideoIdRef.current) {
          console.log("Focus Guard: NEW VIDEO detected, resetting state")
          currentVideoIdRef.current = videoId
          setCurrentVideoId(videoId)
          // Don't auto-analyze; wait for user to click the button
          setAnalysisState("idle")
          setVideoAnalysis(null)
          setAnalysisStatus(null)
          setAnalysisError(null)
          setIsCached(null)
          setCurrentJobId(null)
          // A new page is assumed to be unanalyzed for development. Reset
          // the pre-watch dismissed flag so the popover appears after
          // analysis completes on this new page.
          setPreWatchDismissed(false)
          setShowPreWatchPopover(false)
          // Check cache & prefetch full analysis asynchronously
          try {
            checkCacheAndPrefetch(videoId)
          } catch (e) {
            // ignore
          }
        } else if (DEBUG && !videoId) {
          // In debug mode without videoId, start in idle state
          setAnalysisState("idle")
          setVideoAnalysis(null)
          setAnalysisStatus(null)
          setAnalysisError(null)
          setIsCached(null)
          setCurrentJobId(null)
        }
      } else {
        currentVideoIdRef.current = null
        setCurrentVideoId(null)
        setVideoAnalysis(null)
        setAnalysisStatus(null)
        setAnalysisState("idle")
        setAnalysisError(null)
        setIsCached(null)
        setCurrentJobId(null)
        setIsSidePanelOpen(false)
        setShowPreWatchPopover(false)
        setPreWatchDismissed(false)
      }
    }

    checkPageType()

    // Listen for URL changes (YouTube is a SPA). Wrap history methods and
    // emit a `locationchange` event so we can react to navigations performed
    // via `pushState`/`replaceState` as well as browser back/forward.
    const onLocationChange = () => {
      checkPageType()
    }

    const originalPush = history.pushState
    const originalReplace = history.replaceState
    const popstateHandler = () => window.dispatchEvent(new Event("locationchange"))

    history.pushState = function (...args: any[]) {
      const result = originalPush.apply(this, args as any)
      window.dispatchEvent(new Event("locationchange"))
      return result
    }

    history.replaceState = function (...args: any[]) {
      const result = originalReplace.apply(this, args as any)
      window.dispatchEvent(new Event("locationchange"))
      return result
    }

    window.addEventListener("popstate", popstateHandler)
    window.addEventListener("locationchange", onLocationChange)

    // YouTube sometimes navigates without triggering history events (clicking
    // video thumbnails, etc). Use a MutationObserver to detect URL changes
    // via DOM updates and check periodically.
    const urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href
      const currentVidId = getVideoIdFromUrl(currentUrl)
      if (currentVidId && currentVidId !== currentVideoIdRef.current) {
        console.log("Focus Guard: URL polling detected new video")
        checkPageType()
      }
    }, 500)

    // Optionally load user data for richer UI during development / debug
    loadUserStats()
    loadAnalysisHistory()
    // Load saved settings (do not assume defaults here to avoid unexpectedly hiding feed)
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(["settings"])
        if (result.settings) setSettings(result.settings)
      } catch (e) {
        // ignore
      }
    }

    loadSettings()

    const onStorageChange = (changes: { [key: string]: any }, areaName: string) => {
      if (areaName === "sync") {
        if (changes.settings) {
          setSettings(changes.settings.newValue || null)
        }
        // Reload user data when auth tokens change (user logs in/out)
        if (changes.focus_guard_access_token || changes.focus_guard_user) {
          console.log("Focus Guard: Auth state changed, reloading user data")
          loadUserStats()
          loadAnalysisHistory()
        }
      }
    }

    try {
      chrome.storage.onChanged.addListener(onStorageChange)
    } catch (e) {
      // ignore if API not available
    }

    return () => {
      try {
        history.pushState = originalPush
        history.replaceState = originalReplace
      } catch (e) {}
      window.removeEventListener("popstate", popstateHandler)
      window.removeEventListener("locationchange", onLocationChange)
      clearInterval(urlCheckInterval)
      try {
        chrome.storage.onChanged.removeListener(onStorageChange)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // IMPORTANT: The extension must never modify or hide the YouTube home feed.
  // All feed/hide logic has been removed to ensure we do not touch the home page.
  useEffect(() => {
    // No-op: intentionally do not modify the home feed.
  }, [isYouTubeHome, settings])

  // Note: feed hiding helpers intentionally removed. The extension will not
  // inject styles or modify the YouTube home/feed page under any condition.

  const loadUserStats = async () => {
    try {
      // Check if authenticated first
      const isAuth = await AuthService.isAuthenticated()
      if (!isAuth) {
        console.log("Focus Guard: User not authenticated, skipping stats load")
        setUserStats(null)
        return
      }

      const stats = await FocusGuardAPI.getUserStats()
      setUserStats(stats)
    } catch (error) {
      console.log("Focus Guard: Failed to load user stats (user may not be logged in):", (error as any)?.message || String(error))
      // Set null if not authenticated
      setUserStats(null)
    }
  }

  const loadAnalysisHistory = async () => {
    try {
      // Check if authenticated first
      const isAuth = await AuthService.isAuthenticated()
      if (!isAuth) {
        console.log("Focus Guard: User not authenticated, skipping history load")
        setAnalysisHistory([])
        return
      }

      const response = await FocusGuardAPI.getAnalysisHistory()
      setAnalysisHistory(response.history)
    } catch (error) {
      console.log("Focus Guard: Failed to load analysis history (user may not be logged in):", (error as any)?.message || String(error))
      setAnalysisHistory([])
    }
  }

  // FR-202: Start video analysis with cache check and job polling
  const normalizeConfidence = (v: number) => {
    if (!Number.isFinite(v)) return 0
    // If API returns 0-100, convert to 0-1; otherwise assume 0-1
    if (v > 1.5) return v / 100
    if (v < 0) return 0
    return v
  }

  // Helper: Get report tier restriction if user is not Pro
  const getReportTierRestriction = async () => {
    try {
      const subscription = await SubscriptionService.getSubscription()
      const userTier = subscription.tier?.toLowerCase() || 'free'
      
      // Report is Pro-only feature
      if (userTier !== 'pro') {
        const dashboardUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
        return {
          code: 'TIER_RESTRICTION' as const,
          required_tier: 'pro' as const,
          current_tier: userTier,
          message: 'Report downloads are available for Pro users only. Upgrade to download detailed analysis reports.',
          upgrade_url: dashboardUrl
        }
      }
      return null
    } catch (error) {
      console.log("Focus Guard: Failed to get subscription tier:", error)
      // Default to showing restriction if we can't determine tier
      return {
        code: 'TIER_RESTRICTION' as const,
        required_tier: 'pro' as const,
        current_tier: 'free',
        message: 'Report downloads are available for Pro users only. Upgrade to download detailed analysis reports.',
        upgrade_url: `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
      }
    }
  }

  // Helper: check cache on landing and prefetch full analysis components
  const checkCacheAndPrefetch = async (videoId: string) => {
    setIsCheckingCache(true)
    try {
      console.log("Focus Guard: checking cache on landing for video", videoId)
      const cacheStatus = await FocusGuardAPI.getCacheStatus(videoId)
      console.log("Focus Guard: cache status on landing:", cacheStatus)
      setIsCached(cacheStatus.cached)

      if (!cacheStatus.cached) {
        // Not cached — leave defaults
        setAnalysisState("idle")
        setAnalysisStatus(null)
        setVideoAnalysis(null)
        setIsCheckingCache(false)
        return
      }

      // Cached - fetch relevancy and additional data for quick display
      try {
        console.log("Focus Guard: Fetching analysis data for cached video...")
        // Fetch all analysis components in parallel
        const results = await Promise.allSettled([
          FocusGuardAPI.analyzeRelevancyV2(videoId, false),
          FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeSummaryV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeChannelCredibilityV2(videoId, false),
          // Human-likeness excluded from general flow - load on-demand for advanced features
          Promise.resolve(null),
          FocusGuardAPI.analyzeTopicClusteringV2(videoId, false),
          FocusGuardAPI.analyzeTopicGapV2(videoId, false)
        ])

        // Extract results and tier restrictions
        const relevancyData = results[0].status === 'fulfilled' ? results[0].value : null
        const sentimentData = results[1].status === 'fulfilled' ? results[1].value : null
        const summaryData = results[2].status === 'fulfilled' ? results[2].value : null
        const credibilityData = results[3].status === 'fulfilled' ? results[3].value : null
        const humanLikenessData = null
        const topicClustersData = results[5].status === 'fulfilled' ? results[5].value : null
        const topicGapsData = results[6].status === 'fulfilled' ? results[6].value : null

        let sentimentTierRestriction = null
        let topicClustersTierRestriction = null
        let topicGapsTierRestriction = null

        // Extract tier restrictions from failures
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            const endpoints = ['relevancy', 'sentiment', 'summary', 'credibility', 'humanLikeness', 'topicClusters', 'topicGaps']
            console.error(`Focus Guard: failed to fetch ${endpoints[idx]}:`, result.reason)
            
            // Check if error contains tier restriction
            const error = result.reason
            if (error && typeof error === 'object') {
              // Check multiple possible error structures
              const detail = error.detail || (error.response && error.response.detail)
              if (detail && detail.code === 'TIER_RESTRICTION') {
                console.log(`Focus Guard: Tier restriction detected for ${endpoints[idx]}:`, detail)
                if (idx === 1) sentimentTierRestriction = detail
                if (idx === 5) topicClustersTierRestriction = detail
                if (idx === 6) topicGapsTierRestriction = detail
              }
            }
          }
        })
        
        console.log("Focus Guard: Relevancy data on landing:", relevancyData)
        console.log("Focus Guard: Sentiment data on landing:", sentimentData)
        console.log("Focus Guard: Summary data on landing:", summaryData)
        console.log("Focus Guard: Credibility data on landing:", credibilityData)
        console.log("Focus Guard: Human Likeness data on landing:", humanLikenessData)
        console.log("Focus Guard: Topic Clusters data on landing:", topicClustersData)
        console.log("Focus Guard: Topic Gaps data on landing:", topicGapsData)
        
        const verdictRaw = (relevancyData?.data.verdict || "UNKNOWN").toUpperCase()
        const confidenceRaw = typeof relevancyData?.data.confidence_score === "number" ? relevancyData.data.confidence_score : 0
        console.log("Focus Guard: Raw confidence:", confidenceRaw)
        
        const confidenceNorm = normalizeConfidence(confidenceRaw)
        console.log("Focus Guard: Normalized confidence:", confidenceNorm)
        
        const confidencePercent = Math.round(confidenceNorm * 100)
        const trustScoreNormalized = Math.round(confidenceNorm * 10 * 10) / 10
        console.log("Focus Guard: Final trustScore:", trustScoreNormalized, "verdict:", verdictRaw)

        setAnalysisStatus({
          trustScore: trustScoreNormalized,
          clickbaitVerdict: verdictRaw as "LEGIT" | "MISLEADING" | "CLICKBAIT",
          isAnalyzing: false
        })

        const minimalSummary = {
          trustScore: trustScoreNormalized,
          aiConfidence: confidencePercent,
          clickbaitVerdict: {
            label: verdictRaw,
            confidence: confidencePercent
          },
          channelCredibility: credibilityData ? {
            score: credibilityData.score,
            factors: credibilityData.normalized_factors ? Object.entries(credibilityData.normalized_factors).map(([name, weight]) => ({
              name,
              weight,
              value: credibilityData.factual_factors?.[name] ?? 'N/A'
            })) : []
          } : undefined
        }

        // Build sentiment distribution if available
        const sentimentDistribution = sentimentData ? (() => {
          const positiveCount = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
          const neutralCount = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
          const negativeCount = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
          const totalComments = sentimentData.data.total_comments ?? (positiveCount + neutralCount + negativeCount)
          
          // Extract top comments
          const positiveComments = typeof sentimentData.data.positive === 'object' ? sentimentData.data.positive?.top_comments ?? [] : []
          const neutralComments = typeof sentimentData.data.neutral === 'object' ? sentimentData.data.neutral?.top_comments ?? [] : []
          const negativeComments = typeof sentimentData.data.negative === 'object' ? sentimentData.data.negative?.top_comments ?? [] : []
          
          return {
            positive: totalComments > 0 ? (positiveCount / totalComments) * 100 : 0,
            neutral: totalComments > 0 ? (neutralCount / totalComments) * 100 : 0,
            negative: totalComments > 0 ? (negativeCount / totalComments) * 100 : 0,
            totalCommentsAnalyzed: totalComments,
            exampleComments: {
              positive: positiveComments,
              neutral: neutralComments,
              negative: negativeComments
            }
          }
        })() : undefined

        // Transform topic clusters to high-value insights
        const benefitInsights = topicClustersData?.topic_clusters
          ?.filter(cluster => cluster.count > 0)
          .slice(0, 5)
          .map((cluster, idx) => ({
            id: `benefit-${idx}`,
            statement: cluster.statement,
            type: "benefit" as const,
            commentCount: cluster.count,
            supportingComments: cluster.supporting_quotes.map((quote, qIdx) => ({
              id: `comment-${idx}-${qIdx}`,
              text: quote,
              timestamp: undefined,
              author: undefined
            })),
            isExpanded: false
          })) || []

        // Transform topic gaps to unanswered questions for ContentGapsTab
        const unansweredQuestions = topicGapsData?.topic_gaps
          ?.map((gap, idx) => ({
            id: `gap-${idx}`,
            statement: gap.question_statement,
            type: "issue" as const,
            commentCount: gap.supporting_comments.length,
            supportingComments: gap.supporting_comments.map((comment, cIdx) => ({
              id: `gap-comment-${idx}-${cIdx}`,
              text: comment,
              timestamp: undefined,
              author: undefined
            })),
            isExpanded: false
          })) || []

        console.log("Focus Guard: Setting video analysis with tier restrictions:", {
          sentiment: sentimentTierRestriction,
          viewerInsights: topicClustersTierRestriction,
          contentGaps: topicGapsTierRestriction
        })

        // Check report tier restriction
        const reportTierRestriction = await getReportTierRestriction()

        setVideoAnalysis({
          summary: minimalSummary,
          trustScore: { score: trustScoreNormalized },
          clickbaitVerdict: { verdict: verdictRaw },
          executiveSummary: summaryData?.summary_paragraph ?? null,
          channelCredibility: credibilityData ? {
            score: credibilityData.score,
            factors: credibilityData.normalized_factors ? Object.entries(credibilityData.normalized_factors).map(([name, weight]) => ({
              name,
              weight,
              value: credibilityData.factual_factors?.[name] ?? 'N/A'
            })) : []
          } : null,
          sentiment: sentimentDistribution ? {
            overall: (() => {
              const positiveCount = typeof sentimentData!.data.positive === 'number' ? sentimentData!.data.positive : (sentimentData!.data.positive?.count ?? 0)
              const negativeCount = typeof sentimentData!.data.negative === 'number' ? sentimentData!.data.negative : (sentimentData!.data.negative?.count ?? 0)
              return positiveCount > negativeCount ? "positive" : negativeCount > positiveCount ? "negative" : "neutral"
            })(),
            distribution: sentimentDistribution,
            tierRestriction: sentimentTierRestriction
          } : (sentimentTierRestriction ? { tierRestriction: sentimentTierRestriction } : null),
          credibility: null,
          topicClusters: null,
          contentGaps: {
            botPercentage: (humanLikenessData && (humanLikenessData as any).total_comments && (humanLikenessData as any).total_comments > 0)
              ? Math.round(((humanLikenessData as any).bot_count / (humanLikenessData as any).total_comments) * 100)
              : 0,
            gapCoverageScore: topicGapsData?.topic_gaps ? Math.max(0, 100 - (topicGapsData.topic_gaps.length * 10)) : 100,
            botDetectionEnabled: true,
            unansweredQuestions: unansweredQuestions,
            tierRestriction: topicGapsTierRestriction
          },
          viewerInsights: sentimentData ? {
            sentimentBreakdown: {
              positive: typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0),
              negative: typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0),
              neutral: typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0),
              totalCommentsAnalyzed: (() => {
                const pos = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
                const neg = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
                const neu = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
                return sentimentData.data.total_comments ?? (pos + neg + neu)
              })()
            },
            actionableInsights: {
              highValue: benefitInsights
            },
            tierRestriction: topicClustersTierRestriction
          } : (topicClustersTierRestriction ? { tierRestriction: topicClustersTierRestriction } : null),
          reportInfo: {
            availableFormats: ["PDF", "TXT"],
            analysisDate: new Date().toISOString(),
            tierRestriction: reportTierRestriction
          }
        } as any)

        setAnalysisState("complete")
        setIsCheckingCache(false)
      } catch (err) {
        console.warn("Focus Guard: failed to fetch relevancy on landing:", (err as any)?.message || String(err))
        setAnalysisState("idle")
        setAnalysisStatus(null)
        setVideoAnalysis(null)
        setIsCheckingCache(false)
      }
    } catch (error) {
      console.log("Focus Guard: cache check failed on landing (likely unauthenticated):", (error as any)?.message || String(error))
      setIsCached(false)
      setAnalysisState("idle")
      setAnalysisStatus(null)
      setVideoAnalysis(null)
      setIsCheckingCache(false)
    }
  }

  const startVideoAnalysis = async (videoId: string) => {
    setIsAnalyzing(true)
    setAnalysisState("analyzing")
    setAnalysisStatus(null)
    setVideoAnalysis(null)
    setAnalysisError(null)

    try {
      const analysisStartTime = Date.now()
      console.log("Starting video analysis for:", videoId)
      
      // Check authentication before starting
      console.log("Checking authentication before analysis...")
      const isAuth = await AuthService.isAuthenticated()
      console.log("Authentication check result:", isAuth)
      
      if (!isAuth) {
        throw new Error("Not authenticated. Please log in to analyze videos.")
      }
      
      // Step 1: Check cache status
      console.log("Checking cache status...")
      const cacheCheckStart = Date.now()
      const cacheStatus = await FocusGuardAPI.getCacheStatus(videoId)
      const cacheCheckDuration = ((Date.now() - cacheCheckStart) / 1000).toFixed(2)
      setIsCached(cacheStatus.cached)
      console.log(`Cache status (${cacheCheckDuration}s):`, cacheStatus)

      let relevancyData
      let sentimentData = null
      let summaryData = null
      let credibilityData = null
      let humanLikenessData = null
      let topicClustersData = null
      let topicGapsData = null
      let sentimentTierRestriction = null
      let topicClustersTierRestriction = null
      let topicGapsTierRestriction = null

      if (!cacheStatus.cached) {
        // Step 2a: Not cached - submit job and poll
        console.log("Video not cached, submitting summary job...")
        const jobResponse = await FocusGuardAPI.submitSummaryJob({
          video_id: videoId,
          force_refresh: false
        })
        console.log("Job submitted:", jobResponse)
        setCurrentJobId(jobResponse.job_id)

        // Poll job status
        console.log("Polling job status...")
        const pollStartTime = Date.now()
        const jobResult = await FocusGuardAPI.pollJob(
          jobResponse.job_id,
          (status) => {
            const elapsed = ((Date.now() - pollStartTime) / 1000).toFixed(1)
            console.log(`[${elapsed}s] Job progress:`, status.progress_percent, "%", status.progress_message, "Status:", status.status)
          },
          500 // Poll every 500ms for faster response
        )
        const pollDuration = ((Date.now() - pollStartTime) / 1000).toFixed(1)
        console.log(`Job completed in ${pollDuration}s:`, jobResult)

        // Step 3a: After job completes, fetch analysis endpoints in parallel (data is now cached)
        // NOTE: Excluding human-likeness from general flow - will be loaded on-demand for advanced features
        console.log("Fetching analysis data in parallel (post-job)...")
        const fetchStartTime = Date.now()
        const results = await Promise.allSettled([
          FocusGuardAPI.analyzeRelevancyV2(videoId, false),
          FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeSummaryV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeChannelCredibilityV2(videoId, false),
          FocusGuardAPI.analyzeTopicClusteringV2(videoId, false),
          FocusGuardAPI.analyzeTopicGapV2(videoId, false)
        ])
        const fetchDuration = ((Date.now() - fetchStartTime) / 1000).toFixed(1)
        console.log(`Analysis data fetched in ${fetchDuration}s`)
        
        // Extract results, logging any failures and capturing tier restrictions
        relevancyData = results[0].status === 'fulfilled' ? results[0].value : null
        sentimentData = results[1].status === 'fulfilled' ? results[1].value : null
        summaryData = results[2].status === 'fulfilled' ? results[2].value : null
        credibilityData = results[3].status === 'fulfilled' ? results[3].value : null
        topicClustersData = results[4].status === 'fulfilled' ? results[4].value : null
        topicGapsData = results[5].status === 'fulfilled' ? results[5].value : null
        humanLikenessData = null // Not fetched in general flow - load on-demand for advanced features
        
        // Log any failures and extract tier restrictions
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            const endpoints = ['relevancy', 'sentiment', 'summary', 'credibility', 'topicClusters', 'topicGaps']
            console.error(`Failed to fetch ${endpoints[idx]}:`, result.reason)
            
            // Check if the error is a tier restriction
            const error = result.reason
            if (error && typeof error === 'object' && 'response' in error && error.response) {
              const responseData = error.response
              if (responseData.detail && responseData.detail.code === 'TIER_RESTRICTION') {
                console.log(`Tier restriction detected for ${endpoints[idx]}:`, responseData.detail)
                if (idx === 1) sentimentTierRestriction = responseData.detail
                if (idx === 4) topicClustersTierRestriction = responseData.detail
                if (idx === 5) topicGapsTierRestriction = responseData.detail
              }
            }
          }
        })
        
        if (!relevancyData) {
          throw new Error("Failed to fetch relevancy data (required)")
        }
      } else {
        // Step 2b: Cached - directly get relevancy
        console.log("Video cached, fetching relevancy data...")
        relevancyData = await FocusGuardAPI.analyzeRelevancyV2(videoId, false)
      }

      console.log("Relevancy data:", relevancyData)

      // Map relevancy verdict and confidence to our analysis status
      const verdictRaw = (relevancyData.data.verdict || "UNKNOWN").toUpperCase()
      const confidenceRaw = typeof relevancyData.data.confidence_score === "number" ? relevancyData.data.confidence_score : 0
      console.log("Focus Guard: Raw confidence from API:", confidenceRaw)
      const confidenceNorm = normalizeConfidence(confidenceRaw)
      console.log("Focus Guard: Normalized confidence:", confidenceNorm)

      // Normalize confidence: convert to percent and 0-10 trust score.
      const confidencePercent = Math.round(confidenceNorm * 100)
      const trustScoreNormalized = Math.round(confidenceNorm * 10 * 10) / 10 // 0-10, one decimal
      console.log("Focus Guard: Final trustScore for analysisStatus:", trustScoreNormalized, "confidencePercent:", confidencePercent)

      // Fetch additional analysis data for full report (only if we haven't already fetched it)
      // NOTE: Excluding human-likeness from general flow - will be loaded on-demand for advanced features
      if (!sentimentData || !summaryData || !credibilityData || !topicClustersData || !topicGapsData) {
        console.log("Focus Guard: Fetching remaining analysis data for video:", videoId)
        const remainingFetchStart = Date.now()
        // Fetch data in parallel with resilient error handling (excluding human-likeness)
        const remainingResults = await Promise.allSettled([
          FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeSummaryV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeChannelCredibilityV2(videoId, false),
          FocusGuardAPI.analyzeTopicClusteringV2(videoId, false),
          FocusGuardAPI.analyzeTopicGapV2(videoId, false)
        ])
        
        sentimentData = sentimentData || (remainingResults[0].status === 'fulfilled' ? remainingResults[0].value : null)
        summaryData = summaryData || (remainingResults[1].status === 'fulfilled' ? remainingResults[1].value : null)
        credibilityData = credibilityData || (remainingResults[2].status === 'fulfilled' ? remainingResults[2].value : null)
        topicClustersData = topicClustersData || (remainingResults[3].status === 'fulfilled' ? remainingResults[3].value : null)
        topicGapsData = topicGapsData || (remainingResults[4].status === 'fulfilled' ? remainingResults[4].value : null)
        humanLikenessData = null // Not fetched - load on-demand for advanced features
        
        const remainingFetchDuration = ((Date.now() - remainingFetchStart) / 1000).toFixed(1)
        console.log(`Remaining analysis data fetched in ${remainingFetchDuration}s`)
        
        // Check for tier restriction errors in remaining calls if not already captured
        if (!sentimentTierRestriction && remainingResults[0].status === 'rejected') {
          const error = remainingResults[0].reason
          if (error && typeof error === 'object' && 'response' in error && error.response?.detail?.code === 'TIER_RESTRICTION') {
            sentimentTierRestriction = error.response.detail
          }
        }
        if (!topicClustersTierRestriction && remainingResults[3].status === 'rejected') {
          const error = remainingResults[3].reason
          if (error && typeof error === 'object' && 'response' in error && error.response?.detail?.code === 'TIER_RESTRICTION') {
            topicClustersTierRestriction = error.response.detail
          }
        }
        if (!topicGapsTierRestriction && remainingResults[4].status === 'rejected') {
          const error = remainingResults[4].reason
          if (error && typeof error === 'object' && 'response' in error && error.response?.detail?.code === 'TIER_RESTRICTION') {
            topicGapsTierRestriction = error.response.detail
          }
        }
        
        // Log any failures
        remainingResults.forEach((result, idx) => {
          if (result.status === 'rejected') {
            const endpoints = ['sentiment', 'summary', 'credibility', 'topicClusters', 'topicGaps']
            console.error(`Failed to fetch ${endpoints[idx]}:`, result.reason)
          }
        })
      }
      
      if (sentimentData) {
        console.log("Focus Guard: Sentiment data received:", sentimentData)
      }
      if (summaryData) {
        console.log("Focus Guard: Summary data received:", summaryData)
      }
      if (credibilityData) {
        console.log("Focus Guard: Credibility data received:", credibilityData)
      }
      if (humanLikenessData) {
        console.log("Focus Guard: Human Likeness data received:", humanLikenessData)
      }
      if (topicClustersData) {
        console.log("Focus Guard: Topic Clusters data received:", topicClustersData)
      }
      if (topicGapsData) {
        console.log("Focus Guard: Topic Gaps data received:", topicGapsData)
      }
      
      // Extract counts from nested structure (if sentiment data exists)
      const positiveCount = sentimentData ? (typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)) : 0
      const neutralCount = sentimentData ? (typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)) : 0
      const negativeCount = sentimentData ? (typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)) : 0
      const totalComments = sentimentData?.data.total_comments ?? (positiveCount + neutralCount + negativeCount)
      
      console.log("Focus Guard: Sentiment counts:", {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
        total: totalComments
      })

      setAnalysisStatus({
        trustScore: trustScoreNormalized,
        clickbaitVerdict: verdictRaw as "LEGIT" | "MISLEADING" | "CLICKBAIT",
        isAnalyzing: false
      })

      // Create a minimal video analysis object for the panel with expected fields
      const minimalSummary = {
        trustScore: trustScoreNormalized,
        aiConfidence: confidencePercent,
        clickbaitVerdict: {
          label: verdictRaw,
          confidence: confidencePercent
        },
        channelCredibility: credibilityData ? {
          score: credibilityData.score,
          factors: credibilityData.normalized_factors ? Object.entries(credibilityData.normalized_factors).map(([name, weight]) => ({
            name,
            weight,
            value: credibilityData.factual_factors?.[name] ?? 'N/A'
          })) : []
        } : undefined
      }

      // Build sentiment distribution if available
      const sentimentDistribution = sentimentData ? (() => {
        const positiveCount = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
        const neutralCount = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
        const negativeCount = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
        const totalComments = sentimentData.data.total_comments ?? (positiveCount + neutralCount + negativeCount)
        
        // Extract top comments
        const positiveComments = typeof sentimentData.data.positive === 'object' ? sentimentData.data.positive?.top_comments ?? [] : []
        const neutralComments = typeof sentimentData.data.neutral === 'object' ? sentimentData.data.neutral?.top_comments ?? [] : []
        const negativeComments = typeof sentimentData.data.negative === 'object' ? sentimentData.data.negative?.top_comments ?? [] : []
        
        return {
          positive: totalComments > 0 ? (positiveCount / totalComments) * 100 : 0,
          neutral: totalComments > 0 ? (neutralCount / totalComments) * 100 : 0,
          negative: totalComments > 0 ? (negativeCount / totalComments) * 100 : 0,
          totalCommentsAnalyzed: totalComments,
          exampleComments: {
            positive: positiveComments,
            neutral: neutralComments,
            negative: negativeComments
          }
        }
      })() : undefined

      // Transform topic clusters to high-value insights
      const benefitInsights = topicClustersData?.topic_clusters
        ?.filter(cluster => cluster.count > 0)
        .slice(0, 5)
        .map((cluster, idx) => ({
          id: `benefit-${idx}`,
          statement: cluster.statement,
          type: "benefit" as const,
          commentCount: cluster.count,
          supportingComments: cluster.supporting_quotes.map((quote, qIdx) => ({
            id: `comment-${idx}-${qIdx}`,
            text: quote,
            timestamp: undefined,
            author: undefined
          })),
          isExpanded: false
        })) || []

      // Transform topic gaps to unanswered questions for ContentGapsTab
      const unansweredQuestions = topicGapsData?.topic_gaps
        ?.map((gap, idx) => ({
          id: `gap-${idx}`,
          statement: gap.question_statement,
          type: "issue" as const,
          commentCount: gap.supporting_comments.length,
          supportingComments: gap.supporting_comments.map((comment, cIdx) => ({
            id: `gap-comment-${idx}-${cIdx}`,
            text: comment,
            timestamp: undefined,
            author: undefined
          })),
          isExpanded: false
        })) || []

      // Check report tier restriction
      const reportTierRestriction = await getReportTierRestriction()

      setVideoAnalysis({
        // Legacy shape support
        summary: minimalSummary,
        trustScore: { score: trustScoreNormalized },
        clickbaitVerdict: { verdict: verdictRaw },
        executiveSummary: summaryData?.summary_paragraph ?? null,
        channelCredibility: credibilityData ? {
          score: credibilityData.score,
          factors: credibilityData.normalized_factors ? Object.entries(credibilityData.normalized_factors).map(([name, weight]) => ({
            name,
            weight,
            value: credibilityData.factual_factors?.[name] ?? 'N/A'
          })) : []
        } : null,
        // Minimal placeholders for other tabs
        sentiment: sentimentDistribution ? {
          overall: (() => {
            const positiveCount = typeof sentimentData!.data.positive === 'number' ? sentimentData!.data.positive : (sentimentData!.data.positive?.count ?? 0)
            const negativeCount = typeof sentimentData!.data.negative === 'number' ? sentimentData!.data.negative : (sentimentData!.data.negative?.count ?? 0)
            return positiveCount > negativeCount ? "positive" : negativeCount > positiveCount ? "negative" : "neutral"
          })(),
          distribution: sentimentDistribution,
          tierRestriction: sentimentTierRestriction
        } : (sentimentTierRestriction ? { tierRestriction: sentimentTierRestriction } : null),
        credibility: null,
        topicClusters: null,
        contentGaps: {
          botPercentage: (humanLikenessData && (humanLikenessData as any).total_comments && (humanLikenessData as any).total_comments > 0)
            ? Math.round(((humanLikenessData as any).bot_count / (humanLikenessData as any).total_comments) * 100)
            : 0,
          gapCoverageScore: topicGapsData?.topic_gaps ? Math.max(0, 100 - (topicGapsData.topic_gaps.length * 10)) : (topicGapsTierRestriction ? undefined : 100),
          botDetectionEnabled: true,
          unansweredQuestions: unansweredQuestions,
          tierRestriction: topicGapsTierRestriction
        },
        viewerInsights: sentimentData ? {
          sentimentBreakdown: {
            positive: typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0),
            negative: typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0),
            neutral: typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0),
            totalCommentsAnalyzed: (() => {
              const pos = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
              const neg = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
              const neu = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
              return sentimentData.data.total_comments ?? (pos + neg + neu)
            })()
          },
          actionableInsights: {
            highValue: benefitInsights
          },
          tierRestriction: topicClustersTierRestriction
        } : (topicClustersTierRestriction ? { tierRestriction: topicClustersTierRestriction } : null),
        reportInfo: {
          availableFormats: ["PDF", "TXT"],
          analysisDate: new Date().toISOString(),
          tierRestriction: reportTierRestriction
        }
      } as any)

      setAnalysisState("complete")
      setCurrentJobId(null)

      const totalDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(1)
      console.log(`✅ Total analysis completed in ${totalDuration}s`)

      // FR-101: Show pre-watch popover after analysis completes
      setShowPreWatchPopover(true)
    } catch (error) {
      console.error("Video analysis failed:", error)
      const errorMessage = error instanceof Error ? error.message : "Analysis failed"
      setAnalysisError(errorMessage)
      setAnalysisState("idle") // Return to idle so user can retry
      setCurrentJobId(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleDownloadReport = async (format: "PDF" | "TXT") => {
    if (!currentVideoId) return

    try {
      const blob = await FocusGuardAPI.downloadReport({
        videoId: currentVideoId,
        format
      })

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `focus-guard-report-${currentVideoId}.${format.toLowerCase()}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download report:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Show user-friendly error
      if (errorMessage.includes("Pro subscription")) {
        alert("PDF reports require a Pro subscription. Please try TXT format or upgrade your account.")
      } else {
        alert(`Failed to download report: ${errorMessage}`)
      }
    }
  }

  const handleReAnalyze = async (videoId: string) => {
    if (videoId === currentVideoId) {
      startVideoAnalysis(videoId)
    }
  }

  const handleDownloadHistoryReport = async (videoId: string) => {
    try {
      // Try PDF first, fallback to TXT if Pro subscription is required
      let blob: Blob
      try {
        blob = await FocusGuardAPI.downloadReport({
          videoId,
          format: "PDF"
        })
      } catch (pdfError) {
        const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError)
        if (errorMessage.includes("Pro subscription")) {
          // Fallback to TXT format
          console.log("PDF requires Pro, downloading TXT instead")
          blob = await FocusGuardAPI.downloadReport({
            videoId,
            format: "TXT"
          })
        } else {
          throw pdfError
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `focus-guard-report-${videoId}.${blob.type.includes('pdf') ? 'pdf' : 'txt'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download history report:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to download report: ${errorMessage}`)
    }
  }

  // FR-102: Render Side Panel on watch page
  if (onWatchPage) {
    return (
      <>
        {/* FR-101: Pre-Watch Popover */}
        {showPreWatchPopover && (
          <PreWatchPopover
            analysis={videoAnalysis}
            isLoading={isAnalyzing}
            onDismiss={() => {
              setShowPreWatchPopover(false)
              setPreWatchDismissed(true)
            }}
            onViewFullAnalysis={() => {
              setShowPreWatchPopover(false)
              setPreWatchDismissed(true)
              setIsSidePanelOpen(true)
            }}
            onWatchAnyway={() => {
              setShowPreWatchPopover(false)
              setPreWatchDismissed(true)
            }}
          />
        )}
        
        {/* New ToggleButton - visible when panel is closed */}
        {!isSidePanelOpen && (
          // Debug: log props sent to ToggleButton to verify shapes at runtime
          console.log("Focus Guard: Toggle props", { analysisState, analysisStatus, videoAnalysisSummary: videoAnalysis?.summary, isCached, analysisError }),
          <ToggleButton
            trustScore={analysisStatus?.trustScore}
            verdict={analysisStatus?.clickbaitVerdict}
            dock={panelDock}
            state={isCheckingCache ? "analyzing" : analysisState}
            isCached={isCached}
            errorMessage={analysisError}
            onToggle={() => {
              if (isCheckingCache) {
                // Do nothing while checking cache
                return
              }
              if (analysisState === "idle") {
                // Start analysis when in idle state
                if (currentVideoId) {
                  startVideoAnalysis(currentVideoId)
                } else if (DEBUG) {
                  // In debug mode without videoId, start analysis anyway
                  startVideoAnalysis("debug-mock-video-id")
                }
              } else if (analysisState === "complete") {
                // Open panel when analysis is complete
                setIsSidePanelOpen(true)
              }
              // Do nothing if analyzing (wait for completion)
            }}
            onDockChange={(pos) => {
              setPanelDock(pos)
              try {
                localStorage.setItem("focus-guard-toggle-dock", pos)
              } catch (e) {}
            }}
          />
        )}

        <SidePanel
          analysis={videoAnalysis}
          isLoading={isAnalyzing}
          isOpen={isSidePanelOpen}
          position={panelDock}
          history={analysisHistory}
          onClose={() => setIsSidePanelOpen(false)}
          onDownloadReport={handleDownloadReport}
          onReAnalyze={handleReAnalyze}
          onDownloadHistoryReport={handleDownloadHistoryReport}
          onBotFilterChange={(enabled) => {
            console.log("Bot filter changed:", enabled)
          }}
        />
      </>
    )
  }

  return null
}

export default ContentScript
