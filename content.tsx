import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

import { ResultsList } from "~components/ResultsList"
import { SearchInterface } from "~components/SearchInterface"
import { ToggleButton } from "~components/ToggleButton"
import { SidePanel } from "~components/SidePanel"
import { PreWatchPopover } from "~components/PreWatchPopover"
import { VerdictTooltip } from "~components/VerdictTooltip"
import { CommunityVerdictTeaser } from "~components/CommunityVerdictTeaser"
import { AnalysisSettingsModal } from "~components/AnalysisSettingsModal"
import { CreditConfirmationDialog } from "~components/CreditConfirmationDialog"
import { initConsole } from "~lib/console-manager"
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
import type { TierRestriction } from "~types/tierRestriction"
import type { FocusGuardSettings } from "~types/popup"
import type { FreeQueueStatus, FreeQueueSubmitError } from "~types/backend"

initConsole()

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

// Scroll to a linked comment when the page URL contains ?lc=COMMENT_ID.
// YouTube's native lc= handler fires once on load and gives up quickly if
// comments haven't rendered yet. This runs from our content script and keeps
// retrying for up to 15 seconds, scrolling down to trigger YouTube's lazy
// comment loading, so it works reliably even on slow connections.
let _scrollToLinkedCommentActive = false
let _scrollToLinkedCommentTimer: ReturnType<typeof setTimeout> | null = null

// Cancel any in-progress scrollToLinkedComment run (call before starting a new one).
function cancelScrollToLinkedComment() {
  _scrollToLinkedCommentActive = false
  if (_scrollToLinkedCommentTimer !== null) {
    clearTimeout(_scrollToLinkedCommentTimer)
    _scrollToLinkedCommentTimer = null
  }
}

function scrollToLinkedComment() {
  const params = new URLSearchParams(window.location.search)
  const commentId = params.get("lc")
  if (!commentId) return
  // Cancel any previous run before starting a new one
  cancelScrollToLinkedComment()
  _scrollToLinkedCommentActive = true

  const findComment = (): Element | null => {
    // Strategy 1: attribute selectors on comment thread elements
    let el: Element | null =
      document.querySelector(`ytd-comment-thread-renderer[has-comment-id="${commentId}"]`) ||
      document.querySelector(`ytd-comment-thread-renderer[comment-id="${commentId}"]`)
    if (el) return el

    // Strategy 2: check __data on all thread renderers
    for (const c of document.querySelectorAll('ytd-comment-thread-renderer')) {
      const d = (c as any).__data
      const id = d?.commentId || d?.comment?.commentId || d?.commentIdStr
      if (id === commentId) return c
    }

    // Strategy 3: id / data-comment-id attributes
    for (const c of document.querySelectorAll('[id], [data-comment-id]')) {
      const id = c.getAttribute('id') || c.getAttribute('data-comment-id') || ''
      if (id.indexOf(commentId) !== -1) return c
    }

    // Strategy 4: permalink anchors
    for (const a of document.querySelectorAll('a[href*="&lc="]')) {
      if ((a as HTMLAnchorElement).href.indexOf(`&lc=${commentId}`) !== -1) {
        const thread = (a as HTMLElement).closest('ytd-comment-thread-renderer') || a.closest('ytd-comment-renderer')
        return thread || a
      }
    }

    return null
  }

  const highlight = (el: Element) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const h = el as HTMLElement
    const origBg = h.style.backgroundColor
    const origTrans = h.style.transition
    h.style.transition = 'background-color 0.2s ease'
    h.style.backgroundColor = '#fff3cd'
    setTimeout(() => {
      h.style.backgroundColor = origBg
      setTimeout(() => { h.style.transition = origTrans }, 200)
    }, 1200)
    _scrollToLinkedCommentActive = false
    _scrollToLinkedCommentTimer = null
  }

  // Wait for comments section to exist, then scroll down to load comments
  // Cap at 15s — enough for slow connections; avoids endless scroll.
  const maxWaitMs = 15_000
  const tickMs = 600
  let elapsed = 0

  const tick = () => {
    // Abort if cancelled externally or the user navigated away
    if (!_scrollToLinkedCommentActive) return
    if (new URLSearchParams(window.location.search).get("lc") !== commentId) {
      cancelScrollToLinkedComment()
      return
    }

    elapsed += tickMs
    if (elapsed > maxWaitMs) {
      cancelScrollToLinkedComment()
      return
    }

    const found = findComment()
    if (found) {
      highlight(found)
      return
    }

    // Scroll down to trigger YouTube lazy loading
    const commentsSection = document.querySelector('ytd-comments#comments') || document.querySelector('#comments')
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.scrollBy({ top: 600, behavior: 'smooth' })
    }

    _scrollToLinkedCommentTimer = setTimeout(tick, tickMs)
  }

  // Give the page a moment to paint before starting
  _scrollToLinkedCommentTimer = setTimeout(tick, 1500)
}

// Calculate evidence score from claims (0-100 scale)
// Measures strength of user evidence for/against claims
// Formula: weighted_for = sum(for.count * (1 + likes*0.1))
//          weighted_against = sum(against.count * (1 + likes*0.1))
//          evidence_score = 100 * weighted_for / (weighted_for + weighted_against + ε)
function calculateEvidenceScore(claims: any[]): number {
  if (!claims || claims.length === 0) return 50 // Neutral score if no claims
  
  let weightedFor = 0
  let weightedAgainst = 0
  const epsilon = 0.001 // Small value to avoid division by zero
  
  for (const claim of claims) {
    // Process evidence_for
    if (claim.evidence_for && Array.isArray(claim.evidence_for)) {
      for (const evidence of claim.evidence_for) {
        const likes = typeof evidence.likes === 'number' ? evidence.likes : 0
        const weight = 1 + (likes * 0.1)
        weightedFor += weight
      }
    }
    
    // Process evidence_against
    if (claim.evidence_against && Array.isArray(claim.evidence_against)) {
      for (const evidence of claim.evidence_against) {
        const likes = typeof evidence.likes === 'number' ? evidence.likes : 0
        const weight = 1 + (likes * 0.1)
        weightedAgainst += weight
      }
    }
  }
  
  // Calculate evidence score (0-100)
  const total = weightedFor + weightedAgainst + epsilon
  const score = (100 * weightedFor) / total
  
  console.log(`Evidence Score Calculation: for=${weightedFor.toFixed(2)}, against=${weightedAgainst.toFixed(2)}, score=${score.toFixed(1)}`)
  
  return Math.round(score * 10) / 10 // Round to 1 decimal
}

function normalizeGapComments(gap: any): any[] {
  const rawComments = gap?.sample_comments || gap?.supporting_comments || gap?.all_supporting_comments || []
  return Array.isArray(rawComments) ? rawComments : []
}

function normalizeCommentForDisplay(comment: any, fallbackId: string, youtubeCommentId?: string) {
  if (comment && typeof comment === "object") {
    // Try every plausible text field name the API might use
    const text =
      (typeof comment.text === "string" ? comment.text : null) ??
      (typeof comment.comment_text === "string" ? comment.comment_text : null) ??
      (typeof comment.content === "string" ? comment.content : null) ??
      (typeof comment.body === "string" ? comment.body : null) ??
      (typeof comment.message === "string" ? comment.message : null) ??
      // Nested: comment.text might itself be a CommentObject
      (comment.text && typeof comment.text === "object" && typeof comment.text.text === "string" ? comment.text.text : null) ??
      ""

    const derivedYoutubeCommentId = typeof comment.youtube_comment_id === "string"
      ? comment.youtube_comment_id
      : (typeof comment.comment_id === "string"
        ? comment.comment_id
        : (typeof comment.id === "string" ? comment.id : undefined))

    return {
      ...comment,
      id: comment.id ?? fallbackId,
      text,
      youtube_comment_id: derivedYoutubeCommentId ?? youtubeCommentId ?? comment.youtube_comment_id
    }
  }

  return {
    id: fallbackId,
    text: typeof comment === "string" ? comment : "",
    youtube_comment_id: youtubeCommentId
  }
}

function mapGapSupportingComments(gap: any, gapIdx: number) {
  const gapComments = normalizeGapComments(gap)

  return gapComments.map((comment: any, cIdx: number) => {
    // Comment objects from V2 backend already have youtube_comment_id, author_display_name, etc.
    // No need to map from highlight_indexes - just normalize the comment object directly
    return normalizeCommentForDisplay(comment, `gap-comment-${gapIdx}-${cIdx}`)
  })
}

// Debug mode: enable extended injection on any YouTube page when set.
// Read debug flag from environment at build time (set by `dev:debug` script).
// Use a direct `process.env.COMMENT_VERDICT_DEBUG` access so the bundler can
// statically replace the value during the build (avoid optional chaining).
const BUILD_DEBUG = (process.env.COMMENT_VERDICT_DEBUG === "1" || process.env.COMMENT_VERDICT_DEBUG === "true")

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

