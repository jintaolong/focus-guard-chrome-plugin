import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

import { ResultsList } from "~components/ResultsList"
import { SearchInterface } from "~components/SearchInterface"
import { ToggleButton } from "~components/ToggleButton"
import { SidePanel } from "~components/SidePanel"
import { PreWatchPopover } from "~components/PreWatchPopover"
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
      maxCommentDepth: 100
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
    onConfirm: () => void
  } | null>(null)

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
          // Reset tier info cache for new video (will be fetched fresh on analysis)
          setUserTierInfo(null)
          
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
          if (!shouldAutoAnalyze) {
            // Don't auto-analyze; just reset state and wait for user to click the button
            // (cache check above will update toggle if cached report exists)
            console.log("Comment Verdict: Auto-analyze disabled, waiting for user action")
            setAnalysisState("idle")
            setAnalysisError(null)
            setCurrentJobId(null)
            setProgressPercent(null)
            setProgressMessage(null)
          }
          // A new page is assumed to be unanalyzed for development. Reset
          // the pre-watch dismissed flag so the popover appears after
          // analysis completes on this new page.
          setPreWatchDismissed(false)
          setShowPreWatchPopover(false)
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
        console.log("Comment Verdict: URL polling detected new video")
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
        
        // Leave defaults
        setAnalysisState("idle")
        setAnalysisStatus(null)
        setVideoAnalysis(null)
        setIsCheckingCache(false)
        return
      }

      // Cached - fetch relevancy and additional data for quick display
      try {
        console.log("Comment Verdict: Fetching analysis data for cached video...")
        
        // OPTIMIZATION: Fetch core data first (relevancy + summary) for fast UI update
        // Then fetch secondary data in background without blocking
        console.log("Comment Verdict: ⚡ Fetching core data (relevancy + summary)...")
        const coreStartTime = Date.now()
        const coreResults = await Promise.allSettled([
          FocusGuardAPI.analyzeRelevancyV2(videoId, false),
          FocusGuardAPI.analyzeSummaryV2({ video_id: videoId, force_refresh: false })
        ])
        const coreDuration = ((Date.now() - coreStartTime) / 1000).toFixed(2)
        console.log(`Comment Verdict: ✅ Core data fetched in ${coreDuration}s - IMMEDIATELY SHOWING RESULTS`)
        
        const relevancyData = coreResults[0].status === 'fulfilled' ? coreResults[0].value : null
        const summaryData = coreResults[1].status === 'fulfilled' ? coreResults[1].value : null
        
        if (!relevancyData) {
          throw new Error("Failed to fetch core relevancy data")
        }
        
        // Process core data immediately for fast UI response
        const verdictRaw = (relevancyData?.data.verdict || "UNKNOWN").toUpperCase()
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

        // Display core results immediately - NO MORE WAITING FOR SECONDARY DATA
        setVideoAnalysis({
          videoId: videoId,
          videoTitle: relevancyData?.data?.video_title || null,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          summary: minimalSummary,
          trustScore: { score: verdictCertainty },
          clickbaitVerdict: { verdict: verdictRaw },
          executiveSummary: summaryData?.summary_paragraph ?? null,
          maxCommentsRequested: summaryData?.max_comments_requested ?? null,
          actualCommentsFetched: summaryData?.actual_comments_fetched ?? null,
          channelCredibility: undefined,
          sentiment: undefined,
          credibility: null,
          topicClusters: null,
          topicClustersData: undefined,
          contentGaps: undefined,
          viewerInsights: undefined,
          reportInfo: {
            availableFormats: ["PDF", "TXT"],
            analysisDate: new Date().toISOString(),
            tierRestriction: null
          }
        } as any)

        setAnalysisStatus({
          trustScore: verdictCertainty,
          clickbaitVerdict: verdictRaw as "LEGIT" | "MISLEADING" | "CLICKBAIT",
          isAnalyzing: false
        })

        setAnalysisState("complete")
        setIsCheckingCache(false)
        console.log("Comment Verdict: ✅ SPINNER OFF - Core analysis displayed in ~${coreDuration}s")

        // NOW fetch secondary data WITHOUT blocking the spinner
        console.log("Comment Verdict: ⚡ Fetching secondary data in background (non-blocking)...")
        const secondaryPromise = Promise.allSettled([
          FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          FocusGuardAPI.analyzeChannelTrust(videoId, false),
          FocusGuardAPI.analyzeTopicClusteringV2(videoId, false).catch(err => {
            console.warn("Topic clustering failed (non-blocking):", err)
            return null
          }),
          FocusGuardAPI.analyzeTopicGapV2(videoId, false).catch(err => {
            console.warn("Topic gaps failed (non-blocking):", err)
            return null
          })
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
          const sentimentData = parsedSecondary.sentimentData
          const credibilityData = parsedSecondary.credibilityData
          const topicClustersData = parsedSecondary.topicClustersData
          const topicGapsData = parsedSecondary.topicGapsData
          const humanLikenessData = null

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
          
          if (userTier === 'free' && !sentimentTierRestriction) {
            console.log("Comment Verdict: 🚫 Blocking sentiment for free user")
            sentimentTierRestriction = {
              code: 'TIER_RESTRICTION' as const,
              required_tier: 'starter' as const,
              current_tier: userTier as 'pro' | 'free' | 'starter',
              message: 'Comment Sentiment analysis requires a Starter subscription.',
              upgrade_url: dashboardUrl
            }
          }

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
            const totalComments = data.data.total_comments ?? (positiveCount + neutralCount + negativeCount)
            const positiveComments = typeof data.data.positive === 'object' ? data.data.positive?.top_comments ?? [] : []
            const neutralComments = typeof data.data.neutral === 'object' ? data.data.neutral?.top_comments ?? [] : []
            const negativeComments = typeof data.data.negative === 'object' ? data.data.negative?.top_comments ?? [] : []

            return {
              positive: totalComments > 0 ? (positiveCount / totalComments) * 100 : 0,
              neutral: totalComments > 0 ? (neutralCount / totalComments) * 100 : 0,
              negative: totalComments > 0 ? (negativeCount / totalComments) * 100 : 0,
              totalCommentsAnalyzed: totalComments,
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
              return {
                score: data.trust_score,
                factors: Object.entries(data.metrics).map(([name, metricData]: [string, any]) => ({
                  name,
                  weight: metricData.normalized_value,
                  value: metricData.score.toString()
                })),
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
            
            // Skip update entirely if NO new data - return exact same object to prevent re-render
            if (!hasNewSentiment && !hasNewCredibility && !hasNewTopicClusters && !hasNewContentGaps) {
              console.log("Comment Verdict: ⏭️ Skipping secondary data update - no new data to add")
              return prev
            }
            
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
            const updatedAnalysis = {
              ...prev,
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
              } : prev.sentiment,
              // Only update viewerInsights if we have new data
              viewerInsights: hasNewSentiment && sentimentBreakdown ? {
                sentimentBreakdown: sentimentBreakdown,
                actionableInsights: (prev.viewerInsights && !Array.isArray(prev.viewerInsights)) ? prev.viewerInsights.actionableInsights : { highValue: [], improvements: [] },
                tierRestriction: topicClustersTierRestriction || undefined
              } : prev.viewerInsights,
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
              } : prev.contentGaps
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
        })

      } catch (err) {
        console.warn("Comment Verdict: failed to fetch relevancy on landing:", (err as any)?.message || String(err))
        // Don't reset state if we're currently polling a job - only reset if no active job
        if (!currentJobId) {
          setAnalysisState("idle")
          setAnalysisStatus(null)
          setVideoAnalysis(null)
        }
        setIsCheckingCache(false)
      }
    } catch (error) {
      console.log("Comment Verdict: cache check failed on landing (likely unauthenticated):", (error as any)?.message || String(error))
      setIsCached(false)
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
    // Check email verification status first
    try {
      const creditBalance = await FocusGuardAPI.getCreditBalance()
      // Assuming backend will add is_verified field to credit balance response
      // For now, we'll fetch from chrome.storage where popup stores it
      const storage = await chrome.storage.sync.get(['account'])
      const isVerified = storage.account?.is_verified !== false
      setIsUserVerified(isVerified)
      
      if (!isVerified) {
        // Show verification prompt dialog
        setCreditConfirmData({
          estimatedCredits: 0,
          currentBalance: creditBalance.credits_balance,
          hasSufficientCredits: false,
          onConfirm: () => {
            setShowCreditConfirmDialog(false)
            setCreditConfirmData(null)
          }
        })
        setShowCreditConfirmDialog(true)
        return
      }
    } catch (error) {
      console.warn("Failed to check verification status:", error)
    }
    
    // Fetch tier if not already cached (needed for credit estimation)
    let currentTier = userTierInfo?.tier || 'free'
    if (!userTierInfo) {
      console.log("⏱️ Fetching subscription tier for credit estimate...")
      try {
        const subscription = await SubscriptionService.getSubscription()
        currentTier = subscription.tier?.toLowerCase() || 'free'
        const dashboardUrl = `${process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"}/dashboard`
        setUserTierInfo({ tier: currentTier, dashboardUrl })
        console.log(`✅ Subscription tier fetched: ${currentTier}`)
      } catch (error) {
        console.warn("Failed to fetch tier info, defaulting to free:", error)
        currentTier = 'free'
      }
    }
    
    // Check if we should confirm credit usage
    const shouldConfirm = settings?.videoAnalysis?.confirmCreditUsage !== false
    
    if (shouldConfirm) {
      // Estimate credit cost with tier-based limit enforcement
      const settingsMaxComments = settings?.videoAnalysis?.maxCommentDepth || 100
      const maxCommentDepth = currentTier === 'pro' ? settingsMaxComments : Math.min(settingsMaxComments, 100)
      console.log("💰 Credit Estimate Params:", { tier: currentTier, settingsMaxComments, maxCommentDepth, settings: settings?.videoAnalysis })
      try {
        const estimate = await FocusGuardAPI.estimateCreditCost(maxCommentDepth, false)
        console.log("💰 Credit Estimate Response:", estimate)
        
        // Show credit confirmation dialog
        setCreditConfirmData({
          estimatedCredits: estimate.estimated_credits,
          currentBalance: estimate.current_balance,
          hasSufficientCredits: estimate.has_sufficient_credits,
          onConfirm: () => {
            setShowCreditConfirmDialog(false)
            setCreditConfirmData(null)
            // Proceed with analysis
            proceedWithAnalysis(videoId, forceRefresh)
          }
        })
        setShowCreditConfirmDialog(true)
        return // Wait for user confirmation
      } catch (error) {
        console.warn("Failed to estimate credit cost, proceeding anyway:", error)
        // Proceed without confirmation if estimate fails
        proceedWithAnalysis(videoId, forceRefresh)
        return
      }
    } else {
      // No confirmation needed - proceed directly
      proceedWithAnalysis(videoId, forceRefresh)
    }
  }

  const proceedWithAnalysis = async (videoId: string, forceRefresh: boolean = false) => {
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
      
      // Ensure settings are loaded before proceeding - load fresh from storage
      let currentSettings = settings
      if (!currentSettings) {
        console.warn("⚠️ Settings not loaded in state, loading from storage...")
        const result = await chrome.storage.sync.get(["settings"])
        currentSettings = result.settings || null
        if (currentSettings) {
          setSettings(currentSettings)
        }
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
          // Enforce tier-based limits: free/starter capped at 100, PRO can go higher
          const maxComments = currentTier === 'pro' ? settingsMaxComments : Math.min(settingsMaxComments, 100)
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
        
        // Check if job result contains optimized data structure (new backend implementation)
        const hasOptimizedData = resultData && 
                                  resultData.summary && 
                                  resultData.relevancy && 
                                  resultData.sentiment &&
                                  resultData.channel_credibility &&
                                  resultData.topic_clusters &&
                                  resultData.topic_gaps
        
        if (hasOptimizedData) {
          // NEW OPTIMIZED PATH: Extract all data from job result (no additional API calls needed)
          console.log("✅ Using optimized job result data (all analysis included)")
          
          // Debug: Log the raw result_data structure
          console.log("🔍 DEBUG result_data.sentiment:", resultData.sentiment)
          console.log("🔍 DEBUG result_data.channel_credibility:", resultData.channel_credibility)
          
          // Transform job result data to match expected endpoint response formats
          summaryData = {
            status: 'SUCCESS',
            summary_paragraph: resultData.summary.summary_paragraph,
            video_id: resultData.video_id,
            snapshot_id: resultData.snapshot_id,
            cache_hit: resultData.cache_hit,
            data_hash: '',
            video_title: resultData.video_title,
            credibility_score: resultData.channel_credibility.score,
            sentiment_score: 0, // Will be calculated from sentiment data
            persona: resultData.summary.persona,
            key_takeaways: resultData.summary.key_takeaways,
            confidence: null
          }
          
          relevancyData = {
            status: 'SUCCESS',
            video_id: resultData.video_id,
            video_title: resultData.video_title,
            data: resultData.relevancy,
            cache_hit: resultData.cache_hit,
            note: null
          }
          
          sentimentData = {
            status: 'SUCCESS',
            video_id: resultData.video_id,
            video_title: resultData.video_title,
            data: resultData.sentiment,
            cache_hit: resultData.cache_hit,
            note: null,
            filtering_metadata: resultData.sentiment?.filtering_metadata
          }
          
          console.log("🔍 DEBUG transformed sentimentData:", sentimentData)
          
          credibilityData = {
            status: 'SUCCESS',
            video_id: resultData.video_id,
            video_title: resultData.video_title,
            channel_id: resultData.channel_credibility.channel_id,
            channel_name: resultData.channel_credibility.channel_name,
            score: resultData.channel_credibility.score,
            normalized_factors: resultData.channel_credibility.normalized_factors,
            factual_factors: resultData.channel_credibility.factual_factors,
            computed_at: resultData.channel_credibility.computed_at,
            cache_hit: resultData.cache_hit
          }
          
          topicClustersData = {
            status: 'SUCCESS',
            video_id: resultData.video_id,
            video_title: resultData.video_title,
            topic_clusters: resultData.topic_clusters.clusters,
            processing_time: resultData.topic_clusters.processing_time,
            cache_hit: resultData.cache_hit
          }
          
          topicGapsData = {
            status: 'SUCCESS',
            video_id: resultData.video_id,
            video_title: resultData.video_title,
            topic_gaps: resultData.topic_gaps.gaps,
            filtered_question_count: resultData.topic_gaps.filtered_question_count,
            processing_time: resultData.topic_gaps.processing_time,
            cache_hit: resultData.cache_hit,
            filtering_metadata: resultData.topic_gaps?.filtering_metadata
          }
          
          humanLikenessData = null // Not included in job result
          
          const optimizedDuration = ((Date.now() - fetchStartTime) / 1000).toFixed(1)
          console.log(`✅ Optimized data extraction completed in ${optimizedDuration}s (saved ~18s!)`)
          
        } else {
          // FALLBACK PATH: Old behavior for backward compatibility (job result doesn't have optimized data)
          console.log("⚠️ Job result missing optimized data, falling back to individual endpoint fetches...")
          console.log("⏱️ Starting to fetch analysis data (post-job)...")
          
          // Step 3a.1: Fetch summary first (required by backend for other endpoints)
          console.log("⏱️ Fetching summary first (required by backend)...")
          const summaryFetchStart = Date.now()
          try {
            summaryData = await FocusGuardAPI.analyzeSummaryV2({ video_id: videoId, force_refresh: forceRefresh })
            const summaryDuration = ((Date.now() - summaryFetchStart) / 1000).toFixed(1)
            console.log(`✅ Summary data fetched in ${summaryDuration}s`)
          } catch (error) {
            console.error("Failed to fetch summary:", error)
          }
          
          // Step 3a.2: Fetch remaining endpoints in parallel (after summary exists)
          console.log("⏱️ Fetching remaining analysis data in parallel...")
          const parallelFetchStart = Date.now()
          const results = await Promise.allSettled([
            FocusGuardAPI.analyzeRelevancyV2(videoId, forceRefresh),
            FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: forceRefresh }),
            FocusGuardAPI.analyzeChannelTrust(videoId, forceRefresh),
            FocusGuardAPI.analyzeTopicClusteringV2(videoId, forceRefresh),
            FocusGuardAPI.analyzeTopicGapV2(videoId, forceRefresh)
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
          console.log("Comment Verdict: Fetching summary first (required by backend)...")
          try {
            summaryData = await FocusGuardAPI.analyzeSummaryV2({ video_id: videoId, force_refresh: forceRefresh })
            console.log("Comment Verdict: Summary data received")
          } catch (error) {
            console.error("Failed to fetch summary:", error)
          }
        }
        
        // Step 2: Fetch remaining data in parallel (after summary is guaranteed to exist)
        // NOTE: channel-trust (credibility) is skipped when it was already attempted
        // in the fallback path and failed – retrying a 502/504 endpoint can stall
        // Promise.allSettled indefinitely on a slow server and block all results.
        const remainingResults = await Promise.allSettled([
          sentimentData ? Promise.resolve(sentimentData) : FocusGuardAPI.analyzeSentimentV2({ video_id: videoId, force_refresh: forceRefresh }),
          (credibilityData || credibilityAttempted) ? Promise.resolve(credibilityData) : FocusGuardAPI.analyzeChannelTrust(videoId, forceRefresh),
          topicClustersData ? Promise.resolve(topicClustersData) : FocusGuardAPI.analyzeTopicClusteringV2(videoId, forceRefresh),
          topicGapsData ? Promise.resolve(topicGapsData) : FocusGuardAPI.analyzeTopicGapV2(videoId, forceRefresh)
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
            // NEW format: ChannelTrustResponse
            return {
              score: credibilityData.trust_score,
              factors: Object.entries(credibilityData.metrics).map(([name, metricData]: [string, any]) => ({
                name,
                weight: metricData.normalized_value,
                value: metricData.score.toString()
              })),
              // Include full new format data
              metrics: credibilityData.metrics,
              trust_score: credibilityData.trust_score,
              raw_metrics: credibilityData.raw_metrics,
              metric_details: credibilityData.metric_details
            }
          } else {
            // OLD format: ChannelCredibilityResponseV2
            return {
              score: credibilityData.score,
              factors: credibilityData.normalized_factors ? Object.entries(credibilityData.normalized_factors).map(([name, weight]) => ({
                name,
                weight,
                value: credibilityData.factual_factors?.[name] ?? 'N/A'
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
      
      // Block sentiment for free users only (Starter+ can access)
      if (userTier === 'free' && !sentimentTierRestriction) {
        sentimentTierRestriction = {
          code: 'TIER_RESTRICTION' as const,
          required_tier: 'starter' as const,
          current_tier: userTier,
          message: 'Comment Sentiment analysis requires a Starter subscription.',
          upgrade_url: dashboardUrl
        }
      }
      
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
      
      const videoAnalysisData = {
        // Video identification
        videoId: videoId,
        videoTitle: relevancyData?.data?.video_title || null,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        // Legacy shape support
        summary: minimalSummary,
        trustScore: { score: verdictCertainty },
        clickbaitVerdict: { verdict: verdictRaw },
        executiveSummary: summaryData?.summary_paragraph ?? null,
        // Comment count tracking
        maxCommentsRequested: (resultData as any)?.max_comments_requested ?? summaryData?.max_comments_requested ?? null,
        actualCommentsFetched: (resultData as any)?.actual_comments_fetched ?? summaryData?.actual_comments_fetched ?? null,
        channelCredibility: credibilityData ? (() => {
          // Handle both new (trust_score + metrics) and old (score + normalized_factors) formats
          if ('trust_score' in credibilityData && 'metrics' in credibilityData) {
            // NEW format: ChannelTrustResponse
            return {
              score: credibilityData.trust_score,
              factors: Object.entries(credibilityData.metrics).map(([name, metricData]: [string, any]) => ({
                name,
                weight: metricData.normalized_value,
                value: metricData.score.toString()
              })),
              // Include full new format data
              metrics: credibilityData.metrics,
              trust_score: credibilityData.trust_score,
              raw_metrics: credibilityData.raw_metrics,
              metric_details: credibilityData.metric_details
            }
          } else {
            // OLD format: ChannelCredibilityResponseV2
            return {
              score: credibilityData.score,
              factors: credibilityData.normalized_factors ? Object.entries(credibilityData.normalized_factors).map(([name, weight]) => ({
                name,
                weight,
                value: credibilityData.factual_factors?.[name] ?? 'N/A'
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

      // FR-101: Show pre-watch popover after analysis completes
      setShowPreWatchPopover(true)
    } catch (error) {
      console.error("Video analysis failed:", error)
      
      // Check if polling was aborted (user switched videos)
      if (error instanceof Error && error.message === "Polling aborted") {
        console.log("Polling aborted due to video switch - this is expected")
        // Don't set error state, just reset to idle
        setAnalysisState("idle")
        setCurrentJobId(null)
        return
      }
      
      // Simplify error messages for common cases
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
        } else if (msg.includes("auth") || msg.includes("login") || msg.includes("401")) {
          errorMessage = "Please log in"
        } else if (msg.includes("network") || msg.includes("connection")) {
          errorMessage = "Network error"
        } else {
          errorMessage = error.message
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
    return (
      <>
        {/* FR-101: Pre-Watch Popover */}
        {showPreWatchPopover && (
          <PreWatchPopover
            analysis={videoAnalysis}
            isLoading={isAnalyzing}
            panelDock={panelDock}
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
              onToggle={() => {
                if (isCheckingCache) {
                  // Do nothing while checking cache
                  return
                }
                if (analysisState === "idle") {
                  // Start analysis when in idle state
                  if (currentVideoId) {
                    startVideoAnalysis(currentVideoId)
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

            {/* Settings Button for PRO users - temporarily hidden */}
            {false && userTierInfo?.tier === 'pro' && analysisState === 'idle' && (
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
          onForceRefresh={() => {
            if (currentVideoId) {
              startVideoAnalysis(currentVideoId, true)
            }
          }}
          progressPercent={progressPercent}
          progressMessage={progressMessage}
          panelDock={panelDock}
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

        {/* Analysis Settings Modal for PRO Users */}
        {settings && (
          <AnalysisSettingsModal
            isOpen={showSettingsModal}
            settings={settings}
            onClose={() => setShowSettingsModal(false)}
            onApply={(maxComments, customContext, forceRefresh) => {
              console.log("Analysis settings applied:", { maxComments, customContext, forceRefresh })
              
              // Update settings
              const newSettings = {
                ...settings,
                videoAnalysis: {
                  ...settings.videoAnalysis,
                  maxCommentDepth: maxComments
                }
              }
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
            onConfirm={creditConfirmData.onConfirm}
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