// Max comments to analyze (for testing/development)
const MAX_COMMENTS = parseInt(process.env.PLASMO_PUBLIC_MAX_COMMENTS || "20", 10)

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
  // Initialize settings with defaults to ensure toggle button always shows
  const [settings, setSettings] = useState<FocusGuardSettings | null>({
    isEnabled: true,
    videoAnalysis: {
      showPreWatchPopover: true,
      autoAnalyze: false,
      botDetectionEnabled: true,
      showCachedVerdict: false,
      confirmCreditUsage: true,
      maxCommentDepth: 100,
      autoQuickVerdict: true
    }
  })

  // FR-102 & FR-103: Watch page analysis state
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const currentVideoIdRef = useRef<string | null>(null)
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<VideoAnalysisStatus | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  // Mirror of analysisState as a ref so stale closures (e.g. onStorageChange registered
  // in the mount-only useEffect) can always read the latest value.
  const analysisStateRef = useRef<"idle" | "analyzing" | "complete">("idle")
  const [analysisState, setAnalysisState] = useState<"idle" | "analyzing" | "complete">("idle")
  // Keep the ref in sync on every render so stale closures always see the current value
  analysisStateRef.current = analysisState
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
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const abortPollingRef = useRef<(() => void) | null>(null)
  const [userTierInfo, setUserTierInfo] = useState<{ tier: string; dashboardUrl: string } | null>(null)
  const [showCommunityTeaser, setShowCommunityTeaser] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showCreditConfirmDialog, setShowCreditConfirmDialog] = useState(false)
  const [isUserVerified, setIsUserVerified] = useState<boolean | null>(null)
  const [creditConfirmData, setCreditConfirmData] = useState<{
    estimatedCredits: number
    currentBalance: number
    hasSufficientCredits: boolean
    freeQueueStatus?: FreeQueueStatus | null
    isFetchingFreeQueueStatus?: boolean
    freeQueueError?: FreeQueueSubmitError | null
    onConfirm: () => void
    onFreeQueueConfirm?: () => void
  } | null>(null)

  // Verdict tooltip state (chat-bubble shown after free verdict completes)
  const [showVerdictTooltip, setShowVerdictTooltip] = useState(false)
  const [verdictTooltipData, setVerdictTooltipData] = useState<{ verdict: string; reasoning: string } | null>(null)
  // Sentiment analysis state (triggered from tooltip CTA)
  const [isSentimentRunning, setIsSentimentRunning] = useState(false)
  const [isSentimentDone, setIsSentimentDone] = useState(false)
  const [tooltipSentimentSummary, setTooltipSentimentSummary] = useState<{ positive_pct: number; neutral_pct: number; negative_pct: number; dominant_sentiment?: string } | null>(null)
  // Silent credit cost estimates shown on sub-analysis TabCTA buttons
  const [subAnalysisCosts, setSubAnalysisCosts] = useState<Partial<Record<"claims" | "sentiment" | "topic" | "gaps" | "report" | "full", number | null>>>({})

  // PRO toggle mode: if true, completing a full analysis from toggle auto-opens the panel
  const openSidePanelAfterCompleteRef = useRef(false)
  // PRO sidepanel max-comments slider value (persisted to settings on change)
  const [proMaxComments, setProMaxComments] = useState<number>(200)
  // PRO toggle-area slider popover open state
  const [toggleSliderOpen, setToggleSliderOpen] = useState(false)
  const [toggleSliderLocal, setToggleSliderLocal] = useState<number>(200)

  // Extract video title and channel name from the YouTube page DOM
  const getPageVideoMeta = () => {
    const titleEl = document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ||
      document.querySelector("h1.title yt-formatted-string") ||
      document.querySelector("#title h1 yt-formatted-string")
    const videoTitle = titleEl?.textContent?.trim() || null

    const channelEl = document.querySelector("ytd-watch-metadata ytd-channel-name a") ||
      document.querySelector("ytd-video-owner-renderer ytd-channel-name a") ||
      document.querySelector("#owner #channel-name a") ||
      document.querySelector("yt-formatted-string#owner-name a")
    const channelName = channelEl?.textContent?.trim() || null

    return { videoTitle, channelName }
  }

  // Expose the current analysis on the window for quick debugging in DevTools.
  // Usage in page console: `__FG_VIDEO_ANALYSIS` or `__FG_VIDEO_ANALYSIS_SUMMARY`.
  useEffect(() => {
    try {
      ;(window as any).__FG_VIDEO_ANALYSIS = videoAnalysis
      ;(window as any).__FG_VIDEO_ANALYSIS_SUMMARY = videoAnalysis?.summary ?? null
    } catch (e) {
      // ignore
    }
  }, [videoAnalysis])

  // When the side panel opens (or analysis loads with no title), re-scrape the video title from the DOM.
  // YouTube's SPA may not have rendered the title when the initial analysis state was created.
  useEffect(() => {
    if (isSidePanelOpen && videoAnalysis && !videoAnalysis.videoTitle) {
      const meta = getPageVideoMeta()
      // Try DOM scrape first; fall back to document.title ("Title - YouTube" format).
      const domTitle = meta.videoTitle ||
        (document.title && document.title.endsWith(" - YouTube")
          ? document.title.replace(/ - YouTube$/, "").trim()
          : null)
      if (domTitle) {
        setVideoAnalysis((prev: any) => prev ? { ...prev, videoTitle: domTitle } : prev)
      }
    }
  }, [isSidePanelOpen, videoAnalysis?.videoTitle])

  // Silently fetch per-analysis credit cost estimates when analysis completes.
  useEffect(() => {
    if (analysisState === "complete" && currentVideoId) {
      fetchSubAnalysisCosts(currentVideoId)
    }
  }, [analysisState, currentVideoId])

  // Auto-open side panel when full analysis (triggered from toggle) completes
  useEffect(() => {
    if (analysisState === "complete" && openSidePanelAfterCompleteRef.current) {
      openSidePanelAfterCompleteRef.current = false
      setIsSidePanelOpen(true)
      setShowPreWatchPopover(false)
    }
  }, [analysisState])

  // Sync proMaxComments from settings whenever settings change
  useEffect(() => {
    const depth = settings?.videoAnalysis?.maxCommentDepth
    if (typeof depth === "number" && depth > 0) {
      setProMaxComments(depth)
      setToggleSliderLocal(depth)
    }
  }, [settings?.videoAnalysis?.maxCommentDepth])

  // Auto-run channel trust when sidepanel opens and trust data isn't available.
  useEffect(() => {
    if (isSidePanelOpen && currentVideoId && videoAnalysis && !videoAnalysis.channelTrust) {
      console.log("Comment Verdict: auto-fetching channel trust for sidepanel")
      FocusGuardAPI.analyzeChannelTrust(currentVideoId, false)
        .then((trustData) => {
          if (trustData) {
            setVideoAnalysis((prev: any) => prev ? {
              ...prev,
              channelTrust: trustData,
              channelName: prev.channelName || trustData.channel_name || null,
            } : prev)
          }
        })
        .catch((err) => console.warn("Auto channel trust fetch failed:", err))
    }
  }, [isSidePanelOpen, currentVideoId])

  useEffect(() => {
    // Check if we're on YouTube home page or watch page
    console.log("🎬 Comment Verdict content script loaded - settings:", settings);
    // Print build-time debug flag so we can confirm whether the bundle
    // was built with `COMMENT_VERDICT_DEBUG=1`.
    console.log("Comment Verdict BUILD_DEBUG=", BUILD_DEBUG)
    console.log("Comment Verdict RUNTIME_DEBUG=", RUNTIME_DEBUG, "DEBUG=", DEBUG)
    
    // Load user stats and analysis history
    loadUserStats()
    loadAnalysisHistory()

    // Eagerly load tier info so PRO UI (slider, toggle mode) shows without needing
    // to click the toggle button first
    ;(async () => {
      try {
        const isAuth = await AuthService.isAuthenticated()
        if (isAuth) {
          const subscription = await SubscriptionService.getSubscription()
          const tier = subscription.tier?.toLowerCase() || 'free'
          const dashboardUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
          setUserTierInfo({ tier, dashboardUrl })
        }
      } catch {}
    })()
    
    const checkPageType = () => {
      const isHome =
        window.location.pathname === "/" ||
        window.location.pathname === "/feed/subscriptions" ||
        window.location.pathname === "/feed/trending"

      // Only show UI on actual watch pages (regular videos and shorts)
      // Toggle button should ONLY appear on watch pages, not home/search/etc
      const isWatch = isWatchPage()

      setIsYouTubeHome(isHome)
      setOnWatchPage(isWatch)
      console.log("Comment Verdict checkPageType: isHome=", isHome, "isWatch=", isWatch, "href=", window.location.href)

      // FR-202: Auto-activate analysis on watch page
      if (isWatch) {
        // If URL contains lc= (opened via our "Go to Comment on YouTube" deeplink),
        // run our patient scroll-to-comment logic instead of relying on YouTube's
        // native handler which gives up ~7s after load on slow connections.
        scrollToLinkedComment()
        const videoId = getVideoIdFromUrl(window.location.href)
        console.log("Comment Verdict: detected videoId=", videoId, "currentVideoIdRef=", currentVideoIdRef.current)
        if (videoId && videoId !== currentVideoIdRef.current) {
          console.log("Comment Verdict: NEW VIDEO detected, resetting state")
          // Abort any ongoing polling from previous video
          if (abortPollingRef.current) {
            console.log("Aborting previous video's polling")
            abortPollingRef.current()
            abortPollingRef.current = null
          }
          currentVideoIdRef.current = videoId
          setCurrentVideoId(videoId)
          // NOTE: userTierInfo is intentionally NOT reset here — the user's
          // subscription tier doesn't change between videos and resetting it
          // causes the toggle button to flash back to a stale/default look
          // until the tier is re-fetched.
          
          // ALWAYS check cache first to update toggle button state
          // This is independent of auto-analyze setting
          console.log("Comment Verdict: Checking cache for new video...")
          try {
            checkCacheAndPrefetch(videoId)
          } catch (e) {
            console.error("Comment Verdict: Cache check failed", e)
          }
          
          // Check if auto-analyze is enabled (for starting actual analysis)
          const shouldAutoAnalyze = settings?.videoAnalysis?.autoAnalyze ?? false
          // Auto-run quick verdict when toggle default is Quick Verdict and auto-quick-verdict is enabled
          const toggleMode = settings?.videoAnalysis?.proToggleMode ?? 'free_verdict'
          const shouldAutoQuickVerdict = (settings?.videoAnalysis?.autoQuickVerdict ?? true) && toggleMode === 'free_verdict'
          if (!shouldAutoAnalyze && !shouldAutoQuickVerdict) {
            // Don't auto-analyze; just reset state and wait for user to click the button
            // (cache check above will update toggle if cached report exists)
            console.log("Comment Verdict: Auto-analyze disabled, waiting for user action")
            setAnalysisState("idle")
            setAnalysisError(null)
            setCurrentJobId(null)
            setProgressPercent(null)
            setProgressMessage(null)
          } else if (shouldAutoQuickVerdict && !shouldAutoAnalyze) {
            // Auto-run quick verdict for the new video
            console.log("Comment Verdict: Auto-running quick verdict for video", videoId)
            setAnalysisState("idle")
            setAnalysisError(null)
            setCurrentJobId(null)
            setProgressPercent(null)
            setProgressMessage(null)
            // Small delay to let the page settle before triggering.
            // Also re-check cache state: checkCacheAndPrefetch runs concurrently
            // and may have already loaded a cached verdict/sentiment by the time
            // this fires — in that case skip the free verdict to avoid redundant work.
            setTimeout(() => {
              if (currentVideoIdRef.current === videoId) {
                if (analysisStateRef.current === "complete") {
                  console.log("Comment Verdict: Skipping auto free verdict — cache already loaded results")
                  return
                }
                proceedWithFreeVerdict(videoId)
              }
            }, 1500)
          }
          // A new page is assumed to be unanalyzed for development. Reset
          // the pre-watch dismissed flag so the popover appears after
          // analysis completes on this new page.
          setPreWatchDismissed(false)
          setShowPreWatchPopover(false)
          setShowVerdictTooltip(false)
          setVerdictTooltipData(null)
          setIsSentimentRunning(false)
          setIsSentimentDone(false)
          setTooltipSentimentSummary(null)
        }
      } else {
        // User left watch page - abort any ongoing polling
        if (abortPollingRef.current) {
          console.log("User left watch page - aborting polling")
          abortPollingRef.current()
          abortPollingRef.current = null
        }
        currentVideoIdRef.current = null
        setCurrentVideoId(null)
        setVideoAnalysis(null)
        setAnalysisStatus(null)
        setAnalysisState("idle")
        setAnalysisError(null)
        setIsCached(null)
        setCurrentJobId(null)
        setProgressPercent(null)
        setProgressMessage(null)
        setIsSidePanelOpen(false)
        setShowPreWatchPopover(false)
        setPreWatchDismissed(false)
        setShowVerdictTooltip(false)
        setVerdictTooltipData(null)
        setIsSentimentRunning(false)
        setIsSentimentDone(false)
        setTooltipSentimentSummary(null)
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
    let lastCheckedUrl = window.location.href
    const urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href
      if (currentUrl !== lastCheckedUrl) {
        lastCheckedUrl = currentUrl
        console.log("Comment Verdict: URL polling detected navigation")
        checkPageType()
      }
    }, 500)

    // Optionally load user data for richer UI during development / debug
    loadUserStats()
    loadAnalysisHistory()
    // Load saved settings with defaults if not present
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(["settings"])
        if (result.settings) {
          setSettings(result.settings)
        } else {
          // Set default settings if none exist
          const defaultSettings: FocusGuardSettings = {
            isEnabled: true,
            videoAnalysis: {
              showPreWatchPopover: true,
              autoAnalyze: false,
              botDetectionEnabled: true,
              showCachedVerdict: false,
              confirmCreditUsage: true,
              maxCommentDepth: 100
            }
          }
          setSettings(defaultSettings)
          // Save defaults to storage
          await chrome.storage.sync.set({ settings: defaultSettings })
        }
      } catch (e) {
        console.error("Comment Verdict: Failed to load settings, using defaults", e)
        // Fallback to defaults even if storage fails
        setSettings({
          isEnabled: true,
          videoAnalysis: {
            showPreWatchPopover: true,
            autoAnalyze: false,
            botDetectionEnabled: true,
            showCachedVerdict: false,
            confirmCreditUsage: true,
            maxCommentDepth: 100
          }
        })
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
          // Distinguish a genuine login event (no previous token → new token) from
          // a routine background token rotation (old token → new token). Rotations
          // must never re-run analysis that is already displayed.
          const tokenChange = changes.focus_guard_access_token
          const isFreshLogin = tokenChange
            ? (!tokenChange.oldValue && !!tokenChange.newValue)
            : false  // focus_guard_user change — treat conservatively as non-login

          console.log("Comment Verdict: Auth storage changed, isFreshLogin=", isFreshLogin)
          loadUserStats()
          loadAnalysisHistory()

          if (isWatchPage()) {
            const activeVideoId = getVideoIdFromUrl(window.location.href)
            if (activeVideoId) {
              if (analysisStateRef.current === "analyzing") {
                console.log("Comment Verdict: ⏭️ Skipping cache recheck - analysis in progress")
              } else if (analysisStateRef.current === "complete") {
                // Results are already displayed – a token rotation must not wipe
                // them and re-fetch the same data all over again.
                console.log("Comment Verdict: ⏭️ Skipping cache recheck - analysis already complete")
              } else if (isFreshLogin) {
                // User just logged in from an unauthenticated state – load analysis.
                console.log("Comment Verdict: Fresh login detected, rechecking cache", activeVideoId)
                setIsCached(null)
                checkCacheAndPrefetch(activeVideoId)
              } else {
                console.log("Comment Verdict: ⏭️ Skipping cache recheck - token rotation, not a login")
              }
            }
          }
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
        console.log("Comment Verdict: User not authenticated, skipping stats load")
        setUserStats(null)
        return
      }

      const stats = await FocusGuardAPI.getUserStats()
      setUserStats(stats)
    } catch (error) {
      console.log("Comment Verdict: Failed to load user stats (user may not be logged in):", (error as any)?.message || String(error))
      // Set null if not authenticated
      setUserStats(null)
    }
  }

  const loadAnalysisHistory = async () => {
    try {
      // Check if authenticated first
      const isAuth = await AuthService.isAuthenticated()
      if (!isAuth) {
        console.log("Comment Verdict: User not authenticated, skipping history load")
        setAnalysisHistory([])
        return
      }

      const response = await FocusGuardAPI.getAnalysisHistory()
      setAnalysisHistory(response.history)
    } catch (error) {
      console.log("Comment Verdict: Failed to load analysis history (user may not be logged in):", (error as any)?.message || String(error))
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
      console.log("Comment Verdict: Failed to get subscription tier:", error)
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
    // GUARD: Don't interrupt if analysis is already in progress
    // Use the ref so we always get the correct current value (function may be called
    // from a stale closure such as the storage change handler or URL poll interval)
    if (analysisStateRef.current === "analyzing") {
      console.log("Comment Verdict: ⏭️ Skipping cache check - analysis already in progress")
      return
    }
    // GUARD: Results are already displayed for this video – do not re-fetch.
    // This prevents background token rotations or any other indirect caller from
    // wiping and re-loading the sentiment / clustering / topic-gap tabs while
    // the user is reading them. Only a manual force-refresh or a video navigation
    // should re-run analysis.
    if (analysisStateRef.current === "complete") {
      console.log("Comment Verdict: ⏭️ Skipping cache check - analysis already complete, no re-fetch until force refresh")
      return
    }
    
    setIsCheckingCache(true)
    try {
      console.log("Comment Verdict: checking cache on landing for video", videoId)
      const cacheStatus = await FocusGuardAPI.getCacheStatus(videoId)
      console.log("Comment Verdict: cache status on landing:", cacheStatus)
      setIsCached(cacheStatus.cached)

      if (!cacheStatus.cached) {
        // Not cached — check if free user with no credits
        // Show teaser if they're free tier with 0 credits
        if (userTierInfo?.tier === 'free') {
          try {
            const credits = await FocusGuardAPI.getCreditBalance()
            if (credits.credits_balance === 0) {
              console.log("Free user with 0 credits - showing teaser")
              setShowCommunityTeaser(true)
            }
          } catch (err) {
            console.warn("Failed to check credit balance:", err)
          }
        }

        // No snapshot cache — but a previous free verdict may exist.
        // Try to load it so returning visitors see their verdict immediately.
        try {
          const [cachedVerdict, cachedSentiment] = await Promise.all([
            FocusGuardAPI.getCachedFreeVerdict(videoId),
            FocusGuardAPI.getCachedFreeSentiment(videoId),
          ])

          if (cachedVerdict.has_verdict) {
            console.log("Comment Verdict: Found cached free verdict for returning visitor:", cachedVerdict.verdict)
            const verdict = (cachedVerdict.verdict || "UNKNOWN").toUpperCase()
            const reasoning = cachedVerdict.reasoning || ""
            const weightedComments = cachedVerdict.weighted_comments || []
            const totalCommentsInput = cachedVerdict.total_comments_input || 0

            // Derive trust score same way as proceedWithFreeVerdict
            const _verdictBases: Record<string, number> = {
              LEGIT: 7.5, DISPUTED: 5.0, MISLEADING: 2.5, CLICKBAIT: 3.5, DANGEROUS: 1.5,
            }
            const _verdictBase = _verdictBases[verdict] ?? 5.0
            const _avgWeighted = weightedComments.length > 0
              ? weightedComments.reduce((s: number, c: any) => s + (c.weighted_score ?? 0), 0) / weightedComments.length
              : 0
            const _scoreNudge = Math.max(-1, Math.min(1, _avgWeighted / 5))
            const derivedTrustScore = Math.max(0, Math.min(10,
              Math.round((_verdictBase + _scoreNudge) * 10) / 10
            ))

            const isAuth = await AuthService.isAuthenticated()
            // Fetch tier info if not yet loaded (reset on every video navigation)
            let userTier = userTierInfo?.tier
            let dashboardUrl = userTierInfo?.dashboardUrl || `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
            if (!userTier && isAuth) {
              try {
                const subscription = await SubscriptionService.getSubscription()
                userTier = subscription.tier?.toLowerCase() || 'free'
                setUserTierInfo({ tier: userTier, dashboardUrl })
              } catch (err) {
                console.warn("Comment Verdict: Failed to fetch subscription during cache load:", err)
                userTier = 'free'
              }
            }
            userTier = userTier || 'free'
            const isPro = userTier === 'pro'
            const proOnlyRestriction = (!isPro) ? {
              code: 'TIER_RESTRICTION' as const,
              required_tier: 'pro' as const,
              current_tier: userTier as 'pro' | 'free' | 'starter',
              message: 'This feature is available for Pro users only.',
              upgrade_url: dashboardUrl
            } : null

            // Build sentiment data from cache if available
            let sentimentData: any = null
            if (cachedSentiment.has_sentiment && cachedSentiment.distribution) {
              const csd = cachedSentiment.distribution as any
              sentimentData = {
                distribution: {
                  positive: csd.positive ?? csd.positive_count ?? 0,
                  neutral: csd.neutral ?? csd.neutral_count ?? 0,
                  negative: csd.negative ?? csd.negative_count ?? 0,
                  dominant: csd.dominant_sentiment ?? null,
                },
                filteringMetadata: cachedSentiment.filtering_metadata,
              }
              setIsSentimentDone(true)
              // Populate tooltip mini-bar from cached percentages
              if (csd.positive_pct != null || csd.neutral_pct != null || csd.negative_pct != null) {
                setTooltipSentimentSummary({
                  positive_pct: csd.positive_pct ?? 0,
                  neutral_pct: csd.neutral_pct ?? 0,
                  negative_pct: csd.negative_pct ?? 0,
                  dominant_sentiment: csd.dominant_sentiment ?? null,
                })
              }
            }

            const pageMeta = getPageVideoMeta()

            const videoAnalysisData = {
              videoId,
              videoTitle: pageMeta.videoTitle,
              videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
              channelName: pageMeta.channelName,
              snapshotShareCode: null,
              snapshotId: null,
              isFullyPublic: cachedVerdict.is_public ?? true,
              summary: {
                trustScore: derivedTrustScore,
                evidenceScore: 0,
                aiConfidence: derivedTrustScore,
                clickbaitVerdict: {
                  label: verdict,
                  confidence: derivedTrustScore * 10,
                  claims: [],
                  onLineSummary: reasoning,
                },
                channelCredibility: undefined,
                key_takeaways: [],
              },
              trustScore: { score: derivedTrustScore },
              clickbaitVerdict: { verdict },
              executiveSummary: reasoning,
              localVerdict: {
                verdict,
                reasoning,
                stage1_retained: cachedVerdict.stage1_retained || 0,
                stage2_top: cachedVerdict.stage2_top || 0,
                model_used: cachedVerdict.model_used || '',
                processing_time_seconds: cachedVerdict.processing_time_seconds || 0,
                total_comments_input: totalCommentsInput,
                weighted_comments: weightedComments,
              },
              maxCommentsRequested: null,
              actualCommentsFetched: totalCommentsInput,
              channelCredibility: undefined,
              sentiment: sentimentData,
              credibility: null,
              topicClusters: null,
              topicClustersData: undefined,
              contentGaps: proOnlyRestriction ? {
                botPercentage: 0,
                gapCoverageScore: undefined,
                botDetectionEnabled: true,
                unansweredQuestions: [],
                tierRestriction: proOnlyRestriction
              } : undefined,
              viewerInsights: proOnlyRestriction ? {
                tierRestriction: proOnlyRestriction
              } : undefined,
              reportInfo: {
                availableFormats: ["PDF", "TXT"],
                analysisDate: cachedVerdict.created_at || new Date().toISOString(),
                tierRestriction: proOnlyRestriction
              },
              separateAnalysis: true,
              isGuest: !isAuth,
            } as any

            // If individual analyses exist (clustering, gaps, etc.), merge them
            // into the free verdict data so they show up on page reload.
            if ((cacheStatus as any).has_individual_analyses) {
              const available = (cacheStatus as any).individual_analyses || {}
              console.log("Comment Verdict: Merging individual analyses into free verdict data...", available)
              try {
                const [sentimentResult, clusteringResult, gapsResult, trustResult] = await Promise.allSettled([
                  available.sentiment
                    ? FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false })
                    : Promise.resolve(null),
                  available.clustering
                    ? FocusGuardAPI.analyzeTopicClusteringV2(videoId, false)
                    : Promise.resolve(null),
                  available.gaps
                    ? FocusGuardAPI.analyzeTopicGapV2(videoId, false)
                    : Promise.resolve(null),
                  FocusGuardAPI.analyzeChannelTrust(videoId, false),
                ])
                const deepSentimentData = sentimentResult.status === 'fulfilled' ? sentimentResult.value : null
                const clusteringData = clusteringResult.status === 'fulfilled' ? clusteringResult.value : null
                const gapsData = gapsResult.status === 'fulfilled' ? gapsResult.value : null
                const trustData = trustResult.status === 'fulfilled' ? trustResult.value : null

                if (deepSentimentData) {
                  const posCount = typeof deepSentimentData.data.positive === 'number' ? deepSentimentData.data.positive : (deepSentimentData.data.positive?.count ?? 0)
                  const negCount = typeof deepSentimentData.data.negative === 'number' ? deepSentimentData.data.negative : (deepSentimentData.data.negative?.count ?? 0)
                  const neuCount = typeof deepSentimentData.data.neutral === 'number' ? deepSentimentData.data.neutral : (deepSentimentData.data.neutral?.count ?? 0)
                  videoAnalysisData.sentiment = {
                    overall: posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral",
                    distribution: {
                      positive: posCount,
                      neutral: neuCount,
                      negative: negCount,
                      totalCommentsAnalyzed: posCount + negCount + neuCount,
                      exampleComments: {
                        positive: typeof deepSentimentData.data.positive === 'object' ? deepSentimentData.data.positive?.top_comments ?? [] : [],
                        neutral: typeof deepSentimentData.data.neutral === 'object' ? deepSentimentData.data.neutral?.top_comments ?? [] : [],
                        negative: typeof deepSentimentData.data.negative === 'object' ? deepSentimentData.data.negative?.top_comments ?? [] : [],
                      },
                    },
                    filteringMetadata: deepSentimentData.filtering_metadata,
                  }
                  videoAnalysisData.viewerInsights = {
                    sentimentBreakdown: {
                      positive: posCount,
                      negative: negCount,
                      neutral: neuCount,
                      mixed: 0,
                      totalCommentsAnalyzed: posCount + negCount + neuCount,
                    },
                    actionableInsights: { highValue: [], improvements: [] },
                  }
                  // Allow SidePanel to show deep sentiment tab (requires separateAnalysis=false)
                  videoAnalysisData.separateAnalysis = false
                  setIsSentimentDone(true)
                }

                if (clusteringData) {
                  const cd = clusteringData as any
                  videoAnalysisData.topicClustersData = {
                    clusters: cd.topic_clusters || [],
                    parent_themes: cd.parent_themes || [],
                    hierarchy_map: cd.hierarchy_map || {},
                    total_parent_themes: cd.total_parent_themes || 0,
                    method: cd.method || 'unknown',
                    processing_time: cd.processing_time,
                  }
                }
                if (gapsData) {
                  videoAnalysisData.contentGaps = {
                    botPercentage: 0,
                    gapCoverageScore: gapsData.topic_gaps ? Math.max(0, 100 - (gapsData.topic_gaps.length * 10)) : 100,
                    botDetectionEnabled: true,
                    unansweredQuestions: (gapsData.topic_gaps || []).map((gap: any, idx: number) => {
                      const supportingComments = mapGapSupportingComments(gap, idx)
                      return {
                        id: `gap-${idx}`,
                        statement: gap.question_statement,
                        type: "issue" as const,
                        commentCount: supportingComments.length,
                        supportingComments,
                        isExpanded: false,
                      }
                    }),
                    filteringMetadata: gapsData.filtering_metadata,
                  }
                }
                if (trustData && 'trust_score' in trustData && 'metrics' in trustData) {
                  const hasStructuredMetrics = trustData.metrics && typeof trustData.metrics === 'object' &&
                    Object.values(trustData.metrics).some((v: any) => v && typeof v === 'object' && (v as any).score != null)
                  const hasStructuredDetails = trustData.metric_details && typeof trustData.metric_details === 'object' &&
                    Object.values(trustData.metric_details).some((v: any) => v && typeof v === 'object' && (v as any).score != null)
                  const metricsSource = hasStructuredMetrics ? trustData.metrics : hasStructuredDetails ? trustData.metric_details : {}
                  const factors = Object.entries(metricsSource)
                    .filter(([, m]: [string, any]) => m && typeof m === 'object' && (m as any).score != null)
                    .map(([name, metricData]: [string, any]) => ({
                      name,
                      weight: metricData.normalized_value ?? 0,
                      value: String(metricData.score),
                    }))
                  videoAnalysisData.channelCredibility = {
                    score: trustData.trust_score,
                    factors,
                    metrics: trustData.metrics,
                    trust_score: trustData.trust_score,
                    raw_metrics: trustData.raw_metrics,
                    metric_details: trustData.metric_details,
                  }
                }
              } catch (err) {
                console.warn("Comment Verdict: Failed to merge individual analyses into free verdict:", (err as any)?.message || String(err))
              }
            }

            setVideoAnalysis(videoAnalysisData)
            setAnalysisStatus({
              trustScore: derivedTrustScore,
              clickbaitVerdict: verdict as "LEGIT" | "MISLEADING" | "CLICKBAIT",
              isAnalyzing: false,
            })
            setAnalysisState("complete")

            // Show verdict tooltip for returning visitors
            setVerdictTooltipData({ verdict, reasoning })
            setShowVerdictTooltip(true)

            setIsCheckingCache(false)
            return
          }
        } catch (err) {
          console.log("Comment Verdict: No cached free verdict found (expected for fresh videos):", (err as any)?.message || String(err))
        }

        // If individual analyses exist (run without a full summary job), try loading
        // them so the user sees their results after a page reload.
        if ((cacheStatus as any).has_individual_analyses) {
          const available = (cacheStatus as any).individual_analyses || {}
          console.log("Comment Verdict: Found individual analyses (no snapshot), loading cached results...", available)
          try {
            const [sentimentResult, trustResult, clusteringResult, gapsResult] = await Promise.allSettled([
              available.sentiment
                ? FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false })
                : Promise.resolve(null),
              FocusGuardAPI.analyzeChannelTrust(videoId, false),
              available.clustering
                ? FocusGuardAPI.analyzeTopicClusteringV2(videoId, false)
                : Promise.resolve(null),
              available.gaps
                ? FocusGuardAPI.analyzeTopicGapV2(videoId, false)
                : Promise.resolve(null),
            ])

            const sentimentData = sentimentResult.status === 'fulfilled' ? sentimentResult.value : null
            const trustData = trustResult.status === 'fulfilled' ? trustResult.value : null
            const clusteringData = clusteringResult.status === 'fulfilled' ? clusteringResult.value : null
            const gapsData = gapsResult.status === 'fulfilled' ? gapsResult.value : null

            if (sentimentData || trustData || clusteringData || gapsData) {
              const pageTitle = (cacheStatus as any).title ||
                getPageVideoMeta().videoTitle ||
                (document.title && document.title.endsWith(" - YouTube")
                  ? document.title.replace(/ - YouTube$/, "").trim()
                  : null)

              // Build sentiment object
              let sentimentObj: any = undefined
              if (sentimentData) {
                const posCount = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
                const negCount = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
                const neuCount = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
                sentimentObj = {
                  overall: posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral",
                  distribution: {
                    positive: posCount,
                    neutral: neuCount,
                    negative: negCount,
                    totalCommentsAnalyzed: posCount + negCount + neuCount,
                    exampleComments: {
                      positive: typeof sentimentData.data.positive === 'object' ? sentimentData.data.positive?.top_comments ?? [] : [],
                      neutral: typeof sentimentData.data.neutral === 'object' ? sentimentData.data.neutral?.top_comments ?? [] : [],
                      negative: typeof sentimentData.data.negative === 'object' ? sentimentData.data.negative?.top_comments ?? [] : [],
                    },
                  },
                  filteringMetadata: sentimentData.filtering_metadata,
                }
                setIsSentimentDone(true)
              }

              // Build channel credibility from trust data
              let channelCredibilityObj: any = undefined
              if (trustData && 'trust_score' in trustData && 'metrics' in trustData) {
                const hasStructuredMetrics = trustData.metrics && typeof trustData.metrics === 'object' &&
                  Object.values(trustData.metrics).some((v: any) => v && typeof v === 'object' && (v as any).score != null)
                const hasStructuredDetails = trustData.metric_details && typeof trustData.metric_details === 'object' &&
                  Object.values(trustData.metric_details).some((v: any) => v && typeof v === 'object' && (v as any).score != null)
                const metricsSource = hasStructuredMetrics ? trustData.metrics : hasStructuredDetails ? trustData.metric_details : {}
                const factors = Object.entries(metricsSource)
                  .filter(([, m]: [string, any]) => m && typeof m === 'object' && (m as any).score != null)
                  .map(([name, metricData]: [string, any]) => ({
                    name,
                    weight: metricData.normalized_value ?? 0,
                    value: String(metricData.score),
                  }))
                channelCredibilityObj = {
                  score: trustData.trust_score,
                  factors,
                  metrics: trustData.metrics,
                  trust_score: trustData.trust_score,
                  raw_metrics: trustData.raw_metrics,
                  metric_details: trustData.metric_details,
                }
              }

              // Build topic clusters
              let topicClustersDataObj: any = undefined
              if (clusteringData) {
                const cd = clusteringData as any
                topicClustersDataObj = {
                  clusters: cd.topic_clusters || [],
                  parent_themes: cd.parent_themes || [],
                  hierarchy_map: cd.hierarchy_map || {},
                  total_parent_themes: cd.total_parent_themes || 0,
                  method: cd.method || 'unknown',
                  processing_time: cd.processing_time,
                }
              }

              // Build content gaps
              let contentGapsObj: any = undefined
              if (gapsData) {
                contentGapsObj = {
                  botPercentage: 0,
                  gapCoverageScore: gapsData.topic_gaps ? Math.max(0, 100 - (gapsData.topic_gaps.length * 10)) : 100,
                  botDetectionEnabled: true,
                  unansweredQuestions: (gapsData.topic_gaps || []).map((gap: any, idx: number) => {
                    const supportingComments = mapGapSupportingComments(gap, idx)
                    return {
                      id: `gap-${idx}`,
                      statement: gap.question_statement,
                      type: "issue" as const,
                      commentCount: supportingComments.length,
                      supportingComments,
                      isExpanded: false,
                    }
                  }),
                  filteringMetadata: gapsData.filtering_metadata,
                }
              }

              const dashUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
              const currentTier = userTierInfo?.tier || 'free'
              const isPro = currentTier === 'pro'
              const proOnlyRestriction = !isPro ? {
                code: 'TIER_RESTRICTION' as const,
                required_tier: 'pro' as const,
                current_tier: currentTier as 'pro' | 'free' | 'starter',
                message: 'This feature is available for Pro users only.',
                upgrade_url: dashUrl,
              } : null

              setVideoAnalysis({
                videoId,
                videoTitle: pageTitle,
                videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                channelName: (cacheStatus as any).channel_name || (trustData as any)?.channel_name || null,
                snapshotShareCode: null,
                snapshotId: null,
                isFullyPublic: false,
                summary: {
                  trustScore: 0,
                  evidenceScore: 0,
                  aiConfidence: 0,
                  clickbaitVerdict: {
                    label: 'UNKNOWN',
                    confidence: 0,
                    claims: [],
                    onLineSummary: null,
                  },
                  channelCredibility: undefined,
                  key_takeaways: [],
                },
                trustScore: { score: 0 },
                clickbaitVerdict: { verdict: 'UNKNOWN' },
                executiveSummary: null,
                maxCommentsRequested: null,
                actualCommentsFetched: null,
                channelCredibility: channelCredibilityObj,
                sentiment: sentimentObj,
                credibility: null,
                topicClusters: null,
                topicClustersData: topicClustersDataObj,
                contentGaps: contentGapsObj || (proOnlyRestriction ? {
                  botPercentage: 0,
                  gapCoverageScore: undefined,
                  botDetectionEnabled: true,
                  unansweredQuestions: [],
                  tierRestriction: proOnlyRestriction,
                } : undefined),
                viewerInsights: sentimentObj ? {
                  sentimentBreakdown: {
                    positive: sentimentObj.distribution.positive,
                    negative: sentimentObj.distribution.negative,
                    neutral: sentimentObj.distribution.neutral,
                    mixed: 0,
                    totalCommentsAnalyzed: sentimentObj.distribution.totalCommentsAnalyzed,
                  },
                  actionableInsights: { highValue: [], improvements: [] },
                } : (proOnlyRestriction ? { tierRestriction: proOnlyRestriction } : undefined),
                reportInfo: {
                  availableFormats: ["PDF", "TXT"],
                  analysisDate: new Date().toISOString(),
                  tierRestriction: proOnlyRestriction,
                },
                separateAnalysis: true,
                isHydratingSecondary: false,
              } as any)
              setAnalysisStatus({
                trustScore: 0,
                clickbaitVerdict: 'UNKNOWN' as any,
                isAnalyzing: false,
              })
              setAnalysisState("complete")
              setIsCheckingCache(false)
              return
            }
          } catch (err) {
            console.warn("Comment Verdict: Failed to load individual analyses on page load:", (err as any)?.message || String(err))
          }
        }

        // Leave defaults
        setAnalysisState("idle")
        setAnalysisStatus(null)
        setVideoAnalysis(null)
        setIsCheckingCache(false)
        return
      }

      // FAST PATH: Use the verdict already embedded in the cache-status response to
      // update the toggle button instantly — no extra network round-trip needed.
      // The full relevancy/summary fetch below still runs in the background to
      // populate the side panel with complete data.
      const snapVerdict = (cacheStatus.analysis_snapshot?.relevancy_verdict || "").toUpperCase() || null
      if (snapVerdict) {
        // Keep the toggle in analyzing mode until core relevancy data arrives,
        // so users don't see a placeholder verdict/confidence badge.
        console.log("Comment Verdict: Cached snapshot verdict found; keeping toggle in analyzing state until core results load:", snapVerdict)
      }

      // Cached - fetch all cached analyses from the READ-ONLY bundle endpoint.
      // GET /analyses/{videoId} NEVER triggers computation — safe to call on every
      // page load.  Returns 404 when not yet analysed (handled below as a throw).
      try {
        console.log("Comment Verdict: Fetching analysis data for cached video...")
        
        console.log("Comment Verdict: ⚡ Fetching cached analyses bundle (single call, no job trigger)...")
        const coreStartTime = Date.now()
        const bundleData = await FocusGuardAPI.getCachedAnalysesBundle(videoId)
        const coreDuration = ((Date.now() - coreStartTime) / 1000).toFixed(2)
        console.log(`Comment Verdict: ✅ Bundle fetched in ${coreDuration}s - IMMEDIATELY SHOWING RESULTS`)

        // Build compatibility shims so all downstream code remains unchanged.
        // Bundle relevancy → shape expected by relevancyData?.data.*
        const relevancyData = bundleData?.relevancy ? {
          status: "SUCCESS",
          data: {
            verdict: bundleData.relevancy.verdict,
            confidence_score: bundleData.relevancy.confidence_score,
            claims: bundleData.relevancy.claims || [],
            video_title: bundleData.video_title,
            one_line_summary: bundleData.relevancy.one_line_summary,
          }
        } : null

        // Bundle summary + top-level fields → shape expected by summaryData?.* and (summaryData as any)?.*
        const summaryData: any = bundleData ? {
          snapshot_id: bundleData.snapshot_id ?? null,
          share_code: bundleData.share_code ?? null,
          is_fully_public: false,            // resolved async below via getSnapshotMetadata
          summary_paragraph: bundleData.summary?.summary_paragraph ?? null,
          video_title: bundleData.video_title ?? null,
          key_takeaways: bundleData.summary?.key_takeaways ?? [],
          max_comments_requested: null,      // not stored in bundle
          actual_comments_fetched: null,     // not stored in bundle
          one_line_summary: bundleData.relevancy?.one_line_summary ?? null,
          clickbaitVerdict: { claims: bundleData.relevancy?.claims ?? [] }
        } : null

        let isFullyPublicSnapshot = false
        let publicReportBundle: any = null
        console.log("🔍 [prefetch] bundle snapshot hints:", {
          snapshot_id: summaryData?.snapshot_id,
          is_fully_public: summaryData?.is_fully_public,
          share_code: summaryData?.share_code
        })

        if (summaryData?.snapshot_id) {
          try {
            console.log(`🔍 [prefetch] Fetching snapshot metadata for snapshot_id ${summaryData.snapshot_id}...`)
            const snapshotMetadata = await FocusGuardAPI.getSnapshotMetadata(summaryData.snapshot_id)
            const metadata = (snapshotMetadata as any)?.snapshot_metadata || snapshotMetadata
            isFullyPublicSnapshot = metadata?.is_fully_public === true
            ;(summaryData as any).is_fully_public = isFullyPublicSnapshot
            console.log("🔍 [prefetch] is_fully_public from metadata:", isFullyPublicSnapshot)
          } catch (error) {
            console.warn("❌ [prefetch] Failed to fetch snapshot metadata for is_fully_public status:", error)
            try {
              const shareCode = (summaryData as any)?.share_code
              if (shareCode) {
                console.log(`🔍 [prefetch] Trying public report fallback via share_code ${shareCode}...`)
                const publicReport = await FocusGuardAPI.getPublicReportByShareToken(shareCode)
                publicReportBundle = publicReport
                const publicMeta = (publicReport as any)?.snapshot_metadata || publicReport
                isFullyPublicSnapshot = publicMeta?.is_fully_public === true
                ;(summaryData as any).is_fully_public = isFullyPublicSnapshot
                console.log("🔍 [prefetch] is_fully_public from public report fallback:", isFullyPublicSnapshot)
              }
            } catch (fallbackError) {
              console.warn("❌ [prefetch] Public report fallback failed:", fallbackError)
            }
          }
        } else {
          try {
            console.log(`🔍 [prefetch] No snapshot_id in summary, fetching snapshots by video_id ${videoId}...`)
            const snapshotList = await FocusGuardAPI.getSnapshotsByVideo(videoId)
            const snapshots = (snapshotList as any)?.snapshots || []
            const firstSnapshot = snapshots[0]
            if (firstSnapshot) {
              isFullyPublicSnapshot = firstSnapshot?.is_fully_public === true
              ;(summaryData as any).snapshot_id = (summaryData as any)?.snapshot_id ?? firstSnapshot?.snapshot_id
              ;(summaryData as any).is_fully_public = isFullyPublicSnapshot
              console.log("🔍 [prefetch] is_fully_public from snapshots/by-video:", isFullyPublicSnapshot, "snapshot_id:", (summaryData as any)?.snapshot_id)
            } else {
              console.warn("⚠️ [prefetch] snapshots/by-video returned empty list")
            }
          } catch (error) {
            console.warn("❌ [prefetch] Failed snapshots/by-video fallback for is_fully_public:", error)
            try {
              const shareCode = (summaryData as any)?.share_code
              if (shareCode) {
                console.log(`🔍 [prefetch] Trying public report fallback via share_code ${shareCode}...`)
                const publicReport = await FocusGuardAPI.getPublicReportByShareToken(shareCode)
                publicReportBundle = publicReport
                const publicMeta = (publicReport as any)?.snapshot_metadata || publicReport
                isFullyPublicSnapshot = publicMeta?.is_fully_public === true
                ;(summaryData as any).is_fully_public = isFullyPublicSnapshot
                console.log("🔍 [prefetch] is_fully_public from public report fallback:", isFullyPublicSnapshot)
              }
            } catch (fallbackError) {
              console.warn("❌ [prefetch] Public report fallback failed:", fallbackError)
            }
          }
        }
        
        if (!relevancyData) {
          // Snapshot exists but relevancy sub-analysis hasn't been run yet.
          // Fall back to the snapshot-level verdict stored in the cache-status
          // response, or use UNKNOWN so the toggle still appears.
          const fallbackVerdict = (cacheStatus.analysis_snapshot?.relevancy_verdict || "UNKNOWN").toUpperCase()
          console.log("Comment Verdict: ⚠️ No cached relevancy in bundle — using snapshot-level verdict:", fallbackVerdict)
        }
        
        // Process core data immediately for fast UI response
        // Fall back to snapshot-level verdict from cache-status when bundle has no relevancy
        const snapshotFallbackVerdict = (cacheStatus.analysis_snapshot?.relevancy_verdict || "UNKNOWN").toUpperCase()
        const verdictRaw = (relevancyData?.data.verdict || snapshotFallbackVerdict).toUpperCase()
        const confidenceRaw = typeof relevancyData?.data.confidence_score === "number" ? relevancyData.data.confidence_score : 0
        const confidenceNorm = normalizeConfidence(confidenceRaw)
        const confidencePercent = Math.round(confidenceNorm * 100)
        const verdictCertainty = Math.round(confidenceNorm * 10 * 10) / 10
        
        // Calculate evidence score from claims
        const claims = relevancyData?.data?.claims || []
        const evidenceScore = calculateEvidenceScore(claims)
        
        console.log("Comment Verdict: Verdicts from core data - certainty:", verdictCertainty, "evidence:", evidenceScore, "verdict:", verdictRaw)
        
        // BUILD AND DISPLAY CORE-DATA ANALYSIS IMMEDIATELY (spinner turns off here)
        const minimalSummary = {
          trustScore: verdictCertainty,
          evidenceScore: evidenceScore,
          aiConfidence: confidencePercent,
          clickbaitVerdict: {
            label: verdictRaw,
            confidence: confidencePercent,
            claims: relevancyData?.data?.claims || (summaryData as any)?.clickbaitVerdict?.claims || (summaryData as any)?.claims || [],
            onLineSummary: (summaryData as any)?.one_line_summary || (summaryData as any)?.onLineSummary
          },
          channelCredibility: undefined, // Will be populated from credibility data
          key_takeaways: (summaryData as any)?.key_takeaways || (summaryData as any)?.keyTakeaways || []
        }

        const initialTier = userTierInfo?.tier || 'free'
        const initialDashboardUrl = userTierInfo?.dashboardUrl || `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
        // Sentiment is now FREE for all users via local analysis.
        // Cloud-based detailed sentiment (via /jobs/analysis/sentiment) is PRO only.
        const initialSentimentTierRestriction = null
        const initialViewerInsightsTierRestriction = (!isFullyPublicSnapshot && initialTier !== 'pro') ? {
          code: 'TIER_RESTRICTION' as const,
          required_tier: 'pro' as const,
          current_tier: initialTier as 'pro' | 'free' | 'starter',
          message: 'Viewer Insights are available for Pro users only.',
          upgrade_url: initialDashboardUrl
        } : null
        const initialContentGapsTierRestriction = (!isFullyPublicSnapshot && initialTier !== 'pro') ? {
          code: 'TIER_RESTRICTION' as const,
          required_tier: 'pro' as const,
          current_tier: initialTier as 'pro' | 'free' | 'starter',
          message: 'Content Gaps analysis is available for Pro users only.',
          upgrade_url: initialDashboardUrl
        } : null
        const initialReportTierRestriction = (!isFullyPublicSnapshot && initialTier !== 'pro') ? {
          code: 'TIER_RESTRICTION' as const,
          required_tier: 'pro' as const,
          current_tier: initialTier as 'pro' | 'free' | 'starter',
          message: 'Report downloads are available for Pro users only. Upgrade to download detailed analysis reports.',
          upgrade_url: initialDashboardUrl
        } : null

        // Display core results immediately - NO MORE WAITING FOR SECONDARY DATA
        setVideoAnalysis({
          videoId: videoId,
          videoTitle: relevancyData?.data?.video_title || summaryData?.video_title || cacheStatus.title || null,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          channelName: (cacheStatus as any).channel_name || null,
          snapshotShareCode: summaryData?.share_code ?? null,
          snapshotId: summaryData?.snapshot_id ?? null,
          isFullyPublic: isFullyPublicSnapshot,
          summary: minimalSummary,
          trustScore: { score: verdictCertainty },
          clickbaitVerdict: { verdict: verdictRaw },
          executiveSummary: summaryData?.summary_paragraph ?? null,
          maxCommentsRequested: summaryData?.max_comments_requested ?? null,
          actualCommentsFetched: summaryData?.actual_comments_fetched ?? null,
          channelCredibility: undefined,
          sentiment: initialSentimentTierRestriction ? {
            tierRestriction: initialSentimentTierRestriction
          } : undefined,
          credibility: null,
          topicClusters: null,
          topicClustersData: undefined,
          contentGaps: initialContentGapsTierRestriction ? {
            botPercentage: 0,
            gapCoverageScore: undefined,
            botDetectionEnabled: true,
            unansweredQuestions: [],
            tierRestriction: initialContentGapsTierRestriction
          } : undefined,
          viewerInsights: initialViewerInsightsTierRestriction ? {
            tierRestriction: initialViewerInsightsTierRestriction
          } : undefined,
          reportInfo: {
            availableFormats: ["PDF", "TXT"],
            analysisDate: new Date().toISOString(),
            tierRestriction: initialReportTierRestriction
          },
          isHydratingSecondary: true,
        } as any)

        setAnalysisStatus({
          trustScore: verdictCertainty,
          clickbaitVerdict: verdictRaw as "LEGIT" | "MISLEADING" | "CLICKBAIT",
          isAnalyzing: false
        })

        setAnalysisState("complete")
        setIsCheckingCache(false)
        console.log("Comment Verdict: ✅ SPINNER OFF - Core analysis displayed in ~${coreDuration}s")

        // Secondary data is already in the bundle — resolve synchronously so downstream
        // processing remains unchanged (parseSecondaryResults and the .then handler run
        // as they did before, just with no extra network round-trips).
        // The bundle sentiment / trust / clustering / gaps shapes are fully compatible
        // with what each consumer expects.
        // Fall back to individual API endpoints when the bundle is missing a field —
        // this happens when snapshot.sentiment_analysis_id or video_data.channel_id is
        // not set even though the underlying records exist in the DB (common for
        // videos that were analyzed before the linkage columns were backfilled).
        console.log("Comment Verdict: ⚡ Resolving secondary data from bundle (fallback to endpoints when missing)...")
        const secondaryPromise = Promise.allSettled([
          // Always call analyzeSentimentV2 — same reason as channel trust: bundle uses
          // CachedSentiment.data which is the raw stored sentiment_data dict and may have
          // a different shape or be empty. The direct endpoint always returns a properly
          // typed SentimentResponseV2 from cache (no extra computation triggered).
          FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          // Always call analyzeChannelTrust — bundle trust.metrics is raw YouTube API data
          // (subscriber_count, view_count…), which has no .score/.normalized_value fields so
          // buildChannelCredibility produces empty factors.  The direct endpoint returns
          // ChannelTrustResponse.metrics as a proper per-metric breakdown with .score.
          FocusGuardAPI.analyzeChannelTrust(videoId, false),
          // Always call V2 endpoints for clustering/gaps — bundle only contains data when
          // linked to the snapshot. Individual analysis runs (no full summary) store results
          // in their own tables, which the V2 endpoints query by video_data_id directly.
          FocusGuardAPI.analyzeTopicClusteringV2(videoId, false),
          FocusGuardAPI.analyzeTopicGapV2(videoId, false)
        ])

        // Process secondary data in background WITHOUT blocking the spinner
        // Build helper functions for secondary data processing
        const parseSecondaryResults = (results: PromiseSettledResult<any>[]) => {
          const sentimentData = results[0]?.status === 'fulfilled' ? results[0].value : null
          const credibilityData = results[1]?.status === 'fulfilled' ? results[1].value : null
          const topicClustersData = results[2]?.status === 'fulfilled' ? results[2].value : null
          const topicGapsData = results[3]?.status === 'fulfilled' ? results[3].value : null

          let sentimentTierRestriction = null
          let topicClustersTierRestriction = null
          let topicGapsTierRestriction = null

          results.forEach((result, idx) => {
            if (result?.status === 'rejected') {
              const endpoints = ['sentiment', 'credibility', 'topicClusters', 'topicGaps']
              const error = result.reason
              if (error?.message !== 'Timeout') {
                console.warn(`Comment Verdict: failed to fetch ${endpoints[idx]}:`, error)
              }

              if (error && typeof error === 'object') {
                const detail = error.detail || (error.response && error.response.detail)
                if (detail && detail.code === 'TIER_RESTRICTION') {
                  console.log(`Comment Verdict: Tier restriction detected for ${endpoints[idx]}:`, detail)
                  if (idx === 0) sentimentTierRestriction = detail
                  if (idx === 2) topicClustersTierRestriction = detail
                  if (idx === 3) topicGapsTierRestriction = detail
                }
              }
            }
          })

          return {
            sentimentData,
            credibilityData,
            topicClustersData,
            topicGapsData,
            sentimentTierRestriction,
            topicClustersTierRestriction,
            topicGapsTierRestriction
          }
        }

        // Handle secondary data update in background (fires async, doesn't block)
        secondaryPromise.then(async (secondaryResults) => {
          // Check if user is still on the same video
          if (currentVideoIdRef.current !== videoId) {
            console.log("Comment Verdict: ⚠️ Video changed, skipping secondary data update")
            return
          }

          console.log("Comment Verdict: ✅ Secondary data arrived! Processing...")
          const parsedSecondary = parseSecondaryResults(secondaryResults as PromiseSettledResult<any>[])
          let sentimentData = parsedSecondary.sentimentData
          const credibilityData = parsedSecondary.credibilityData
          let topicClustersData = parsedSecondary.topicClustersData
          let topicGapsData = parsedSecondary.topicGapsData
          const humanLikenessData = null

          if (isFullyPublicSnapshot) {
            if (!publicReportBundle && (summaryData as any)?.share_code) {
              try {
                publicReportBundle = await FocusGuardAPI.getPublicReportByShareToken((summaryData as any).share_code)
                console.log("🔓 [prefetch] Loaded public report bundle during secondary hydration")
              } catch (error) {
                console.warn("❌ [prefetch] Failed loading public report bundle during secondary hydration:", error)
              }
            }

            const reportBundle = publicReportBundle
            const sentimentFromReport = reportBundle?.general_sentiment
            const topicClusteringFromReport = reportBundle?.topic_clustering
            const topicGapsFromReport = reportBundle?.topic_gaps

            if (!sentimentData && sentimentFromReport) {
              sentimentData = {
                data: sentimentFromReport?.data || sentimentFromReport,
                filtering_metadata: {
                  total_input: sentimentFromReport?.total_comments_input,
                  filtered_count: sentimentFromReport?.comments_after_filter
                }
              }
              console.log("🔓 [prefetch] Hydrated sentiment from public report bundle")
            }

            if (!topicClustersData && topicClusteringFromReport) {
              topicClustersData = {
                topic_clusters: topicClusteringFromReport?.topic_clusters || topicClusteringFromReport?.clusters || [],
                parent_themes: topicClusteringFromReport?.parent_themes || [],
                hierarchy_map: topicClusteringFromReport?.hierarchy_map || {},
                total_parent_themes: topicClusteringFromReport?.total_parent_themes || (topicClusteringFromReport?.parent_themes || []).length || 0,
                method: topicClusteringFromReport?.method || "public_report"
              }
              if ((topicClustersData as any)?.topic_clusters?.length > 0) {
                console.log("🔓 [prefetch] Hydrated topic clustering from public report bundle")
              }
            }

            if (!topicGapsData && Array.isArray(topicGapsFromReport)) {
              topicGapsData = {
                topic_gaps: topicGapsFromReport,
                filtering_metadata: {
                  filtered_question_count: topicGapsFromReport.length
                }
              }
              if (topicGapsFromReport.length > 0) {
                console.log("🔓 [prefetch] Hydrated topic gaps from public report bundle")
              }
            }
          }

          let sentimentTierRestriction: TierRestriction | null = parsedSecondary.sentimentTierRestriction
          let topicClustersTierRestriction: TierRestriction | null = parsedSecondary.topicClustersTierRestriction
          let topicGapsTierRestriction: TierRestriction | null = parsedSecondary.topicGapsTierRestriction

          // Get user tier for tier restrictions - FETCH if not cached to avoid defaulting to 'free'
          let userTier: string
          let dashboardUrl: string
          
          if (userTierInfo) {
            userTier = userTierInfo.tier
            dashboardUrl = userTierInfo.dashboardUrl
            console.log("Comment Verdict: Using cached tier info:", userTier)
          } else {
            console.log("Comment Verdict: ⚠️ Tier info not cached, fetching subscription...")
            try {
              const subscription = await SubscriptionService.getSubscription()
              userTier = subscription.tier?.toLowerCase() || 'free'
              dashboardUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
              // Cache for future use
              setUserTierInfo({ tier: userTier, dashboardUrl })
              console.log("Comment Verdict: ✅ Fetched tier:", userTier)
            } catch (err) {
              console.warn("Comment Verdict: Failed to fetch subscription, defaulting to 'free':", err)
              userTier = 'free'
              dashboardUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
            }
          }

          // Apply tier restrictions ONLY if backend didn't already send restriction AND user doesn't have access
          console.log("Comment Verdict: 🔐 Applying tier restrictions - userTier:", userTier, "restrictions from backend:", {
            sentiment: !!sentimentTierRestriction,
            topicClusters: !!topicClustersTierRestriction,
            topicGaps: !!topicGapsTierRestriction
          })
          
          // Sentiment is now FREE for all users via local sentiment analysis.
          // No tier restriction needed for basic sentiment.

          if (userTier !== 'pro' && !topicClustersTierRestriction) {
            console.log("Comment Verdict: 🚫 Blocking viewer insights for non-pro user (current:", userTier, ")")
            topicClustersTierRestriction = {
              code: 'TIER_RESTRICTION' as const,
              required_tier: 'pro' as const,
              current_tier: userTier as 'pro' | 'free' | 'starter',
              message: 'Viewer Insights are available for Pro users only.',
              upgrade_url: dashboardUrl
            }
          }

          if (userTier !== 'pro' && !topicGapsTierRestriction) {
            console.log("Comment Verdict: 🚫 Blocking content gaps for non-pro user (current:", userTier, ")")
            topicGapsTierRestriction = {
              code: 'TIER_RESTRICTION' as const,
              required_tier: 'pro' as const,
              current_tier: userTier as 'pro' | 'free' | 'starter',
              message: 'Content Gaps analysis is available for Pro users only.',
              upgrade_url: dashboardUrl
            }
          }

          if (isFullyPublicSnapshot) {
            console.log("🔓 [prefetch] Public snapshot detected, skipping tier restrictions")
            sentimentTierRestriction = null
            topicClustersTierRestriction = null
            topicGapsTierRestriction = null
          }
          
          console.log("Comment Verdict: 🔐 Final tier restrictions:", {
            sentiment: !!sentimentTierRestriction,
            topicClusters: !!topicClustersTierRestriction,
            topicGaps: !!topicGapsTierRestriction
          })

          // Build derived fields using helper functions
          const buildSentimentDistribution = (data: any) => {
            if (!data) return undefined
            const positiveCount = typeof data.data.positive === 'number' ? data.data.positive : (data.data.positive?.count ?? 0)
            const neutralCount = typeof data.data.neutral === 'number' ? data.data.neutral : (data.data.neutral?.count ?? 0)
            const negativeCount = typeof data.data.negative === 'number' ? data.data.negative : (data.data.negative?.count ?? 0)
            const analyzedTotal = positiveCount + neutralCount + negativeCount
            const positiveComments = typeof data.data.positive === 'object' ? data.data.positive?.top_comments ?? [] : []
            const neutralComments = typeof data.data.neutral === 'object' ? data.data.neutral?.top_comments ?? [] : []
            const negativeComments = typeof data.data.negative === 'object' ? data.data.negative?.top_comments ?? [] : []

            return {
              positive: positiveCount,
              neutral: neutralCount,
              negative: negativeCount,
              totalCommentsAnalyzed: analyzedTotal,
              exampleComments: { positive: positiveComments, neutral: neutralComments, negative: negativeComments }
            }
          }

          const buildSentimentFilteringMetadata = (data: any) => {
            if (!data) return undefined
            if (data.filtering_metadata) return data.filtering_metadata
            if (data.data?.excluded_count !== undefined) {
              const pos = typeof data.data.positive === 'number' ? data.data.positive : (data.data.positive?.count ?? 0)
              const neg = typeof data.data.negative === 'number' ? data.data.negative : (data.data.negative?.count ?? 0)
              const neu = typeof data.data.neutral === 'number' ? data.data.neutral : (data.data.neutral?.count ?? 0)
              const analyzedCount = pos + neg + neu
              const totalComments = data.data.total_comments ?? (analyzedCount + data.data.excluded_count)
              return {
                total_input: totalComments,
                filtered_count: analyzedCount
              }
            }
            return undefined
          }

          const buildChannelCredibility = (data: any) => {
            if (!data) return undefined
            if ('trust_score' in data && 'metrics' in data) {
              // Two possible sources for structured per-metric scores:
              //   ChannelTrustResponse  → data.metrics has { audience_reach, creator_authority, … }
              //                           each with { score, normalized_value }
              //   CachedTrust (bundle) → data.metrics = raw YouTube API object (no .score)
              //                          data.metric_details has the structured breakdown
              // Pick whichever field actually contains .score-shaped entries.
              const hasStructuredMetrics = data.metrics && typeof data.metrics === 'object' &&
                Object.values(data.metrics).some((v: any) => v && typeof v === 'object' && v.score != null)
              const hasStructuredDetails = data.metric_details && typeof data.metric_details === 'object' &&
                Object.values(data.metric_details).some((v: any) => v && typeof v === 'object' && v.score != null)
              const metricsSource = hasStructuredMetrics ? data.metrics : hasStructuredDetails ? data.metric_details : {}
              const factors = Object.entries(metricsSource)
                .filter(([, m]: [string, any]) => m && typeof m === 'object' && m.score != null)
                .map(([name, metricData]: [string, any]) => ({
                  name,
                  weight: metricData.normalized_value ?? 0,
                  value: String(metricData.score)
                }))
              return {
                score: data.trust_score,
                factors,
                metrics: data.metrics,
                trust_score: data.trust_score,
                raw_metrics: data.raw_metrics,
                metric_details: data.metric_details
              }
            }
            return {
              score: data.score,
              factors: data.normalized_factors ? Object.entries(data.normalized_factors).map(([name, weight]) => ({
                name,
                weight: weight as number,
                value: (data.factual_factors?.[name] ?? 'N/A') as string
              })) : []
            }
          }

          // Update video analysis with secondary data (only if not already populated)
          setVideoAnalysis(prev => {
            if (!prev || prev.videoId !== videoId) return prev
            
            // Check if data already exists to prevent unnecessary re-renders
            const hasExistingSentiment = prev.sentiment && prev.sentiment.distribution
            const hasExistingCredibility = prev.channelCredibility && prev.channelCredibility.score !== undefined
            const hasExistingTopicClusters = prev.topicClustersData && prev.topicClustersData.clusters && prev.topicClustersData.clusters.length > 0
            const hasExistingContentGaps = prev.contentGaps && prev.contentGaps.unansweredQuestions && prev.contentGaps.unansweredQuestions.length > 0
            
            // Check if we have ANY new data to add
            const hasNewSentiment = !hasExistingSentiment && sentimentData
            const hasNewCredibility = !hasExistingCredibility && credibilityData
            const hasNewTopicClusters = !hasExistingTopicClusters && topicClustersData
            const hasNewContentGaps = !hasExistingContentGaps && topicGapsData
            
            console.log("Comment Verdict: 🔄 Updating UI with secondary data...", {
              needsSentiment: hasNewSentiment,
              needsCredibility: hasNewCredibility,
              needsTopicClusters: hasNewTopicClusters,
              needsContentGaps: hasNewContentGaps
            })

            // Only build derived data if we actually need it
            const derivedSentimentDistribution = hasNewSentiment ? buildSentimentDistribution(sentimentData) : null
            const filteringMetadata = hasNewSentiment ? buildSentimentFilteringMetadata(sentimentData) : null
            
            // Build sentiment breakdown for donut chart (raw counts, not percentages) - only if needed
            const sentimentBreakdown = hasNewSentiment && sentimentData ? {
              positive: typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0),
              negative: typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0),
              neutral: typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0),
              mixed: 0,
              totalCommentsAnalyzed: (() => {
                const pos = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
                const neg = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
                const neu = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
                return sentimentData.data.total_comments ?? (pos + neg + neu)
              })()
            } : null
            
            // Only update fields that have new data
            const reportTierRestriction = isFullyPublicSnapshot
              ? null
              : userTier !== 'pro' ? {
              code: 'TIER_RESTRICTION' as const,
              required_tier: 'pro' as const,
              current_tier: userTier as 'pro' | 'free' | 'starter',
              message: 'Report downloads are available for Pro users only. Upgrade to download detailed analysis reports.',
              upgrade_url: dashboardUrl
            } : null

            const hasSentimentRestrictionUpdate = !!sentimentTierRestriction && !(prev.sentiment as any)?.tierRestriction
            const hasViewerRestrictionUpdate = !!topicClustersTierRestriction && !(prev.viewerInsights as any)?.tierRestriction
            const hasContentGapsRestrictionUpdate = !!topicGapsTierRestriction && !(prev.contentGaps as any)?.tierRestriction
            const hasReportRestrictionUpdate = !!reportTierRestriction && !(prev as any)?.reportInfo?.tierRestriction

            if (!hasNewSentiment && !hasNewCredibility && !hasNewTopicClusters && !hasNewContentGaps && !hasSentimentRestrictionUpdate && !hasViewerRestrictionUpdate && !hasContentGapsRestrictionUpdate && !hasReportRestrictionUpdate) {
              console.log("Comment Verdict: ⏭️ Skipping secondary data update - no new data or restriction updates")
              return { ...prev, isHydratingSecondary: false }
            }

            const updatedAnalysis: any = {
              ...prev,
              isHydratingSecondary: false,
              // Update channelName from credibility API response if not already set
              channelName: prev.channelName || (credibilityData as any)?.channel_name || prev.channelName,
              // Only update channelCredibility if we have new data
              channelCredibility: hasNewCredibility 
                ? buildChannelCredibility(credibilityData) 
                : prev.channelCredibility,
              // Only update sentiment if we have new data
              sentiment: hasNewSentiment && derivedSentimentDistribution ? {
                overall: (() => {
                  const posCount = typeof sentimentData!.data.positive === 'number' ? sentimentData!.data.positive : (sentimentData!.data.positive?.count ?? 0)
                  const negCount = typeof sentimentData!.data.negative === 'number' ? sentimentData!.data.negative : (sentimentData!.data.negative?.count ?? 0)
                  return posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral"
                })(),
                distribution: derivedSentimentDistribution,
                filteringMetadata: filteringMetadata,
                tierRestriction: sentimentTierRestriction || undefined
              } : (hasSentimentRestrictionUpdate ? {
                ...(prev.sentiment || {}),
                tierRestriction: sentimentTierRestriction || undefined
              } : prev.sentiment),
              // Only update viewerInsights if we have new data
              viewerInsights: hasNewSentiment && sentimentBreakdown ? {
                sentimentBreakdown: sentimentBreakdown,
                actionableInsights: (prev.viewerInsights && !Array.isArray(prev.viewerInsights)) ? prev.viewerInsights.actionableInsights : { highValue: [], improvements: [] },
                tierRestriction: topicClustersTierRestriction || undefined
              } : (hasViewerRestrictionUpdate ? {
                ...((prev.viewerInsights && !Array.isArray(prev.viewerInsights)) ? prev.viewerInsights : {}),
                tierRestriction: topicClustersTierRestriction || undefined
              } : prev.viewerInsights),
              // Only update topicClustersData if we have new data
              topicClustersData: hasNewTopicClusters ? {
                clusters: topicClustersData.topic_clusters || [],
                parent_themes: topicClustersData.parent_themes || [],
                hierarchy_map: topicClustersData.hierarchy_map || {},
                total_parent_themes: topicClustersData.total_parent_themes || 0,
                method: topicClustersData.method || 'unknown',
                processing_time: topicClustersData.processing_time
              } : prev.topicClustersData,
              // Only update contentGaps if we have new data
              contentGaps: hasNewContentGaps ? {
                botPercentage: 0,
                gapCoverageScore: topicGapsData?.topic_gaps ? Math.max(0, 100 - (topicGapsData.topic_gaps.length * 10)) : 100,
                botDetectionEnabled: true,
                unansweredQuestions: topicGapsData.topic_gaps?.map((gap: any, idx: number) => {
                  const supportingComments = mapGapSupportingComments(gap, idx)
                  return {
                    id: `gap-${idx}`,
                    statement: gap.question_statement,
                    type: "issue" as const,
                    commentCount: supportingComments.length,
                    supportingComments,
                    isExpanded: false
                  }
                }) || [],
                filteringMetadata: topicGapsData?.filtering_metadata,
                tierRestriction: topicGapsTierRestriction || undefined
              } : (hasContentGapsRestrictionUpdate ? {
                ...(prev.contentGaps || {
                  botPercentage: 0,
                  gapCoverageScore: undefined,
                  botDetectionEnabled: true,
                  unansweredQuestions: []
                }),
                tierRestriction: topicGapsTierRestriction || undefined
              } : prev.contentGaps),
              reportInfo: {
                ...(prev.reportInfo || {
                  availableFormats: ["PDF", "TXT"],
                  analysisDate: new Date().toISOString(),
                  tierRestriction: null
                }),
                tierRestriction: reportTierRestriction
              }
            }
            console.log("Comment Verdict: ✅ Secondary data update complete", {
              updatedSentiment: hasNewSentiment,
              updatedViewerInsights: hasNewSentiment,
              updatedTopicClusters: hasNewTopicClusters,
              updatedContentGaps: hasNewContentGaps
            })
            return updatedAnalysis
          })
        }).catch(err => {
          console.warn("Comment Verdict: Secondary data processing error:", err)
          setVideoAnalysis(prev => {
            if (!prev || prev.videoId !== videoId) return prev
            return {
              ...prev,
              isHydratingSecondary: false,
            }
          })
        })

      } catch (err) {
        // If the bundle endpoint returned 404 (no snapshot) even though cacheStatus.cached
        // was true, treat it as "not yet analyzed" and leave the toggle in idle state.
        const is404 = (err as any)?.status === 404 || String((err as any)?.message || err).includes("404") || String((err as any)?.detail || "").includes("No analysis found")
        if (is404) {
          console.log("Comment Verdict: Bundle 404 — snapshot not yet available despite cached=true, setting idle")
          setAnalysisState("idle")
          setAnalysisStatus(null)
          setVideoAnalysis(null)
        } else {
          console.warn("Comment Verdict: failed to fetch bundle on landing:", (err as any)?.message || String(err))
          // Don't reset state if we're currently polling a job
          if (!currentJobId) {
            setAnalysisState("idle")
            setAnalysisStatus(null)
            setVideoAnalysis(null)
          }
        }
        setIsCheckingCache(false)
      }
    } catch (error) {
      console.log("Comment Verdict: cache check failed on landing (likely unauthenticated):", (error as any)?.message || String(error))
      setIsCached(false)

      // Guest user path — getCacheStatus requires auth, so we end up here.
      // Still try to load a cached free verdict for returning guests.
      try {
        const videoId = currentVideoIdRef.current
        if (videoId) {
          const [cachedVerdict, cachedSentiment] = await Promise.all([
            FocusGuardAPI.getCachedFreeVerdict(videoId),
            FocusGuardAPI.getCachedFreeSentiment(videoId),
          ])

          if (cachedVerdict.has_verdict) {
            console.log("Comment Verdict: Found cached free verdict for returning guest:", cachedVerdict.verdict)
            const verdict = (cachedVerdict.verdict || "UNKNOWN").toUpperCase()
            const reasoning = cachedVerdict.reasoning || ""
            const weightedComments = cachedVerdict.weighted_comments || []
            const totalCommentsInput = cachedVerdict.total_comments_input || 0

            const _verdictBases: Record<string, number> = {
              LEGIT: 7.5, DISPUTED: 5.0, MISLEADING: 2.5, CLICKBAIT: 3.5, DANGEROUS: 1.5,
            }
            const _verdictBase = _verdictBases[verdict] ?? 5.0
            const _avgWeighted = weightedComments.length > 0
              ? weightedComments.reduce((s: number, c: any) => s + (c.weighted_score ?? 0), 0) / weightedComments.length
              : 0
            const _scoreNudge = Math.max(-1, Math.min(1, _avgWeighted / 5))
            const derivedTrustScore = Math.max(0, Math.min(10,
              Math.round((_verdictBase + _scoreNudge) * 10) / 10
            ))

            let sentimentData: any = null
            if (cachedSentiment.has_sentiment && cachedSentiment.distribution) {
              const csd = cachedSentiment.distribution as any
              sentimentData = {
                distribution: {
                  positive: csd.positive ?? csd.positive_count ?? 0,
                  neutral: csd.neutral ?? csd.neutral_count ?? 0,
                  negative: csd.negative ?? csd.negative_count ?? 0,
                  dominant: csd.dominant_sentiment ?? null,
                },
                filteringMetadata: cachedSentiment.filtering_metadata,
              }
              setIsSentimentDone(true)
              // Populate tooltip mini-bar from cached percentages
              if (csd.positive_pct != null || csd.neutral_pct != null || csd.negative_pct != null) {
                setTooltipSentimentSummary({
                  positive_pct: csd.positive_pct ?? 0,
                  neutral_pct: csd.neutral_pct ?? 0,
                  negative_pct: csd.negative_pct ?? 0,
                  dominant_sentiment: csd.dominant_sentiment ?? null,
                })
              }
            }

            const pageMeta = getPageVideoMeta()

            setVideoAnalysis({
              videoId,
              videoTitle: pageMeta.videoTitle,
              videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
              channelName: pageMeta.channelName,
              snapshotShareCode: null,
              snapshotId: null,
              isFullyPublic: cachedVerdict.is_public ?? true,
              summary: {
                trustScore: derivedTrustScore,
                evidenceScore: 0,
                aiConfidence: derivedTrustScore,
                clickbaitVerdict: {
                  label: verdict,
                  confidence: derivedTrustScore * 10,
                  claims: [],
                  onLineSummary: reasoning,
                },
                channelCredibility: undefined,
                key_takeaways: [],
              },
              trustScore: { score: derivedTrustScore },
              clickbaitVerdict: { verdict },
              executiveSummary: reasoning,
              localVerdict: {
                verdict,
                reasoning,
                stage1_retained: cachedVerdict.stage1_retained || 0,
                stage2_top: cachedVerdict.stage2_top || 0,
                model_used: cachedVerdict.model_used || '',
                processing_time_seconds: cachedVerdict.processing_time_seconds || 0,
                total_comments_input: totalCommentsInput,
                weighted_comments: weightedComments,
              },
              maxCommentsRequested: null,
              actualCommentsFetched: totalCommentsInput,
              channelCredibility: undefined,
              sentiment: sentimentData,
              credibility: null,
              topicClusters: null,
              topicClustersData: undefined,
              contentGaps: undefined,
              viewerInsights: undefined,
              reportInfo: {
                availableFormats: ["PDF", "TXT"],
                analysisDate: cachedVerdict.created_at || new Date().toISOString(),
                tierRestriction: null
              },
              separateAnalysis: true,
              isGuest: true,
            } as any)
            setAnalysisStatus({
              trustScore: derivedTrustScore,
              clickbaitVerdict: verdict as "LEGIT" | "MISLEADING" | "CLICKBAIT",
              isAnalyzing: false,
            })
            setAnalysisState("complete")
            setVerdictTooltipData({ verdict, reasoning })
            setShowVerdictTooltip(true)
            setIsCheckingCache(false)
            return
          }
        }
      } catch (freeErr) {
        console.log("Comment Verdict: No cached free verdict for guest:", (freeErr as any)?.message || String(freeErr))
      }

      // Don't reset state if we're currently polling a job - only reset if no active job
      if (!currentJobId) {
        setAnalysisState("idle")
        setAnalysisStatus(null)
        setVideoAnalysis(null)
      }
      setIsCheckingCache(false)
    }
  }

  const startVideoAnalysis = async (videoId: string, forceRefresh: boolean = false) => {
    // ── New Flow: Toggle button triggers FREE local verdict analysis ──
    // No credits required, no email verification needed, guests can use it.
    // Each additional analysis (sentiment, trust, clustering, etc.) is
    // triggered separately by the user from the side panel.
    //
    // PRO exception: if proToggleMode === "full_analysis", the toggle runs the
    // full credit-based summary generation pipeline instead.

    const isAuth = await AuthService.isAuthenticated()

    // For authenticated users, optionally check verification for PRO features
    // but DO NOT block free verdict generation
    if (isAuth) {
      try {
        const currentUser = await AuthService.getCurrentUser(true)
        const isVerified = currentUser?.is_verified !== false
        setIsUserVerified(isVerified)
      } catch (error) {
        console.warn("Failed to check verification status:", error)
      }

      // Cache tier info for later use (e.g. feature gating in side panel)
      // (will be resolved below when checking isPro, so nothing needed here)
    }

    // PRO full-analysis mode: run the credit-based summary pipeline
    // NOTE: We must use the locally-fetched tier (not userTierInfo state) because
    // setUserTierInfo above is async and won't be reflected in the closure yet.
    let resolvedTier = userTierInfo?.tier || 'free'
    if (isAuth && !userTierInfo) {
      // userTierInfo was null — we may have just set it above; re-read from subscription
      try {
        const sub = await SubscriptionService.getSubscription()
        resolvedTier = sub.tier?.toLowerCase() || 'free'
        const dashboardUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
        setUserTierInfo({ tier: resolvedTier, dashboardUrl })
      } catch {}
    }
    const isPro = resolvedTier === 'pro'
    const toggleMode = settings?.videoAnalysis?.proToggleMode ?? 'free_verdict'
    if (isPro && toggleMode === 'full_analysis') {
      openSidePanelAfterCompleteRef.current = true
      await startFullAnalysisWithCreditCheck(videoId, false)
      return
    }

    // Proceed directly — free verdict needs no credit check or confirmation dialog
    proceedWithFreeVerdict(videoId)
  }

  /**
   * Credit-check wrapper for full analysis, used when the toggle button
   * is in PRO "full analysis" mode. Shows the credit confirmation dialog
   * (if enabled) then calls proceedWithAnalysis.
   */
  const startFullAnalysisWithCreditCheck = async (videoId: string, forceRefresh: boolean) => {
    try {
      const isAuth = await AuthService.isAuthenticated()
      if (!isAuth) {
        const portalUrl = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"
        window.open(`${portalUrl}/login`, '_blank')
        openSidePanelAfterCompleteRef.current = false
        return
      }

      // Read fresh settings from storage so slider value is current
      let freshSettings = settings
      try {
        const result = await chrome.storage.sync.get(["settings"])
        freshSettings = result.settings || settings
      } catch {}

      // Skip credit dialog if the user turned off confirmations
      if (freshSettings?.videoAnalysis?.confirmCreditUsage === false) {
        proceedWithAnalysis(videoId, forceRefresh)
        return
      }

      const credits = await FocusGuardAPI.getCreditBalance()
      // Mirror the exact formula used in proceedWithAnalysis so the estimate matches what will actually be requested
      const tier = userTierInfo?.tier || 'free'
      const settingsMaxComments = freshSettings?.videoAnalysis?.maxCommentDepth || 100
      const commentCount = tier === 'pro' ? settingsMaxComments : Math.min(settingsMaxComments, 300)
      const estimate = await FocusGuardAPI.estimateCreditCost(commentCount, "full_analysis", videoId)
      const estimatedCredits = estimate.estimated_credits
      const hasSufficient = credits.credits_balance >= estimatedCredits

      setCreditConfirmData({
        estimatedCredits,
        currentBalance: credits.credits_balance,
        hasSufficientCredits: hasSufficient,
        onConfirm: () => {
          setShowCreditConfirmDialog(false)
          setCreditConfirmData(null)
          proceedWithAnalysis(videoId, forceRefresh)
        },
      })
      setShowCreditConfirmDialog(true)
    } catch (err) {
      console.warn("Failed to check credits for toggle full analysis:", err)
      // Fall back to running directly
      proceedWithAnalysis(videoId, forceRefresh)
    }
  }

  /**
   * New primary analysis flow: Submit a FREE local verdict job.
   * Works for both authenticated users and guests.
   * No credits consumed. Progress polling shows stage-by-stage updates.
   */
  const proceedWithFreeVerdict = async (videoId: string) => {
    setIsAnalyzing(true)
    setAnalysisState("analyzing")
    setAnalysisStatus(null)
    setVideoAnalysis(null)
    setAnalysisError(null)
    setProgressPercent(null)
    setProgressMessage(null)

    try {
      const analysisStartTime = Date.now()
      console.log("Starting FREE local verdict analysis for:", videoId)

      // Submit free verdict job (works for guests and auth users)
      // Server enforces le=500 for free-queue jobs; clamp here to avoid 422.
      const FREE_VERDICT_MAX = 500
      const requestedDepth = userTierInfo?.tier === 'free' ? 100 : (settings?.videoAnalysis?.maxCommentDepth || 200)
      const jobResponse = await FocusGuardAPI.submitFreeVerdict({
        video_id: videoId,
        is_public: true,
        max_comments: Math.min(requestedDepth, FREE_VERDICT_MAX),
      })
      console.log("Free verdict job submitted:", jobResponse)
      const jobId = jobResponse.job_id
      setCurrentJobId(jobId)

      // Create abort controller for polling
      const abortController = new AbortController()
      abortPollingRef.current = () => abortController.abort()

      // Poll job status with progress updates
      const pollStartTime = Date.now()
      const jobResult = await FocusGuardAPI.pollFreeJob(
        jobId,
        (status) => {
          const elapsed = ((Date.now() - pollStartTime) / 1000).toFixed(1)
          console.log(`[${elapsed}s] Verdict progress:`, status.progress_percent, "%", status.progress_message)
          setProgressPercent(status.progress_percent)
          setProgressMessage(status.progress_message || null)
        },
        1000, // Poll every 1s
        abortController.signal
      )

      abortPollingRef.current = null
      const pollDuration = ((Date.now() - pollStartTime) / 1000).toFixed(1)
      console.log(`✅ Verdict job completed in ${pollDuration}s:`, jobResult)

      // Extract verdict result data
      const resultData = jobResult.result_data
      const verdict = (resultData?.verdict || "UNKNOWN").toUpperCase()
      const reasoning = resultData?.reasoning || ""
      const weightedComments = resultData?.weighted_comments || []
      const totalCommentsInput = resultData?.total_comments_input || 0

      // Compute a trust score (0-10) derived from the verdict + cross-encoder scores.
      // The free pipeline has no separate confidence metric, so we derive one:
      //   Verdict sets the band; avg weighted_score nudges ±1 point within it.
      const _verdictBases: Record<string, number> = {
        LEGIT: 7.5, DISPUTED: 5.0, MISLEADING: 2.5, CLICKBAIT: 3.5, DANGEROUS: 1.5,
      }
      const _verdictBase = _verdictBases[verdict] ?? 5.0
      const _avgWeighted = weightedComments.length > 0
        ? weightedComments.reduce((s: number, c: any) => s + (c.weighted_score ?? 0), 0) / weightedComments.length
        : 0
      // Raw scores typically range -5 to +5; normalise to a ±1 nudge
      const _scoreNudge = Math.max(-1, Math.min(1, _avgWeighted / 5))
      const derivedTrustScore = Math.max(0, Math.min(10,
        Math.round((_verdictBase + _scoreNudge) * 10) / 10
      ))

      // Determine user tier for feature gating in side panel
      const userTier = userTierInfo?.tier || 'free'
      const dashboardUrl = userTierInfo?.dashboardUrl || `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
      const isAuth = await AuthService.isAuthenticated()
      const isPro = userTier === 'pro'

      // Build tier restrictions for PRO-only features
      const proOnlyRestriction = (!isPro) ? {
        code: 'TIER_RESTRICTION' as const,
        required_tier: 'pro' as const,
        current_tier: userTier as 'pro' | 'free' | 'starter',
        message: 'This feature is available for Pro users only.',
        upgrade_url: dashboardUrl
      } : null

      // Build video analysis data from verdict result
      const pageMeta = getPageVideoMeta()
      const videoAnalysisData = {
        videoId,
        videoTitle: pageMeta.videoTitle,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        channelName: pageMeta.channelName,
        snapshotShareCode: null,
        snapshotId: null,
        isFullyPublic: resultData?.is_public ?? true,
        summary: {
          trustScore: derivedTrustScore,
          evidenceScore: 0,
          aiConfidence: derivedTrustScore,
          clickbaitVerdict: {
            label: verdict,
            confidence: derivedTrustScore * 10,
            claims: [],
            onLineSummary: reasoning,
          },
          channelCredibility: undefined,
          key_takeaways: [],
        },
        trustScore: { score: derivedTrustScore },
        clickbaitVerdict: { verdict },
        executiveSummary: reasoning,
        // Verdict-specific data
        localVerdict: {
          verdict,
          reasoning,
          stage1_retained: resultData?.stage1_retained || 0,
          stage2_top: resultData?.stage2_top || 0,
          model_used: resultData?.model_used || '',
          processing_time_seconds: resultData?.processing_time_seconds || 0,
          total_comments_input: totalCommentsInput,
          weighted_comments: weightedComments,
        },
        maxCommentsRequested: null,
        actualCommentsFetched: totalCommentsInput,
        channelCredibility: undefined,
        // Sentiment: available for free but needs separate trigger
        sentiment: null,
        credibility: null,
        topicClusters: null,
        topicClustersData: undefined,
        // PRO-only features show upgrade prompts
        contentGaps: proOnlyRestriction ? {
          botPercentage: 0,
          gapCoverageScore: undefined,
          botDetectionEnabled: true,
          unansweredQuestions: [],
          tierRestriction: proOnlyRestriction
        } : undefined,
        viewerInsights: proOnlyRestriction ? {
          tierRestriction: proOnlyRestriction
        } : undefined,
        reportInfo: {
          availableFormats: ["PDF", "TXT"],
          analysisDate: new Date().toISOString(),
          tierRestriction: proOnlyRestriction
        },
        // Flags for UI to show "Run analysis" buttons
        separateAnalysis: true,
        isGuest: !isAuth,
      } as any

      setVideoAnalysis(videoAnalysisData)
      setAnalysisStatus({
        trustScore: derivedTrustScore,
        clickbaitVerdict: verdict as "LEGIT" | "MISLEADING" | "CLICKBAIT",
        isAnalyzing: false,
      })
      setAnalysisState("complete")
      setCurrentJobId(null)

      const totalDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(1)
      console.log(`✅ Free verdict analysis completed in ${totalDuration}s: ${verdict}`)

      // Show verdict chat-bubble tooltip (replaces PreWatchPopover)
      setVerdictTooltipData({ verdict, reasoning })
      setShowVerdictTooltip(true)
      setIsSentimentDone(false)
      setIsSentimentRunning(false)

    } catch (error) {
      console.error("Free verdict analysis failed:", error)

      if (error instanceof Error && error.message === "Polling aborted") {
        console.log("Polling aborted due to video switch — expected")
        setAnalysisState("idle")
        setCurrentJobId(null)
        return
      }

      let errorMessage = "Analysis failed"
      if (error instanceof Error) {
        const msg = error.message.toLowerCase()
        if (msg.includes("daily limit") || msg.includes("5 analyses")) {
          // Show verdict tooltip with register CTA instead of error state
          setVerdictTooltipData({
            verdict: "limit_reached" as any,
            reasoning: "You've used all 5 free verdicts today. Register for a free account to get unlimited verdicts!"
          })
          setShowVerdictTooltip(true)
          setAnalysisState("idle")
          setCurrentJobId(null)
          return
        } else if (msg.includes("context invalidated")) {
          errorMessage = "Refresh page to continue"
        } else if (msg.includes("llm judge") || msg.includes("heuristic") || msg.includes("ollama")) {
          errorMessage = "AI judge busy — tap to retry"
        } else if (msg.includes("network") || msg.includes("connection")) {
          errorMessage = "Network error — retry later"
        } else if (msg.includes("timeout") || msg.includes("timed out")) {
          errorMessage = "Timed out — tap to retry"
        } else {
          const trimmed = error.message.trim()
          errorMessage = trimmed.length > 55 ? `${trimmed.slice(0, 52)}…` : trimmed || "Analysis failed — tap to retry"
        }
      }

      setAnalysisError(errorMessage)
      setAnalysisState("idle")
      setCurrentJobId(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── Silent credit cost estimation for sub-analysis TabCTA buttons ──
  // Fetches estimates for claims/topic/gaps/report and stores them so each
  // button can show "Run X Analysis (N credit)" without blocking the UI.
  // overrideMaxDepth: when provided (from the sidepanel slider), use this
  // depth for all estimates instead of reading from settings/actual count.
  const fetchSubAnalysisCosts = async (videoId: string, overrideMaxDepth?: number) => {
    try {
      const isAuth = await AuthService.isAuthenticated()
      if (!isAuth) return // Cost estimates require auth; guests see no suffix

      // Use actual fetched comment count when available (most accurate),
      // otherwise fall back to tier-based max depth as a rough estimate.
      const actualCount = videoAnalysis?.actualCommentsFetched
      const tierMax = userTierInfo?.tier === 'free' ? 100 : (settings?.videoAnalysis?.maxCommentDepth || 200)
      const commentDepth = overrideMaxDepth ?? (actualCount && actualCount > 0 ? actualCount : tierMax)

      const entries: Array<[keyof typeof subAnalysisCosts, string]> = [
        ["claims", "relevancy_analysis"],
        ["sentiment", "sentiment_analysis"],
        ["topic",  "topic_clustering"],
        ["gaps",   "topic_gap_analysis"],
        ["report", "summary_generation"],
        ["full",   "full_analysis"],
      ]

      const results = await Promise.allSettled(
        entries.map(([key, analysisType]) =>
          FocusGuardAPI.estimateCreditCost(commentDepth, analysisType, videoId)
            .then(res => ({ key, cost: res.estimated_credits }))
        )
      )

      const costs: typeof subAnalysisCosts = {}
      results.forEach(r => {
        if (r.status === "fulfilled") {
          costs[r.value.key] = r.value.cost
        }
      })
      setSubAnalysisCosts(costs)
    } catch (err) {
      console.log("Comment Verdict: sub-analysis cost fetch skipped:", (err as any)?.message)
    }
  }

  // ── Free sentiment analysis (triggered from VerdictTooltip CTA) ──
  const triggerFreeSentiment = async () => {
    if (!currentVideoId || isSentimentRunning || isSentimentDone) return
    setIsSentimentRunning(true)
    setProgressPercent(0)
    setProgressMessage("Starting sentiment…")
    try {
      // Use the same slider value as the verdict, clamped to the server cap
      const FREE_SENTIMENT_MAX = 500
      const requestedDepth = userTierInfo?.tier === 'free' ? 100 : toggleSliderLocal
      const jobResponse = await FocusGuardAPI.submitFreeSentiment({
        video_id: currentVideoId,
        is_public: true,
        max_comments: Math.min(requestedDepth, FREE_SENTIMENT_MAX),
      })
      console.log("Free sentiment job submitted:", jobResponse)
      const jobId = jobResponse.job_id

      const abortController = new AbortController()
      const jobResult = await FocusGuardAPI.pollFreeJob(
        jobId,
        (status) => {
          console.log(`Sentiment progress: ${status.progress_percent}%`, status.progress_message)
          setProgressPercent(status.progress_percent)
          setProgressMessage(status.progress_message || null)
        },
        1000,
        abortController.signal
      )
      console.log("✅ Free sentiment completed:", jobResult)

      // Merge sentiment data into existing videoAnalysis
      const sentimentResult = jobResult.result_data
      const sentimentSummary = sentimentResult?.sentiment_summary ?? null
      if (sentimentResult && videoAnalysis) {
        const updatedAnalysis = {
          ...videoAnalysis,
          sentiment: {
            distribution: sentimentSummary ? {
              positive: sentimentSummary.positive_count ?? 0,
              neutral: sentimentSummary.neutral_count ?? 0,
              negative: sentimentSummary.negative_count ?? 0,
              dominant: sentimentSummary.dominant_sentiment ?? null,
              total: (sentimentSummary.positive_count ?? 0) + (sentimentSummary.neutral_count ?? 0) + (sentimentSummary.negative_count ?? 0),
            } : sentimentResult,
            filteringMetadata: sentimentResult.filtering_metadata,
          },
        }
        setVideoAnalysis(updatedAnalysis as any)
      }
      // Store summary so the tooltip can display the mini distribution
      if (sentimentSummary) {
        setTooltipSentimentSummary({
          positive_pct: sentimentSummary.positive_pct ?? 0,
          neutral_pct: sentimentSummary.neutral_pct ?? 0,
          negative_pct: sentimentSummary.negative_pct ?? 0,
          dominant_sentiment: sentimentSummary.dominant_sentiment,
        })
      }
      setIsSentimentDone(true)
    } catch (error) {
      console.error("Free sentiment failed:", error)
    } finally {
      setProgressPercent(null)
      setProgressMessage(null)
      setIsSentimentRunning(false)
    }
  }

  // ── Legacy: Full summary generation (PRO users, credit-based) ──
  // Kept for users who want the comprehensive summary with all analyses.
  const proceedWithAnalysis = async (
    videoId: string,
    forceRefresh: boolean = false,
    usingFreeQueue: boolean = false,
    freeQueueStatusAtSubmit: FreeQueueStatus | null = null
  ) => {
    setIsAnalyzing(true)
    setAnalysisState("analyzing")
    setAnalysisStatus(null)
    // Only clear video analysis if NOT force refreshing (keep old data visible during refresh)
    if (!forceRefresh) {
      setVideoAnalysis(null)
    }
    setAnalysisError(null)

    try {
      const analysisStartTime = Date.now()
      console.log("Starting video analysis for:", videoId)
      
      // Ensure settings are loaded before proceeding - always load fresh from storage
      // so newly changed maxCommentDepth is applied immediately.
      let currentSettings = settings
      try {
        const result = await chrome.storage.sync.get(["settings"])
        currentSettings = result.settings || currentSettings
        if (currentSettings) {
          setSettings(currentSettings)
        }
      } catch (error) {
        console.warn("⚠️ Failed loading fresh settings from storage, using in-memory settings:", error)
      }
      console.log("📋 Current settings for analysis:", currentSettings)
      
      // Check authentication before starting
      console.log("Checking authentication before analysis...")
      const isAuth = await AuthService.isAuthenticated()
      console.log("Authentication check result:", isAuth)
      
      if (!isAuth) {
        throw new Error("Not authenticated. Please log in to analyze videos.")
      }
      
      // Fetch user tier info early and store in local variable (state updates are async!)
      let currentTier = userTierInfo?.tier || 'free'
      if (!userTierInfo) {
        console.log("⏱️ Fetching subscription tier early (parallel with job)...")
        const tierFetchStart = Date.now()
        try {
          const subscription = await SubscriptionService.getSubscription()
          currentTier = subscription.tier?.toLowerCase() || 'free'
          const dashboardUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
          const tierFetchDuration = ((Date.now() - tierFetchStart) / 1000).toFixed(1)
          console.log(`✅ Subscription tier fetched early in ${tierFetchDuration}s: ${currentTier}`)
          setUserTierInfo({ tier: currentTier, dashboardUrl })
        } catch (error) {
          console.warn("Failed to fetch tier info early, will retry later:", error)
          currentTier = 'free'
        }
      }
      
      // Step 1: Check cache status
      console.log("Checking cache status...")
      const cacheCheckStart = Date.now()
      const cacheStatus = await FocusGuardAPI.getCacheStatus(videoId)
      const cacheCheckDuration = ((Date.now() - cacheCheckStart) / 1000).toFixed(2)
      // Treat as not cached if force refreshing
      const shouldUseCache = cacheStatus.cached && !forceRefresh
      setIsCached(shouldUseCache)
      console.log(`Cache status (${cacheCheckDuration}s):`, cacheStatus, `force_refresh=${forceRefresh}, using_cache=${shouldUseCache}`)

      let relevancyData
      let sentimentData = null
      let summaryData = null
      let credibilityData = null
      let humanLikenessData = null
      let topicClustersData = null
      let topicGapsData = null
      let sentimentTierRestriction: TierRestriction | null = null
      let topicClustersTierRestriction: TierRestriction | null = null
      let topicGapsTierRestriction: TierRestriction | null = null
      let resultData = null // Store job result data for comment count tracking
      let cd: any = {} // comprehensive_data extracted from job result (or result_data fallback)
      // Track whether channel-trust was already attempted and failed in the fallback
      // path so the "remaining data" block never issues a redundant retry that can
      // hang indefinitely on a slow/overloaded server (causing the spinner to freeze
      // at 100% and ultimately a spurious "failed to fetch relevancy" error).
      let credibilityAttempted = false

      if (!shouldUseCache) {
        // Step 2a: Not cached - check for existing job or submit new one
        let jobId: string
        
        // Check if there's already a running job for this video
        const runningJobCheck = await FocusGuardAPI.checkForRunningJobs(videoId, "summary")
        
        if (runningJobCheck.shouldWait && runningJobCheck.existingJobId) {
          console.log("Found existing running job, resuming polling:", runningJobCheck.existingJobId)
          jobId = runningJobCheck.existingJobId
          setCurrentJobId(jobId)
        } else {
          const settingsMaxComments = currentSettings?.videoAnalysis?.maxCommentDepth || 100
          // Enforce tier-based limits: starter capped at 300, PRO can go higher
          const maxComments = currentTier === 'pro' ? settingsMaxComments : Math.min(settingsMaxComments, 300)
          console.log(`📊 Submitting summary job: video_id=${videoId}, force_refresh=${forceRefresh}, max_comments=${maxComments}`)
          console.log(`📊 Settings breakdown: maxCommentDepth=${currentSettings?.videoAnalysis?.maxCommentDepth}, tier=${currentTier}, enforced_max=${maxComments}`)
          const jobResponse = await FocusGuardAPI.submitSummaryJob({
            video_id: videoId,
            force_refresh: forceRefresh,
            max_comments: maxComments
          })
          console.log("Job submitted:", jobResponse)
          jobId = jobResponse.job_id
          setCurrentJobId(jobId)
        }

        // Create abort controller for this polling operation
        const abortController = new AbortController()
        abortPollingRef.current = () => abortController.abort()

        // Poll job status
        console.log("Polling job status...")
        const pollStartTime = Date.now()
        const jobResult = await FocusGuardAPI.pollJob(
          jobId,
          (status) => {
            const elapsed = ((Date.now() - pollStartTime) / 1000).toFixed(1)
            console.log(`[${elapsed}s] Job progress:`, status.progress_percent, "%", status.progress_message, "Status:", status.status)
            // Update progress percentage and message for UI display
            setProgressPercent(status.progress_percent)
            setProgressMessage(status.progress_message || null)
          },
          500, // Poll every 500ms for faster response
          abortController.signal
        )
        
        // Clear abort reference after successful completion
        abortPollingRef.current = null
        
        const pollDuration = ((Date.now() - pollStartTime) / 1000).toFixed(1)
        console.log(`✅ Job completed in ${pollDuration}s:`, jobResult)

        // Step 3a: Extract analysis data from job result (optimized path)
        const fetchStartTime = Date.now()
        resultData = jobResult.result_data
        
        // The backend wraps all analysis under result_data.comprehensive_data.
        // Fall back to result_data itself for any older/alternative schema.
        cd = resultData?.comprehensive_data ?? resultData ?? {}
        
        // Extract summary from job result data, then read all other analysis
        // endpoints from cache in parallel. The individual endpoints return their
        // own response format (e.g. channel_trust returns the new 5-pillar
        // metrics format) which the UI components rely on.  comprehensive_data
        // stores a different (older) schema, so we intentionally avoid building
        // the component data from it.
        // NEVER call the sync summary_v2 endpoint with force_refresh: true here —
        // that would trigger a blocking re-analysis on the API server which can
        // crash it.  The async job has already computed everything; these calls
        // just read the freshly-populated cache entries.
        console.log("⏱️ Extracting summary from job result and reading cached endpoints...")

        // Step 3a.1: Extract summary from job result (no sync endpoint call)
        try {
          if (cd.summary) {
            summaryData = {
              status: 'SUCCESS',
              summary_paragraph: cd.summary.summary_paragraph,
              video_id: cd.video_id ?? videoId,
              snapshot_id: cd.snapshot_id,
              share_code: cd.share_code ?? null,
              cache_hit: cd.cache_hit,
              data_hash: '',
              video_title: cd.video_title,
              credibility_score: cd.channel_credibility?.score,
              sentiment_score: 0,
              persona: cd.summary.persona,
              key_takeaways: cd.summary.key_takeaways,
              max_comments_requested: cd.max_comments_requested ?? null,
              actual_comments_fetched: cd.actual_comments_fetched ?? null,
              confidence: null,
              is_fully_public: cd.is_fully_public ?? undefined
            }
            console.log("✅ Summary extracted from job result data")
          } else {
            console.warn("⚠️ No summary found in job result data — summary will be unavailable")
          }
        } catch (error) {
          console.error("Failed to extract summary from job result:", error)
        }

        // Step 3a.2: Read remaining endpoints from cache in parallel.
        // Use force_refresh: false — the job has already re-computed and stored the data;
        // these calls just read the freshly-populated cache entries.
        console.log("⏱️ Fetching remaining cached analysis data in parallel...")
        const parallelFetchStart = Date.now()
        const results = await Promise.allSettled([
          FocusGuardAPI.analyzeRelevancyV2(videoId, false),
          FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeChannelTrust(videoId, false),
          FocusGuardAPI.analyzeTopicClusteringV2(videoId, false),
          FocusGuardAPI.analyzeTopicGapV2(videoId, false)
        ])
        const parallelDuration = ((Date.now() - parallelFetchStart) / 1000).toFixed(1)
        const totalFetchDuration = ((Date.now() - fetchStartTime) / 1000).toFixed(1)
        console.log(`✅ Parallel endpoints fetched in ${parallelDuration}s (total post-job fetch: ${totalFetchDuration}s)`)
        
        // Extract results, logging any failures and capturing tier restrictions
        relevancyData = results[0].status === 'fulfilled' ? results[0].value : null
        sentimentData = results[1].status === 'fulfilled' ? results[1].value : null
        credibilityData = results[2].status === 'fulfilled' ? results[2].value : null
        topicClustersData = results[3].status === 'fulfilled' ? results[3].value : null
        topicGapsData = results[4].status === 'fulfilled' ? results[4].value : null
        humanLikenessData = null // Not fetched in general flow - load on-demand for advanced features
        // Mark credibility as already attempted so the "remaining data" block
        // below does not issue a second channel-trust call that could hang.
        credibilityAttempted = true
        
        // Log any failures and extract tier restrictions
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            const endpoints = ['relevancy', 'sentiment', 'credibility', 'topicClusters', 'topicGaps']
            console.error(`Failed to fetch ${endpoints[idx]}:`, result.reason)
            
            // Check if the error is a tier restriction
            const error = result.reason
            if (error && typeof error === 'object' && 'response' in error && error.response) {
              const responseData = error.response
              if (responseData.detail && responseData.detail.code === 'TIER_RESTRICTION') {
                console.log(`Tier restriction detected for ${endpoints[idx]}:`, responseData.detail)
                if (idx === 1) sentimentTierRestriction = responseData.detail
                if (idx === 3) topicClustersTierRestriction = responseData.detail
                if (idx === 4) topicGapsTierRestriction = responseData.detail
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
      console.log("Comment Verdict: Raw confidence from API:", confidenceRaw)
      const confidenceNorm = normalizeConfidence(confidenceRaw)
      console.log("Comment Verdict: Normalized confidence:", confidenceNorm)

      // Normalize confidence: convert to percent and 0-10 verdict certainty.
      const confidencePercent = Math.round(confidenceNorm * 100)
      const verdictCertainty = Math.round(confidenceNorm * 10 * 10) / 10 // 0-10, one decimal (renamed from trustScoreNormalized)
      
      // Calculate evidence score from claims
      const claims = relevancyData.data.claims || []
      const evidenceScore = calculateEvidenceScore(claims)
      
      console.log("Comment Verdict: Final verdictCertainty:", verdictCertainty, "evidenceScore:", evidenceScore, "confidencePercent:", confidencePercent)

      // Fetch additional analysis data for full report (only if we haven't already fetched it)
      // NOTE: Excluding human-likeness from general flow - will be loaded on-demand for advanced features
      // IMPORTANT: Summary must be fetched FIRST because backend dependencies require it (e.g., credibility)
      if (!sentimentData || !summaryData || !credibilityData || !topicClustersData || !topicGapsData) {
        console.log("Comment Verdict: Fetching remaining analysis data for video:", videoId)
        const remainingFetchStart = Date.now()
        
        // Step 1: Ensure summary is fetched/completed first
        if (!summaryData) {
          console.log("Comment Verdict: Fetching summary from cache (job has already computed it)...")
          try {
            // force_refresh: false — only read from cache; the async job has already
            // done the computation. Passing true would trigger a blocking re-analysis
            // on the API server which can crash it.
            summaryData = await FocusGuardAPI.analyzeSummaryV2({ video_id: videoId, force_refresh: false })
            console.log("Comment Verdict: Summary data received")
          } catch (error) {
            console.error("Failed to fetch summary:", error)
          }
        }
        
        // Step 2: Fetch remaining data in parallel (after summary is guaranteed to exist)
        // NOTE: channel-trust (credibility) is skipped when it was already attempted
        // in the fallback path and failed – retrying a 502/504 endpoint can stall
        // Promise.allSettled indefinitely on a slow server and block all results.
        // Use force_refresh: false for all — the async job has already re-computed
        // everything and populated the cache; these calls just read from it.
        const remainingResults = await Promise.allSettled([
          sentimentData ? Promise.resolve(sentimentData) : FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          (credibilityData || credibilityAttempted) ? Promise.resolve(credibilityData) : FocusGuardAPI.analyzeChannelTrust(videoId, false),
          topicClustersData ? Promise.resolve(topicClustersData) : FocusGuardAPI.analyzeTopicClusteringV2(videoId, false),
          topicGapsData ? Promise.resolve(topicGapsData) : FocusGuardAPI.analyzeTopicGapV2(videoId, false)
        ])
        
        sentimentData = sentimentData || (remainingResults[0].status === 'fulfilled' ? remainingResults[0].value : null)
        credibilityData = credibilityData || (remainingResults[1].status === 'fulfilled' ? remainingResults[1].value : null)
        topicClustersData = topicClustersData || (remainingResults[2].status === 'fulfilled' ? remainingResults[2].value : null)
        topicGapsData = topicGapsData || (remainingResults[3].status === 'fulfilled' ? remainingResults[3].value : null)
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
        if (!topicClustersTierRestriction && remainingResults[2].status === 'rejected') {
          const error = remainingResults[2].reason
          if (error && typeof error === 'object' && 'response' in error && error.response?.detail?.code === 'TIER_RESTRICTION') {
            topicClustersTierRestriction = error.response.detail
          }
        }
        if (!topicGapsTierRestriction && remainingResults[3].status === 'rejected') {
          const error = remainingResults[3].reason
          if (error && typeof error === 'object' && 'response' in error && error.response?.detail?.code === 'TIER_RESTRICTION') {
            topicGapsTierRestriction = error.response.detail
          }
        }
        
        // Log any failures
        remainingResults.forEach((result, idx) => {
          if (result.status === 'rejected') {
            const endpoints = ['sentiment', 'credibility', 'topicClusters', 'topicGaps']
            console.error(`Failed to fetch ${endpoints[idx]}:`, result.reason)
          }
        })
      }
      
      if (sentimentData) {
        console.log("Comment Verdict: Sentiment data received:", sentimentData)
      }
      if (summaryData) {
        console.log("Comment Verdict: Summary data received:", summaryData)
      }
      if (credibilityData) {
        console.log("Comment Verdict: Credibility data received:", credibilityData)
        console.log("🔍 DEBUG credibilityData.score:", (credibilityData as any).score)
        console.log("🔍 DEBUG credibilityData.normalized_factors:", (credibilityData as any).normalized_factors)
        console.log("🔍 DEBUG credibilityData.factual_factors:", (credibilityData as any).factual_factors)
      } else {
        console.log("⚠️ WARNING: credibilityData is null/undefined")
      }
      if (humanLikenessData) {
        console.log("Comment Verdict: Human Likeness data received:", humanLikenessData)
      }
      if (topicClustersData) {
        console.log("Comment Verdict: Topic Clusters data received:", topicClustersData)
      }
      if (topicGapsData) {
        console.log("Comment Verdict: Topic Gaps data received:", topicGapsData)
      }
      
      // Extract counts from nested structure (if sentiment data exists)
      console.log("🔍 DEBUG sentimentData before extraction:", sentimentData)
      console.log("🔍 DEBUG sentimentData.data:", sentimentData?.data)
      console.log("🔍 DEBUG sentimentData.data.positive:", sentimentData?.data?.positive)
      
      const positiveCount = sentimentData ? (typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)) : 0
      const neutralCount = sentimentData ? (typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)) : 0
      const negativeCount = sentimentData ? (typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)) : 0
      const totalComments = sentimentData?.data.total_comments ?? (positiveCount + neutralCount + negativeCount)
      
      console.log("Comment Verdict: Sentiment counts:", {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
        total: totalComments,
        rawPositive: sentimentData?.data?.positive,
        rawNeutral: sentimentData?.data?.neutral,
        rawNegative: sentimentData?.data?.negative
      })

      setAnalysisStatus({
        trustScore: verdictCertainty, // Still using trustScore key for backwards compatibility
        clickbaitVerdict: verdictRaw as "LEGIT" | "MISLEADING" | "CLICKBAIT",
        isAnalyzing: false
      })

      // Create a minimal video analysis object for the panel with expected fields
      const minimalSummary = {
        trustScore: verdictCertainty, // Verdict certainty (AI confidence in verdict)
        evidenceScore: evidenceScore, // Evidence score (weighted user evidence)
        aiConfidence: confidencePercent,
        clickbaitVerdict: {
          label: verdictRaw,
          confidence: confidencePercent,
          // Include claims from relevancy or summary responses when available
          claims: relevancyData?.data?.claims || (summaryData as any)?.clickbaitVerdict?.claims || (summaryData as any)?.claims || [],
          onLineSummary: (summaryData as any)?.one_line_summary || (summaryData as any)?.onLineSummary
        },
        channelCredibility: credibilityData ? (() => {
          // Handle both new (trust_score + metrics) and old (score + normalized_factors) formats
          if ('trust_score' in credibilityData && 'metrics' in credibilityData) {
            // NEW format: ChannelTrustResponse — data.metrics has structured MetricBreakdown
            // entries with .score + .normalized_value. data.metric_details (if present) is
            // metadata (timestamp, api_calls, …) — NOT the per-metric scores.
            const hasStructuredMetrics = credibilityData.metrics && typeof credibilityData.metrics === 'object' &&
              Object.values(credibilityData.metrics).some((v: any) => v && typeof v === 'object' && v.score != null)
            const hasStructuredDetails = credibilityData.metric_details && typeof credibilityData.metric_details === 'object' &&
              Object.values(credibilityData.metric_details).some((v: any) => v && typeof v === 'object' && v.score != null)
            const metricsSource = hasStructuredMetrics ? credibilityData.metrics : hasStructuredDetails ? credibilityData.metric_details : {}
            const factors = Object.entries(metricsSource)
              .filter(([, m]: [string, any]) => m && typeof m === 'object' && m.score != null)
              .map(([name, metricData]: [string, any]) => ({
                name,
                weight: metricData.normalized_value ?? 0,
                value: String(metricData.score)
              }))
            return {
              score: credibilityData.trust_score,
              factors,
              // Include full new format data
              metrics: credibilityData.metrics,
              trust_score: credibilityData.trust_score,
              raw_metrics: credibilityData.raw_metrics,
              metric_details: credibilityData.metric_details
            }
          } else {
            // OLD format: ChannelCredibilityResponseV2
            const oldCred = credibilityData as any
            return {
              score: oldCred.score,
              factors: oldCred.normalized_factors ? Object.entries(oldCred.normalized_factors).map(([name, weight]) => ({
                name,
                weight,
                value: oldCred.factual_factors?.[name] ?? 'N/A'
              })) : []
            }
          }
        })() : undefined,
        key_takeaways: (summaryData as any)?.key_takeaways || (summaryData as any)?.keyTakeaways || []
      }
      
      console.log("🔍 DEBUG minimalSummary.channelCredibility:", minimalSummary.channelCredibility)

      // Build sentiment distribution if available
      const sentimentDistribution = sentimentData ? (() => {
        const positiveCount = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
        const neutralCount = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
        const negativeCount = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
        const analyzedTotal = positiveCount + neutralCount + negativeCount
        
        // Extract top comments
        const positiveComments = typeof sentimentData.data.positive === 'object' ? sentimentData.data.positive?.top_comments ?? [] : []
        const neutralComments = typeof sentimentData.data.neutral === 'object' ? sentimentData.data.neutral?.top_comments ?? [] : []
        const negativeComments = typeof sentimentData.data.negative === 'object' ? sentimentData.data.negative?.top_comments ?? [] : []
        
        return {
          positive: positiveCount,
          neutral: neutralCount,
          negative: negativeCount,
          totalCommentsAnalyzed: analyzedTotal,
          exampleComments: {
            positive: positiveComments,
            neutral: neutralComments,
            negative: negativeComments
          }
        }
      })() : undefined

      // Transform topic clusters to high-value insights
      const benefitInsights = topicClustersData?.topic_clusters
        ?.filter((cluster: any) => cluster.count > 0)
        .slice(0, 5)
        .map((cluster: any, idx: number) => ({
          id: `benefit-${idx}`,
          statement: cluster.statement,
          type: "benefit" as const,
          commentCount: cluster.count,
          supportingComments: cluster.supporting_quotes.map((quote: any, qIdx: number) => {
            if (quote && typeof quote === "object") {
              // Full CommentObject — pass through directly
              return { ...quote, id: quote.id ?? `comment-${idx}-${qIdx}` }
            }
            return {
              id: `comment-${idx}-${qIdx}`,
              text: typeof quote === "string" ? quote : "",
              timestamp: undefined,
              author: undefined
            }
          }),
          isExpanded: false
        })) || []

      // Transform topic gaps to unanswered questions for ContentGapsTab
      const unansweredQuestions = topicGapsData?.topic_gaps
        ?.map((gap: any, idx: number) => {
          const supportingComments = mapGapSupportingComments(gap, idx)
          return {
            id: `gap-${idx}`,
            statement: gap.question_statement,
            type: "issue" as const,
            commentCount: supportingComments.length,
            supportingComments,
            isExpanded: false
          }
        }) || []

      // Get user tier and enforce tier restrictions on frontend (fetch once and reuse)
      console.log("⏱️ Getting subscription tier info...")
      const tierFetchStart = Date.now()
      let userTier: string
      let dashboardUrl: string
      
      // Use currentTier variable from early fetch (already fetched at start of proceedWithAnalysis)
      userTier = currentTier
      dashboardUrl = userTierInfo?.dashboardUrl || `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
      console.log(`✅ Using tier from early fetch: ${userTier}`)
      
      // Build report tier restriction inline instead of calling getReportTierRestriction() which would fetch subscription again
      const reportTierRestriction = userTier !== 'pro' ? {
        code: 'TIER_RESTRICTION' as const,
        required_tier: 'pro' as const,
        current_tier: userTier,
        message: 'Report downloads are available for Pro users only. Upgrade to download detailed analysis reports.',
        upgrade_url: dashboardUrl
      } : null
      
      // Enforce tier restrictions based on feature access rules:
      // - Comment Sentiment: Starter+ (block for Free)
      // - Viewer Insights: Pro only (block for Free and Starter)
      // - Content Gaps: Pro only (block for Free and Starter)
      
      // Sentiment is now FREE for all users via local analysis.
      // Cloud-based detailed sentiment is PRO only but gated by the backend.
      
      // Block viewer insights for non-Pro users (Pro only)
      if (userTier !== 'pro' && !topicClustersTierRestriction) {
        topicClustersTierRestriction = {
          code: 'TIER_RESTRICTION' as const,
          required_tier: 'pro' as const,
          current_tier: userTier as 'pro' | 'free' | 'starter',
          message: 'Viewer Insights are available for Pro users only.',
          upgrade_url: dashboardUrl
        }
      }
      
      // Block content gaps for non-Pro users (Pro only)
      if (userTier !== 'pro' && !topicGapsTierRestriction) {
        topicGapsTierRestriction = {
          code: 'TIER_RESTRICTION' as const,
          required_tier: 'pro' as const,
          current_tier: userTier as 'pro' | 'free' | 'starter',
          message: 'Content Gaps analysis is available for Pro users only.',
          upgrade_url: dashboardUrl
        }
      }

      // IMPORTANT: Validate that we're still on the same video before updating state
      // This prevents race conditions where a job completes for an old video after user has switched
      if (currentVideoIdRef.current !== videoId) {
        console.log(`⚠️ Video switched during analysis. Started: ${videoId}, Current: ${currentVideoIdRef.current}. Discarding old results.`)
        setAnalysisState("idle")
        setCurrentJobId(null)
        return
      }

      const likelyChannelId = (name: unknown): boolean =>
        typeof name === "string" && /^UC[a-zA-Z0-9_-]{20,}$/.test(name.trim())

      const pageChannelNameRaw =
        document.querySelector("ytd-watch-metadata ytd-channel-name a")?.textContent ||
        document.querySelector("ytd-video-owner-renderer ytd-channel-name a")?.textContent ||
        document.querySelector("#owner #channel-name a")?.textContent ||
        document.querySelector("yt-formatted-string#owner-name a")?.textContent ||
        null
      const pageChannelName = pageChannelNameRaw?.trim() || null

      const apiChannelName =
        // Priority 1: database-stored channel name (same source as web-portal snap.channel_name)
        (cacheStatus as any)?.channel_name ??
        // Priority 2: channel trust API response
        credibilityData?.channel_name ??
        // Priority 3: job result nested credibility block
        cd?.channel_credibility?.channel_name ??
        null

      const channelDisplayName =
        (pageChannelName && !likelyChannelId(pageChannelName) ? pageChannelName : null) ||
        (apiChannelName && !likelyChannelId(apiChannelName) ? apiChannelName : null) ||
        pageChannelName ||
        apiChannelName
      
      // Fetch snapshot metadata to get is_fully_public status
      let isFullyPublicFromMetadata = false
      console.log("🔍 METADATA FETCH BLOCK: summaryData exists?", !!summaryData, "snapshot_id:", summaryData?.snapshot_id)
      if (summaryData?.snapshot_id) {
        try {
          console.log(`🔍 Fetching snapshot metadata for snapshot_id ${summaryData.snapshot_id}...`)
          const snapshotMetadata = await FocusGuardAPI.getSnapshotMetadata(summaryData.snapshot_id)
          console.log("🔍 Snapshot metadata response:", snapshotMetadata)
          const metadata = snapshotMetadata?.snapshot_metadata || snapshotMetadata
          console.log("🔍 Extracted metadata object:", metadata)
          isFullyPublicFromMetadata = metadata?.is_fully_public === true
          console.log("🔍 is_fully_public from metadata:", isFullyPublicFromMetadata)
          if (summaryData) {
            summaryData.is_fully_public = isFullyPublicFromMetadata
            console.log("✅ Set summaryData.is_fully_public to:", summaryData.is_fully_public)
          }
        } catch (error) {
          console.warn("❌ Failed to fetch snapshot metadata for is_fully_public status:", error)
          // Not critical - continue without it
        }
      } else {
        console.warn("⚠️ Cannot fetch snapshot metadata - summaryData or snapshot_id missing", { hasSummaryData: !!summaryData, snapshotId: summaryData?.snapshot_id })
      }
      
      const videoAnalysisData = {
        // Video identification
        videoId: videoId,
        videoTitle: relevancyData?.data?.video_title || summaryData?.video_title || null,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoThumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channelName: channelDisplayName ?? null,
        // Share code for public report link
        // async-job path: result_data.comprehensive_data.share_code
        // direct summary / fallback path: summaryData.share_code
        snapshotShareCode: cd?.share_code ?? summaryData?.share_code ?? null,
        snapshotId: summaryData?.snapshot_id ?? cd?.snapshot_id ?? null,
        isFullyPublic: (() => {
          const val = summaryData?.is_fully_public === true
          console.log("📊 Setting videoAnalysisData.isFullyPublic to:", val, "from summaryData.is_fully_public:", summaryData?.is_fully_public)
          return val
        })(),
        // Legacy shape support
        summary: minimalSummary,
        trustScore: { score: verdictCertainty },
        clickbaitVerdict: { verdict: verdictRaw },
        executiveSummary: summaryData?.summary_paragraph ?? null,
        // Comment count tracking
        maxCommentsRequested: cd?.max_comments_requested ?? summaryData?.max_comments_requested ?? null,
        actualCommentsFetched: cd?.actual_comments_fetched ?? summaryData?.actual_comments_fetched ?? null,
        channelCredibility: credibilityData ? (() => {
          // Handle both new (trust_score + metrics) and old (score + normalized_factors) formats
          if ('trust_score' in credibilityData && 'metrics' in credibilityData) {
            // NEW format: ChannelTrustResponse (from /channel-trust endpoint)
            // metric_details has .score + .normalized_value; raw_metrics does not.
            const metricEntries = Object.entries(credibilityData.metric_details ?? credibilityData.metrics ?? {})
            const factors = metricEntries
              .filter(([, m]: [string, any]) => m && typeof m === 'object' && m.score != null)
              .map(([name, metricData]: [string, any]) => ({
                name,
                weight: metricData.normalized_value ?? 0,
                value: String(metricData.score)
              }))
            return {
              score: credibilityData.trust_score,
              factors,
              metrics: credibilityData.metrics,
              trust_score: credibilityData.trust_score,
              raw_metrics: credibilityData.raw_metrics,
              metric_details: credibilityData.metric_details
            }
          } else {
            // OLD format: ChannelCredibilityResponseV2
            const oldCred = credibilityData as any
            return {
              score: oldCred.score,
              factors: oldCred.normalized_factors ? Object.entries(oldCred.normalized_factors).map(([name, weight]) => ({
                name,
                weight,
                value: oldCred.factual_factors?.[name] ?? 'N/A'
              })) : []
            }
          }
        })() : null,
        // Minimal placeholders for other tabs
        sentiment: sentimentDistribution ? {
          overall: (() => {
            const positiveCount = typeof sentimentData!.data.positive === 'number' ? sentimentData!.data.positive : (sentimentData!.data.positive?.count ?? 0)
            const negativeCount = typeof sentimentData!.data.negative === 'number' ? sentimentData!.data.negative : (sentimentData!.data.negative?.count ?? 0)
            return positiveCount > negativeCount ? "positive" : negativeCount > positiveCount ? "negative" : "neutral"
          })(),
          distribution: sentimentDistribution,
          filteringMetadata: (() => {
            if (sentimentData?.filtering_metadata) return sentimentData.filtering_metadata
            if (sentimentData?.data?.excluded_count !== undefined) {
              const pos = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
              const neg = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
              const neu = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
              const analyzedCount = pos + neg + neu
              const totalComments = sentimentData.data.total_comments ?? (analyzedCount + sentimentData.data.excluded_count)
              return {
                total_input: totalComments,
                filtered_count: analyzedCount
              }
            }
            return undefined
          })(),
          tierRestriction: sentimentTierRestriction
        } : (sentimentTierRestriction ? { 
          tierRestriction: sentimentTierRestriction,
          filteringMetadata: (() => {
            if (sentimentData?.filtering_metadata) return sentimentData.filtering_metadata
            if (sentimentData?.data?.excluded_count !== undefined) {
              const pos = typeof sentimentData.data.positive === 'number' ? sentimentData.data.positive : (sentimentData.data.positive?.count ?? 0)
              const neg = typeof sentimentData.data.negative === 'number' ? sentimentData.data.negative : (sentimentData.data.negative?.count ?? 0)
              const neu = typeof sentimentData.data.neutral === 'number' ? sentimentData.data.neutral : (sentimentData.data.neutral?.count ?? 0)
              const analyzedCount = pos + neg + neu
              const totalComments = sentimentData.data.total_comments ?? (analyzedCount + sentimentData.data.excluded_count)
              return {
                total_input: totalComments,
                filtered_count: analyzedCount
              }
            }
            return undefined
          })()
        } : null),
        credibility: null,
        topicClusters: null,
        topicClustersData: topicClustersData ? {
          clusters: topicClustersData.topic_clusters || [],
          parent_themes: (topicClustersData as any).parent_themes || [],
          hierarchy_map: (topicClustersData as any).hierarchy_map || {},
          total_parent_themes: (topicClustersData as any).total_parent_themes || 0,
          method: (topicClustersData as any).method || 'unknown',
          processing_time: topicClustersData.processing_time
        } : undefined,
        contentGaps: {
          botPercentage: (humanLikenessData && (humanLikenessData as any).total_comments && (humanLikenessData as any).total_comments > 0)
            ? Math.round(((humanLikenessData as any).bot_count / (humanLikenessData as any).total_comments) * 100)
            : 0,
          gapCoverageScore: topicGapsData?.topic_gaps ? Math.max(0, 100 - (topicGapsData.topic_gaps.length * 10)) : (topicGapsTierRestriction ? undefined : 100),
          botDetectionEnabled: true,
          unansweredQuestions: unansweredQuestions,
          filteringMetadata: topicGapsData?.filtering_metadata,
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
      } as any
      
      console.log("🔍 DEBUG videoAnalysisData.channelCredibility:", videoAnalysisData.channelCredibility)
      console.log("🔍 DEBUG videoAnalysisData.summary.channelCredibility:", videoAnalysisData.summary?.channelCredibility)
      
      setVideoAnalysis(videoAnalysisData)

      setAnalysisState("complete")
      setCurrentJobId(null)

      const totalDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(1)
      console.log(`✅ Total analysis completed in ${totalDuration}s`)

      // FR-101: Show pre-watch popover after a fresh analysis.
      // For force-refresh the side panel is already open — just let it re-render
      // with the new videoAnalysis state; don't re-open the popover.
      if (!forceRefresh) {
        setShowPreWatchPopover(true)
      }
    } catch (error) {
      console.error("Video analysis failed:", error)

      // ── Free queue race / ineligibility errors ────────────────────────────
      // If the user chose to use the free queue and the job submission was
      // rejected by the backend (race condition, already used, etc.) we want
      // to re-surface the credit dialog with a clear explanation rather than
      // showing a generic error banner.
      if (usingFreeQueue && typeof (error as any)?.status === 'number') {
        const status = (error as any).status as number
        const rawMsg: string = (error instanceof Error ? error.message : String(error)) || ''
        let submitError: FreeQueueSubmitError | null = null

        if (status === 409) {
          submitError = {
            type: 'race_exhausted',
            message: 'All remaining slots were just taken by other users. The pool has been reset — please try again after the daily reset.',
            next_reset_time: freeQueueStatusAtSubmit?.next_reset_time
          }
        } else if (status === 403 && !rawMsg.toLowerCase().includes('tier')) {
          // 403 for free-queue "already used" (tier restrictions carry their own flag)
          submitError = {
            type: 'already_used',
            message: 'You have already used your free daily analysis slot. Your slot resets at midnight UTC.',
            next_reset_time: freeQueueStatusAtSubmit?.next_reset_time
          }
        } else if (status === 400 && rawMsg.toLowerCase().includes('credits')) {
          submitError = {
            type: 'has_credits',
            message: 'Your account still has credits — the free queue is reserved for users who have run out. Please use your credits to run this analysis.'
          }
        }

        if (submitError) {
          console.warn('Free queue submit error detected:', submitError)
          // Re-open the credit dialog with the error embedded so the user
          // understands what happened without losing the upgrade options.
          setCreditConfirmData(prev => prev ? {
            ...prev,
            freeQueueStatus: freeQueueStatusAtSubmit,
            freeQueueError: submitError,
            isFetchingFreeQueueStatus: false
          } : {
            estimatedCredits: 0,
            currentBalance: 0,
            hasSufficientCredits: false,
            freeQueueStatus: freeQueueStatusAtSubmit,
            freeQueueError: submitError,
            isFetchingFreeQueueStatus: false,
            onConfirm: () => {
              setShowCreditConfirmDialog(false)
              setCreditConfirmData(null)
            }
          })
          setShowCreditConfirmDialog(true)
          setAnalysisState("idle")
          setCurrentJobId(null)
          setIsAnalyzing(false)
          return
        }
      }
      // ── End free queue error handling ─────────────────────────────────────

      // Check if polling was aborted (user switched videos)
      if (error instanceof Error && error.message === "Polling aborted") {
        console.log("Polling aborted due to video switch - this is expected")
        // Don't set error state, just reset to idle
        setAnalysisState("idle")
        setCurrentJobId(null)
        return
      }
      
      // Simplify error messages for common cases
      // Backend handles stale/killed jobs - trust the status and show reason clearly
      let errorMessage = "Analysis failed"
      if (error instanceof Error) {
        const msg = error.message.toLowerCase()
        if (msg.includes("daily limit") || msg.includes("rate limit") || msg.includes("quota") || msg.includes("429")) {
          // Check user tier for custom message
          try {
            const subscription = await SubscriptionService.getSubscription()
            const userTier = subscription.tier?.toLowerCase() || 'free'
            errorMessage = userTier === 'pro' ? "Quota will be reset soon" : "Daily limit reached"
          } catch {
            errorMessage = "Daily limit reached"
          }
        } else if (msg.includes("context invalidated") || msg.includes("refresh the page")) {
          errorMessage = "Refresh page to continue"
        } else if (msg.includes("llm judge") || msg.includes("heuristic") || msg.includes("ollama")) {
          errorMessage = "AI judge busy — tap to retry"
        } else if (msg.includes("auth") || msg.includes("login") || msg.includes("401")) {
          errorMessage = "Please log in"
        } else if (msg.includes("network") || msg.includes("connection")) {
          errorMessage = "Network error — retry later"
        } else if (msg.includes("insufficient credits") || msg.includes("free queue")) {
          // Keep toggle-button message short and readable (space is very limited)
          if (msg.includes("already used") && msg.includes("free queue")) {
            errorMessage = "No credits · Free slot used"
          } else if (msg.includes("exhausted") || msg.includes("pool") || msg.includes("full")) {
            errorMessage = "No credits · Queue full"
          } else if (msg.includes("still has credits")) {
            errorMessage = "Use your credits"
          } else {
            errorMessage = "No credits · Free queue unavailable"
          }
        } else if (msg.includes("job failed") || msg.includes("job was cancelled")) {
          // Backend-reported job failure — show the reason from the backend clearly
          // Truncate to fit toggle button (max ~60 chars)
          const reason = error.message.replace(/^Job failed\s*[-:]*\s*/i, '').replace(/^Job was cancelled\s*[-:]*\s*/i, '').trim()
          errorMessage = reason.length > 50
            ? `Failed: ${reason.slice(0, 47)}…`
            : reason
              ? `Failed: ${reason}`
              : "Job failed — tap to retry"
        } else if (msg.includes("timeout") || msg.includes("timed out")) {
          errorMessage = "Timed out — tap to retry"
        } else {
          // Pass through backend message, truncated for toggle button
          const trimmed = error.message.trim()
          errorMessage = trimmed.length > 55
            ? `${trimmed.slice(0, 52)}…`
            : trimmed || "Analysis failed — tap to retry"
        }
      }
      
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
      startVideoAnalysis(videoId, true)
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
  // Only render if Comment Verdict is enabled
  // Use ?? true as failsafe to show toggle button even if settings somehow becomes null
  const shouldRender = onWatchPage && (settings?.isEnabled ?? true)
  console.log("🔍 Content render check: onWatchPage=", onWatchPage, "settings?.isEnabled=", settings?.isEnabled, "shouldRender=", shouldRender)
  
  if (shouldRender) {
    const isPro = userTierInfo?.tier === 'pro'
    const isGuest = !userTierInfo
    const isFreeTier = userTierInfo?.tier === 'free'
    const portalBaseUrl = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"

    return (
      <>
        {/* Verdict chat-bubble tooltip (shown for ALL users after free verdict) */}
        {showVerdictTooltip && verdictTooltipData && !isSidePanelOpen && (
          <VerdictTooltip
            verdict={verdictTooltipData.verdict}
            reasoning={verdictTooltipData.reasoning}
            dock={panelDock}
            isPro={isPro}
            isGuest={isGuest}
            isFreeTier={isFreeTier}
            isSentimentRunning={isSentimentRunning}
            isSentimentDone={isSentimentDone}
            sentimentSummary={tooltipSentimentSummary}
            onRunSentiment={triggerFreeSentiment}
            onViewFullAnalysis={!isGuest ? () => {
              setShowVerdictTooltip(false)
              setIsSidePanelOpen(true)
            } : undefined}
            onRegister={isGuest ? () => {
              window.open(`${portalBaseUrl}/login`, '_blank')
            } : undefined}
            onUpgrade={isFreeTier ? () => {
              window.open(`${portalBaseUrl}/dashboard?tab=billing&purchase_type=tier`, '_blank')
            } : undefined}
            onDismiss={() => {
              setShowVerdictTooltip(false)
            }}
          />
        )}
        
        {/* New ToggleButton - visible when panel is closed */}
        {!isSidePanelOpen && (
          <>
            {/* Debug: log props sent to ToggleButton to verify shapes at runtime */}
            {console.log("Comment Verdict: Toggle props", { analysisState, analysisStatus, videoAnalysisSummary: videoAnalysis?.summary, isCached, analysisError })}
            <ToggleButton
              trustScore={analysisStatus?.trustScore}
              verdict={analysisStatus?.clickbaitVerdict}
              dock={panelDock}
              state={isCheckingCache ? "analyzing" : (analysisState === "complete" && isCached && !settings?.videoAnalysis?.showCachedVerdict) ? "idle" : analysisState}
              isCached={isCached}
              errorMessage={analysisError}
              progressPercent={progressPercent}
              progressMessage={progressMessage}
              showCachedVerdict={settings?.videoAnalysis?.showCachedVerdict || false}
              proMode={isPro ? (settings?.videoAnalysis?.proToggleMode ?? "free_verdict") : "free_verdict"}
              onToggle={() => {
                if (isCheckingCache) {
                  return
                }
                if (analysisState === "idle") {
                  if (currentVideoId) {
                    startVideoAnalysis(currentVideoId)
                  }
                } else if (analysisState === "complete") {
                  if (!isGuest) {
                    // Registered users (free & pro): toggle opens the full analysis side panel
                    setIsSidePanelOpen(true)
                    setShowVerdictTooltip(false)
                  } else {
                    // Guests (visitors): toggle the verdict tooltip — side panel is not available
                    setShowVerdictTooltip((prev) => !prev)
                  }
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

            {/* PRO: Max comments tuner — gear icon at top-right */}
            {isPro && analysisState !== "analyzing" && (() => {
              const toggleMode = settings?.videoAnalysis?.proToggleMode ?? 'free_verdict'
              // Hard server-side cap: free verdict ≤500, full analysis ≤1000
              const sliderMax = toggleMode === 'free_verdict' ? 500 : 1000
              const sliderSteps = toggleMode === 'free_verdict'
                ? [100, 200, 300, 400, 500]
                : [100, 300, 500, 700, 1000]
              // Clamp current value to allowed range
              const effectiveLocal = Math.min(toggleSliderLocal, sliderMax)

              return (
                <div style={{
                  position: "fixed",
                  right: "10px",
                  top: "68px",
                  zIndex: 10000,
                }}>
                  {/* Gear icon button */}
                  <div
                    onClick={(e) => { e.stopPropagation(); setToggleSliderOpen((v) => !v) }}
                    title={`Max comments: ${effectiveLocal} (${toggleMode === 'free_verdict' ? 'Quick Verdict · max 500' : 'Full Analysis · max 1000'})`}
                    style={{
                      width: "32px",
                      height: "32px",
                      backgroundColor: toggleSliderOpen ? "rgba(37,99,235,0.95)" : "rgba(15,23,42,0.82)",
                      border: `1.5px solid ${toggleSliderOpen ? "#60a5fa" : "rgba(96,165,250,0.4)"}`,
                      borderRadius: "50%",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                      userSelect: "none",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                    }}>
                    <span style={{ fontSize: "15px", lineHeight: 1, userSelect: "none" }}>⚙️</span>
                  </div>

                  {/* Slider popover */}
                  {toggleSliderOpen && (
                    <>
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 9999 }}
                        onClick={() => setToggleSliderOpen(false)}
                      />
                      <div style={{
                        position: "absolute",
                        top: 0,
                        right: "40px",
                        zIndex: 10001,
                        backgroundColor: "rgba(15,23,42,0.97)",
                        border: "1px solid rgba(96,165,250,0.3)",
                        borderRadius: "12px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        padding: "10px 12px",
                        width: "190px",
                        backdropFilter: "blur(8px)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.55)", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                            Max Comments
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: "800", color: "#60a5fa" }}>
                            {effectiveLocal}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={sliderMax}
                          step={100}
                          value={effectiveLocal}
                          onChange={(e) => setToggleSliderLocal(parseInt(e.target.value))}
                          onMouseUp={async (e) => {
                            const newDepth = parseInt((e.target as HTMLInputElement).value)
                            setProMaxComments(newDepth)
                            const newSettings = {
                              ...settings,
                              videoAnalysis: {
                                showPreWatchPopover: settings?.videoAnalysis?.showPreWatchPopover ?? true,
                                autoAnalyze: settings?.videoAnalysis?.autoAnalyze ?? false,
                                botDetectionEnabled: settings?.videoAnalysis?.botDetectionEnabled ?? true,
                                showCachedVerdict: settings?.videoAnalysis?.showCachedVerdict ?? false,
                                confirmCreditUsage: settings?.videoAnalysis?.confirmCreditUsage ?? true,
                                maxCommentDepth: newDepth,
                                proToggleMode: toggleMode,
                              }
                            }
                            try { await chrome.storage.sync.set({ settings: newSettings }) } catch {}
                            if (currentVideoId) fetchSubAnalysisCosts(currentVideoId, newDepth)
                          }}
                          onTouchEnd={async (e) => {
                            const newDepth = parseInt((e.target as HTMLInputElement).value)
                            setProMaxComments(newDepth)
                            try {
                              const newSettings = {
                                ...settings,
                                videoAnalysis: {
                                  showPreWatchPopover: settings?.videoAnalysis?.showPreWatchPopover ?? true,
                                  autoAnalyze: settings?.videoAnalysis?.autoAnalyze ?? false,
                                  botDetectionEnabled: settings?.videoAnalysis?.botDetectionEnabled ?? true,
                                  showCachedVerdict: settings?.videoAnalysis?.showCachedVerdict ?? false,
                                  confirmCreditUsage: settings?.videoAnalysis?.confirmCreditUsage ?? true,
                                  maxCommentDepth: newDepth,
                                  proToggleMode: toggleMode,
                                }
                              }
                              await chrome.storage.sync.set({ settings: newSettings })
                            } catch {}
                            if (currentVideoId) fetchSubAnalysisCosts(currentVideoId, newDepth)
                          }}
                          style={{ width: "100%", height: "4px", borderRadius: "2px", cursor: "pointer", accentColor: "#60a5fa" }}
                        />
                        {/* Step ticks */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "rgba(255,255,255,0.35)", marginTop: "4px", padding: "0 1px" }}>
                          {sliderSteps.map(n => (
                            <span key={n} style={{
                              fontWeight: n === effectiveLocal ? "700" : "400",
                              color: n === effectiveLocal ? "#60a5fa" : undefined,
                              opacity: n === effectiveLocal ? 1 : 0.5,
                            }}>{n >= 1000 ? "1k" : n}</span>
                          ))}
                        </div>
                        <div style={{ marginTop: "7px", fontSize: "9px", color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
                          {toggleMode === 'free_verdict' ? '⚡ Quick Verdict · max 500' : '🔬 Full Analysis · max 1000'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {/* Settings Button - temporarily hidden */}
            {false && (userTierInfo?.tier === 'pro' || userTierInfo?.tier === 'starter') && analysisState === 'idle' && (
              <button
                onClick={() => setShowSettingsModal(true)}
                style={{
                  position: "fixed",
                  [panelDock]: "80px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "white",
                  border: "3px solid #3b82f6",
                  borderRadius: panelDock === "left" ? "0 12px 12px 0" : "12px 0 0 12px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                  zIndex: 9999,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#eff6ff"
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.05)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "white"
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)"
                }}
                title="Analysis Settings">
                <span style={{ fontSize: "20px" }}>⚙️</span>
              </button>
            )}
          </>
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
          onForceRefresh={async () => {
            if (!currentVideoId) return
            // Force refresh reruns the full analysis.
            // Show credit confirmation dialog with a rough estimate.
            try {
              const isAuth = await AuthService.isAuthenticated()
              if (!isAuth) {
                // Guest can't run full analysis — prompt login
                const portalUrl = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"
                window.open(`${portalUrl}/login`, '_blank')
                return
              }

              // Read fresh settings from storage so the slider value is current
              let freshSettings = settings
              try {
                const result = await chrome.storage.sync.get(["settings"])
                freshSettings = result.settings || settings
              } catch {}

              const credits = await FocusGuardAPI.getCreditBalance()
              // Mirror the exact formula used in proceedWithAnalysis so the estimate matches what will actually be requested
              const refreshTier = userTierInfo?.tier || 'free'
              const refreshMaxComments = freshSettings?.videoAnalysis?.maxCommentDepth || 100
              const commentCount = refreshTier === 'pro' ? refreshMaxComments : Math.min(refreshMaxComments, 300)
              const estimate = await FocusGuardAPI.estimateCreditCost(commentCount, "full_analysis", currentVideoId)
              const estimatedCredits = estimate.estimated_credits
              const hasSufficient = credits.credits_balance >= estimatedCredits

              setCreditConfirmData({
                estimatedCredits,
                currentBalance: credits.credits_balance,
                hasSufficientCredits: hasSufficient,
                onConfirm: () => {
                  setShowCreditConfirmDialog(false)
                  setCreditConfirmData(null)
                  if (currentVideoId) {
                    proceedWithAnalysis(currentVideoId, true)
                  }
                },
              })
              setShowCreditConfirmDialog(true)
            } catch (err) {
              console.warn("Failed to check credits for force refresh:", err)
              // Fall back to running directly
              proceedWithAnalysis(currentVideoId, true)
            }
          }}
          onLoadHistoryItem={(item) => {
            // Navigate to that video's YouTube page; the URL-change listener
            // will pick it up and load the cached analysis automatically.
            window.location.href = `https://www.youtube.com/watch?v=${item.videoId}`
          }}
          progressPercent={progressPercent}
          progressMessage={progressMessage}
          panelDock={panelDock}
          userTier={userTierInfo?.tier}
          costEstimates={subAnalysisCosts}
          maxComments={proMaxComments}
          onMaxCommentsChange={async (newDepth: number) => {
            setProMaxComments(newDepth)
            // Persist to settings so proceedWithAnalysis picks up the new value
            const newSettings = {
              ...settings,
              videoAnalysis: {
                showPreWatchPopover: settings?.videoAnalysis?.showPreWatchPopover ?? true,
                autoAnalyze: settings?.videoAnalysis?.autoAnalyze ?? false,
                botDetectionEnabled: settings?.videoAnalysis?.botDetectionEnabled ?? true,
                showCachedVerdict: settings?.videoAnalysis?.showCachedVerdict ?? false,
                confirmCreditUsage: settings?.videoAnalysis?.confirmCreditUsage ?? true,
                maxCommentDepth: newDepth,
                proToggleMode: settings?.videoAnalysis?.proToggleMode ?? 'free_verdict',
              }
            }
            try {
              await chrome.storage.sync.set({ settings: newSettings })
            } catch {}
            // Re-fetch cost estimates with the new depth
            if (currentVideoId) {
              fetchSubAnalysisCosts(currentVideoId, newDepth)
            }
          }}
          onRunFullAnalysis={() => {
            if (currentVideoId) {
              // Trigger legacy full analysis (all analyses at once)
              proceedWithAnalysis(currentVideoId, true)
            }
          }}
          onRunSingleAnalysis={async (type) => {
            console.log(`Run single analysis: ${type}`)

            if (type === "trust") {
              // Channel trust is free — no credits required
              if (!currentVideoId) return
              try {
                const trustData = await FocusGuardAPI.analyzeChannelTrust(currentVideoId, false)
                if (trustData && videoAnalysis) {
                  setVideoAnalysis({
                    ...videoAnalysis,
                    channelTrust: trustData,
                    channelName: videoAnalysis.channelName || trustData.channel_name || null,
                  } as any)
                }
              } catch (err) {
                console.warn("Channel trust analysis failed:", err)
              }
              return
            }

            if (!currentVideoId) return

            const isAuth = await AuthService.isAuthenticated()
            if (!isAuth) {
              const portalUrl = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"
              window.open(`${portalUrl}/login`, '_blank')
              return
            }

            // "report" runs the full summary+snapshot job — creates a web-portal report
            if (type === "report") {
              try {
                const credits = await FocusGuardAPI.getCreditBalance()
                const estimatedCredits = subAnalysisCosts?.report ?? 1
                const hasSufficient = credits.credits_balance >= estimatedCredits
                setCreditConfirmData({
                  estimatedCredits,
                  currentBalance: credits.credits_balance,
                  hasSufficientCredits: hasSufficient,
                  onConfirm: () => {
                    setShowCreditConfirmDialog(false)
                    setCreditConfirmData(null)
                    if (currentVideoId) proceedWithAnalysis(currentVideoId, true)
                  },
                })
                setShowCreditConfirmDialog(true)
              } catch (err) {
                console.warn("Failed to check credits for report:", err)
                proceedWithAnalysis(currentVideoId, true)
              }
              return
            }

            // Individual analyses: use the dedicated per-type job endpoints.
            // These do NOT create a report snapshot. Credit balance is the only gate.
            const jobTypeMap: Partial<Record<string, "sentiment" | "clustering" | "gaps" | "relevancy">> = {
              claims: "relevancy",
              sentiment: "sentiment",
              topic: "clustering",
              gaps: "gaps",
            }
            const jobType = jobTypeMap[type]
            if (!jobType) return

            // Use the stored per-type cost estimate (from fetchSubAnalysisCosts)
            const costKey = type as keyof typeof subAnalysisCosts
            const estimatedCredits = subAnalysisCosts?.[costKey] ?? 1

            try {
              const credits = await FocusGuardAPI.getCreditBalance()
              const hasSufficient = credits.credits_balance >= estimatedCredits

              setCreditConfirmData({
                estimatedCredits,
                currentBalance: credits.credits_balance,
                hasSufficientCredits: hasSufficient,
                onConfirm: async () => {
                  setShowCreditConfirmDialog(false)
                  setCreditConfirmData(null)
                  if (!currentVideoId) return

                  setAnalysisState("analyzing")
                  setIsAnalyzing(true)
                  setAnalysisError(null)
                  setProgressPercent(0)
                  setProgressMessage(`Starting ${type} analysis…`)

                  try {
                    // Submit to the individual job endpoint (NOT /jobs/summary)
                    const jobResponse = await FocusGuardAPI.submitSingleAnalysisJob(currentVideoId, jobType, true)
                    const jobId = jobResponse.job_id
                    setCurrentJobId(jobId)

                    const abortController = new AbortController()
                    await FocusGuardAPI.pollJob(
                      jobId,
                      (status) => {
                        setProgressPercent(status.progress_percent ?? null)
                        setProgressMessage(status.progress_message ?? null)
                      },
                      2000,
                      abortController.signal
                    )

                    // Job done — fetch the freshly-cached result and patch the state
                    if (type === "claims") {
                      const relevancy = await FocusGuardAPI.analyzeRelevancyV2(currentVideoId, false)
                      if (relevancy?.data) {
                        setVideoAnalysis((prev: any) => prev ? {
                          ...prev,
                          summary: {
                            ...prev.summary,
                            clickbaitVerdict: {
                              ...prev.summary?.clickbaitVerdict,
                              claims: relevancy.data.claims || [],
                            },
                          },
                        } : prev)
                      }
                    } else if (type === "sentiment") {
                      const sentimentResp = await FocusGuardAPI.analyzeSentimentV2({ video_id: currentVideoId, force_refresh: false })
                      if (sentimentResp?.data) {
                        const sd = sentimentResp.data
                        const pos = typeof sd.positive === 'number' ? sd.positive : ((sd.positive as any)?.count ?? 0)
                        const neu = typeof sd.neutral === 'number' ? sd.neutral : ((sd.neutral as any)?.count ?? 0)
                        const neg = typeof sd.negative === 'number' ? sd.negative : ((sd.negative as any)?.count ?? 0)
                        const positiveComments = typeof sd.positive === 'object' ? (sd.positive as any)?.top_comments ?? [] : []
                        const neutralComments = typeof sd.neutral === 'object' ? (sd.neutral as any)?.top_comments ?? [] : []
                        const negativeComments = typeof sd.negative === 'object' ? (sd.negative as any)?.top_comments ?? [] : []
                        setVideoAnalysis((prev: any) => prev ? {
                          ...prev,
                          separateAnalysis: false,
                          sentiment: {
                            overall: pos > neg ? "positive" : neg > pos ? "negative" : "neutral",
                            distribution: {
                              positive: pos,
                              neutral: neu,
                              negative: neg,
                              totalCommentsAnalyzed: pos + neu + neg,
                              exampleComments: { positive: positiveComments, neutral: neutralComments, negative: negativeComments },
                            },
                            filteringMetadata: sentimentResp.filtering_metadata,
                          },
                          viewerInsights: {
                            ...(prev?.viewerInsights && typeof prev.viewerInsights === 'object' ? prev.viewerInsights : {}),
                            sentimentBreakdown: {
                              positive: pos,
                              negative: neg,
                              neutral: neu,
                              mixed: 0,
                              totalCommentsAnalyzed: pos + neu + neg,
                            },
                          },
                        } : prev)
                        setIsSentimentDone(true)
                      }
                    } else if (type === "topic") {
                      const topicsResp = await FocusGuardAPI.analyzeTopicClusteringV2(currentVideoId, false)
                      if (topicsResp?.topic_clusters) {
                        setVideoAnalysis((prev: any) => prev ? {
                          ...prev,
                          topicClustersData: {
                            clusters: topicsResp.topic_clusters,
                            parent_themes: (topicsResp as any).parent_themes || [],
                            hierarchy_map: (topicsResp as any).hierarchy_map || {},
                            total_parent_themes: (topicsResp as any).total_parent_themes || 0,
                            method: (topicsResp as any).method || 'unknown',
                            processing_time: topicsResp.processing_time,
                          },
                          viewerInsights: {
                            ...(prev?.viewerInsights && typeof prev.viewerInsights === 'object'
                              ? { sentimentBreakdown: (prev.viewerInsights as any).sentimentBreakdown }
                              : {}),
                            insights: topicsResp.topic_clusters
                              .filter((c: any) => c.count > 0)
                              .slice(0, 5)
                              .map((cluster: any, idx: number) => ({
                                id: `benefit-${idx}`,
                                statement: cluster.statement,
                                type: "benefit" as const,
                                commentCount: cluster.count,
                                supportingComments: (cluster.supporting_quotes || []).map((q: any, qIdx: number) => {
                                  if (q && typeof q === 'object') return { ...q, id: q.id ?? `comment-${idx}-${qIdx}` }
                                  return { id: `comment-${idx}-${qIdx}`, text: typeof q === 'string' ? q : "" }
                                }),
                                isExpanded: false,
                              })),
                          },
                        } : prev)
                      }
                    } else if (type === "gaps") {
                      const gapsResp = await FocusGuardAPI.analyzeTopicGapV2(currentVideoId, false)
                      if (gapsResp?.topic_gaps) {
                        const unansweredQuestions = gapsResp.topic_gaps.map((gap: any, idx: number) => {
                          const supportingComments = mapGapSupportingComments(gap, idx)
                          return {
                            id: `gap-${idx}`,
                            statement: gap.question_statement,
                            type: "issue" as const,
                            commentCount: supportingComments.length,
                            supportingComments,
                            isExpanded: false,
                          }
                        })
                        setVideoAnalysis((prev: any) => prev ? {
                          ...prev,
                          contentGaps: {
                            ...prev.contentGaps,
                            unansweredQuestions,
                            gapCoverageScore: Math.max(0, 100 - gapsResp.topic_gaps.length * 10),
                            filteringMetadata: gapsResp.filtering_metadata,
                            tierRestriction: undefined,
                          },
                        } : prev)
                      }
                    }

                    setAnalysisState("complete")
                    setIsAnalyzing(false)
                    setProgressPercent(null)
                    setProgressMessage(null)
                    setCurrentJobId(null)
                    // Re-fetch cost estimates after credits were spent
                    fetchSubAnalysisCosts(currentVideoId)
                  } catch (err) {
                    const errRaw = (err as any)?.message || "Analysis failed — tap to retry"
                    console.error(`Individual ${type} analysis failed:`, err)
                    setAnalysisError(errRaw)
                    // Show a user-friendly message in the tab itself so the user
                    // sees WHY the tab is empty rather than just a blank state.
                    const friendly = errRaw.toLowerCase().includes("insufficient credits")
                      ? "Insufficient credits — add more credits to run this analysis"
                      : errRaw
                    if (type === "topic") {
                      setVideoAnalysis((prev: any) => prev ? {
                        ...prev,
                        topicClustersData: { ...(prev.topicClustersData ?? {}), analysisError: friendly },
                      } : prev)
                    } else if (type === "gaps") {
                      setVideoAnalysis((prev: any) => prev ? {
                        ...prev,
                        contentGaps: {
                          ...(prev.contentGaps ?? { botPercentage: 0, botDetectionEnabled: true, unansweredQuestions: [] }),
                          analysisError: friendly,
                        },
                      } : prev)
                    } else if (type === "sentiment") {
                      setVideoAnalysis((prev: any) => prev ? {
                        ...prev,
                        sentiment: { ...(prev.sentiment ?? {}), analysisError: friendly },
                      } : prev)
                    }
                    setAnalysisState("complete")
                    setIsAnalyzing(false)
                    setProgressPercent(null)
                    setProgressMessage(null)
                    setCurrentJobId(null)
                  }
                },
              })
              setShowCreditConfirmDialog(true)
            } catch (err) {
              console.warn("Failed to check credits for sub-analysis:", err)
            }
          }}
          onLoadSnapshot={(snapshotData) => {
            // Map ShareableReportBundle fields to VideoAnalysis shape
            if (!snapshotData) return
            const meta = snapshotData.snapshot_metadata
            const gs = snapshotData.general_sentiment
            const tc = snapshotData.topic_clustering
            const tg = snapshotData.topic_gaps
            const ct = snapshotData.channel_trust
            const rel = snapshotData.relevancy

            // Map general_sentiment → sentiment
            // SentimentContextData may have counts at different paths; try several
            let mappedSentiment: any = undefined
            if (gs) {
              const sd = gs?.data || gs
              // Try common field structures
              const extractCount = (field: any): number => {
                if (typeof field === "number" && isFinite(field)) return Math.round(field)
                if (field && typeof field === "object") {
                  if (typeof field.count === "number") return field.count
                  if (typeof field.total === "number") return field.total
                }
                return 0
              }
              const pos = extractCount(sd.positive) || extractCount(gs.positive_label_count) || extractCount(gs.positive_count)
              const neg = extractCount(sd.negative) || extractCount(gs.negative_label_count) || extractCount(gs.negative_count)
              const neu = extractCount(sd.neutral) || extractCount(gs.neutral_label_count) || extractCount(gs.neutral_count)
              // Only update sentiment if we have valid non-zero data
              // (if all zero, keep the existing sentiment from the normal analysis)
              if (pos + neu + neg > 0) {
                mappedSentiment = {
                  overall: pos > neg ? "positive" : neg > pos ? "negative" : "neutral",
                  distribution: {
                    positive: pos, neutral: neu, negative: neg,
                    totalCommentsAnalyzed: pos + neu + neg,
                    exampleComments: {
                      positive: (typeof sd.positive === "object" && sd.positive?.top_comments) ? sd.positive.top_comments : [],
                      neutral: (typeof sd.neutral === "object" && sd.neutral?.top_comments) ? sd.neutral.top_comments : [],
                      negative: (typeof sd.negative === "object" && sd.negative?.top_comments) ? sd.negative.top_comments : [],
                    }
                  },
                  filteringMetadata: gs.filtering_metadata ?? undefined,
                }
              }
            }

            // Map topic_clustering → topicClustersData
            let mappedTopicClustersData: any = undefined
            if (tc) {
              mappedTopicClustersData = {
                clusters: tc.topic_clusters || tc.clusters || [],
                parent_themes: tc.parent_themes || [],
                hierarchy_map: tc.hierarchy_map || {},
                total_parent_themes: tc.total_parent_themes || (tc.parent_themes || []).length || 0,
                method: tc.method || "public_report",
                processing_time: tc.processing_time,
              }
            }

            // Map topic_gaps[] → contentGaps
            let mappedContentGaps: any = undefined
            if (Array.isArray(tg)) {
              mappedContentGaps = {
                botPercentage: 0,
                gapCoverageScore: Math.max(0, 100 - (tg.length * 10)),
                botDetectionEnabled: true,
                unansweredQuestions: tg.map((gap: any, idx: number) => {
                  const supportingComments = mapGapSupportingComments(gap, idx)
                  return { id: `gap-${idx}`, statement: gap.question_statement, type: "issue" as const, commentCount: supportingComments.length, supportingComments, isExpanded: false }
                }),
              }
            }

            // Map channel_trust → channelCredibility
            let mappedChannelCredibility: any = undefined
            if (ct && "trust_score" in ct && "metrics" in ct) {
              mappedChannelCredibility = {
                score: (ct as any).trust_score,
                factors: Object.entries((ct as any).metrics).map(([n, m]: [string, any]) => ({ name: n, weight: m.normalized_value, value: m.score?.toString() })),
                metrics: (ct as any).metrics,
                trust_score: (ct as any).trust_score,
                raw_metrics: (ct as any).raw_metrics,
                metric_details: (ct as any).metric_details,
              }
            }

            // Map relevancy → verdict fields
            let verdictRaw = "UNKNOWN", verdictCertainty = 0, confidencePercent = 0, relClaims: any[] = []
            if (rel) {
              const rd = (rel as any).data || rel
              verdictRaw = ((rd.verdict || "UNKNOWN") as string).toUpperCase()
              const confRaw = typeof rd.confidence_score === "number" ? rd.confidence_score : 0
              const confNorm = confRaw > 1.5 ? confRaw / 100 : Math.max(0, confRaw)
              verdictCertainty = Math.round(confNorm * 10 * 10) / 10
              confidencePercent = Math.round(confNorm * 100)
              // Backend sends field as `claims_data` (RelevancyData schema); fall back to `claims` for
              // the analyses-cache bundle shape (CachedRelevancy schema) which uses `claims`.
              relClaims = rd.claims_data || rd.claims || []
            }

            setVideoAnalysis(prev => {
              if (!prev) return prev
              return {
                ...prev,
                ...(meta?.video_title ? { videoTitle: meta.video_title } : {}),
                ...(meta?.channel_name ? { channelName: meta.channel_name } : {}),
                snapshotId: meta?.snapshot_id ?? prev.snapshotId,
                snapshotShareCode: meta?.share_token ?? prev.snapshotShareCode,
                isFullyPublic: meta?.is_fully_public ?? prev.isFullyPublic,
                maxCommentsRequested: meta?.max_comments_requested ?? prev.maxCommentsRequested,
                actualCommentsFetched: meta?.actual_comments_fetched ?? prev.actualCommentsFetched,
                ...(mappedSentiment ? { sentiment: mappedSentiment } : {}),
                ...(mappedTopicClustersData ? { topicClustersData: mappedTopicClustersData } : {}),
                ...(mappedContentGaps ? { contentGaps: mappedContentGaps } : {}),
                ...(mappedChannelCredibility ? { channelCredibility: mappedChannelCredibility } : {}),
                ...(rel ? {
                  trustScore: { score: verdictCertainty },
                  clickbaitVerdict: { verdict: verdictRaw },
                  summary: {
                    ...prev.summary,
                    trustScore: verdictCertainty,
                    clickbaitVerdict: {
                      ...(prev.summary?.clickbaitVerdict ?? {}),
                      label: verdictRaw,
                      confidence: confidencePercent,
                      claims: relClaims,
                    },
                  },
                } : {}),
              } as any
            })
          }}
        />

        {/* Community Verdict Teaser for Free Users */}
        {showCommunityTeaser && (
          <CommunityVerdictTeaser
            onUpgrade={() => {
              const dashboardUrl = userTierInfo?.dashboardUrl || `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
              chrome.tabs.create({ url: dashboardUrl })
              setShowCommunityTeaser(false)
            }}
            onRequestAnalysis={() => {
              // Future feature: queue analysis request
              alert("Analysis request submitted! You'll be notified when this video is analyzed by the community.")
              setShowCommunityTeaser(false)
            }}
          />
        )}

        {/* Analysis Settings Modal for Starter & PRO Users */}
        {settings && (
          <AnalysisSettingsModal
            isOpen={showSettingsModal}
            settings={settings}
            userTier={(userTierInfo?.tier || 'pro') as "free" | "starter" | "pro"}
            onClose={() => setShowSettingsModal(false)}
            onApply={(maxComments, customContext, forceRefresh) => {
              console.log("Analysis settings applied:", { maxComments, customContext, forceRefresh })
              
              // Update settings
              const newSettings = {
                ...settings,
                videoAnalysis: {
                  showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                  autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                  botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                  showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                  confirmCreditUsage: settings.videoAnalysis?.confirmCreditUsage ?? true,
                  maxCommentDepth: maxComments
                }
              }
              setSettings(newSettings)
              chrome.storage.sync.set({ settings: newSettings })
              
              // Start analysis with custom settings
              if (currentVideoId) {
                startVideoAnalysis(currentVideoId, forceRefresh)
              }
            }}
          />
        )}

        {/* Credit Confirmation Dialog */}
        {creditConfirmData && (
          <CreditConfirmationDialog
            isOpen={showCreditConfirmDialog}
            estimatedCredits={creditConfirmData.estimatedCredits}
            currentBalance={creditConfirmData.currentBalance}
            hasSufficientCredits={creditConfirmData.hasSufficientCredits}
            userTier={(userTierInfo?.tier || 'free') as "free" | "starter" | "pro"}
            isVerified={isUserVerified ?? true}
            freeQueueStatus={creditConfirmData.freeQueueStatus}
            isFetchingFreeQueueStatus={creditConfirmData.isFetchingFreeQueueStatus}
            freeQueueError={creditConfirmData.freeQueueError}
            onConfirm={creditConfirmData.onConfirm}
            onFreeQueueConfirm={creditConfirmData.onFreeQueueConfirm}
            onCancel={() => {
              setShowCreditConfirmDialog(false)
              setCreditConfirmData(null)
              // Re-open sidepanel if it was closed
              if (!isSidePanelOpen && analysisState === "complete") {
                setIsSidePanelOpen(true)
              }
            }}
            onUpgrade={() => {
              const portalUrl = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"
              const tier = userTierInfo?.tier || 'free'
              // Direct users to appropriate upgrade page based on current tier
              const upgradeUrl = tier === 'free' 
                ? `${portalUrl}/dashboard?tab=billing&purchase_type=tier`
                : tier === 'starter'
                ? `${portalUrl}/dashboard?tab=billing&purchase_type=tier`
                : `${portalUrl}/dashboard?tab=billing&purchase_type=tier`
              // Open URL in new tab (content scripts can't use chrome.tabs, so open directly)
              window.open(upgradeUrl, '_blank')
              setShowCreditConfirmDialog(false)
              setCreditConfirmData(null)
            }}
            onTopUp={() => {
              const dashboardUrl = userTierInfo?.dashboardUrl || `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
              window.open(`${dashboardUrl}?tab=credits&purchase_type=credits`, '_blank')
              setShowCreditConfirmDialog(false)
              setCreditConfirmData(null)
            }}
            onContactSales={() => {
              window.open("mailto:sales@commentverdict.com?subject=Enterprise%20Credits%20Inquiry", '_blank')
              setShowCreditConfirmDialog(false)
              setCreditConfirmData(null)
            }}
            onVerifyEmail={async () => {
              // Resend verification email
              try {
                await FocusGuardAPI.resendVerificationEmail()
                alert("Verification email sent! Please check your inbox.")
              } catch (error) {
                console.error("Failed to resend verification email:", error)
                alert("Failed to send verification email. Please try again later.")
              }
              setShowCreditConfirmDialog(false)
              setCreditConfirmData(null)
            }}
          />
        )}
      </>
    )
  }

  return null
}

export default ContentScript
