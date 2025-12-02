import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

import { ResultsList } from "~components/ResultsList"
import { SearchInterface } from "~components/SearchInterface"
import { ToggleButton } from "~components/ToggleButton"
import { SidePanel } from "~components/SidePanel"
import { PreWatchPopover } from "~components/PreWatchPopover"
import { FocusGuardAPI } from "~lib/api"
import { getRandomMockAnalysis } from "~lib/mockData"
import type { VideoResult, UserStats } from "~types"
import type {
  VideoAnalysis,
  VideoAnalysisStatus,
  AnalysisHistoryItem
} from "~types/analysis"

// Configure content-script matches. Use a static literal so Plasmo can
// generate a valid manifest. During development we accept broader matches
// so the content script can be debugged across YouTube pages. Narrow this
// before packaging for production if desired.
export const config: PlasmoCSConfig = {
  matches: ["https://*.youtube.com/*", "https://youtube.com/*", "https://youtu.be/*"],
  all_frames: false
}

// Helper to extract video ID from YouTube URL
function getVideoIdFromUrl(url: string): string | null {
  const urlParams = new URLSearchParams(new URL(url).search)
  return urlParams.get("v")
}

// Helper to check if we're on a watch page
function isWatchPage(): boolean {
  return window.location.pathname === "/watch" && !!getVideoIdFromUrl(window.location.href)
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

  useEffect(() => {
    // Check if we're on YouTube home page or watch page
    console.log("Focus Guard content script loaded");
    // Print build-time debug flag so we can confirm whether the bundle
    // was built with `FOCUS_GUARD_DEBUG=1`.
    console.log("Focus Guard BUILD_DEBUG=", BUILD_DEBUG)
    console.log("Focus Guard RUNTIME_DEBUG=", RUNTIME_DEBUG, "DEBUG=", DEBUG)
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
          // A new page is assumed to be unanalyzed for development. Reset
          // the pre-watch dismissed flag so the popover appears after
          // analysis completes on this new page.
          setPreWatchDismissed(false)
          setShowPreWatchPopover(false)
        } else if (DEBUG && !videoId) {
          // In debug mode, start in idle state
          setAnalysisState("idle")
          setVideoAnalysis(null)
          setAnalysisStatus(null)
        }
      } else {
        currentVideoIdRef.current = null
        setCurrentVideoId(null)
        setVideoAnalysis(null)
        setAnalysisStatus(null)
        setAnalysisState("idle")
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

    return () => {
      try {
        history.pushState = originalPush
        history.replaceState = originalReplace
      } catch (e) {}
      window.removeEventListener("popstate", popstateHandler)
      window.removeEventListener("locationchange", onLocationChange)
      clearInterval(urlCheckInterval)
    }
  }, [])

  useEffect(() => {
    if (isYouTubeHome) {
      // Hide YouTube's default feed
      hideYouTubeFeed()
    } else {
      // Show YouTube's default content on other pages
      showYouTubeFeed()
    }
  }, [isYouTubeHome])

  const hideYouTubeFeed = () => {
    const style = document.createElement("style")
    style.id = "focus-guard-hide-feed"
    style.textContent = `
      ytd-browse[page-subtype="home"],
      ytd-browse[page-subtype="subscriptions"],
      ytd-browse[page-subtype="trending"],
      #contents.ytd-rich-grid-renderer {
        animation: fadeOutBlur 0.6s ease-out forwards;
      }
      
      @keyframes fadeOutBlur {
        0% {
          opacity: 1;
          filter: blur(0px);
        }
        100% {
          opacity: 0;
          filter: blur(10px);
          pointer-events: none;
        }
      }
    `
    document.head.appendChild(style)
  }

  const showYouTubeFeed = () => {
    const style = document.getElementById("focus-guard-hide-feed")
    if (style) {
      style.remove()
    }
  }

  const loadUserStats = async () => {
    try {
      const stats = await FocusGuardAPI.getUserStats()
      setUserStats(stats)
    } catch (error) {
      console.error("Failed to load user stats:", error)
      // Mock data for development
      setUserStats({
        searchesUsedToday: 0,
        searchesRemaining: 3,
        tier: "free",
        resetTime: new Date(
          new Date().setHours(24, 0, 0, 0)
        ).toISOString()
      })
    }
  }

  const loadAnalysisHistory = async () => {
    try {
      const response = await FocusGuardAPI.getAnalysisHistory()
      setAnalysisHistory(response.history)
    } catch (error) {
      console.error("Failed to load analysis history:", error)
      setAnalysisHistory([])
    }
  }

  // FR-202: Start video analysis automatically on watch page
  const startVideoAnalysis = async (videoId: string) => {
    setIsAnalyzing(true)
    setAnalysisState("analyzing")
    setAnalysisStatus(null)
    setVideoAnalysis(null)

    // Simulate 3-5 second delay for demo/development
    const delay = 3000 + Math.random() * 2000 // 3-5 seconds
    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      // Production code:
      // const response = await FocusGuardAPI.analyzeVideo({ videoId })
      // setVideoAnalysis(response.analysis)
      // setAnalysisStatus({
      //   trustScore: response.analysis.summary.trustScore,
      //   clickbaitVerdict: response.analysis.summary.clickbaitVerdict.label,
      //   isAnalyzing: false
      // })

      // Development mock data (statically imported to avoid missing chunk errors):
      const mockAnalysis = getRandomMockAnalysis()
      setVideoAnalysis(mockAnalysis)
      setAnalysisStatus({
        trustScore: mockAnalysis.trustScore.score,
        clickbaitVerdict: mockAnalysis.clickbaitVerdict.verdict.toUpperCase(),
        isAnalyzing: false
      })
      setAnalysisState("complete")
      
      // FR-101: Show pre-watch popover after analysis completes
      // Always show the popover when analysis completes (it will be reset per-video)
      setShowPreWatchPopover(true)
    } catch (error) {
      console.error("Video analysis failed:", error)
      // Use mock data for development (statically imported fallback)
      const mockAnalysis = getRandomMockAnalysis()
      setVideoAnalysis(mockAnalysis)
      setAnalysisStatus({
        trustScore: mockAnalysis.trustScore.score,
        clickbaitVerdict: mockAnalysis.clickbaitVerdict.verdict.toUpperCase(),
        isAnalyzing: false
      })
      setAnalysisState("complete")
      
      // FR-101: Show pre-watch popover after analysis completes
      // Always show the popover when analysis completes (it will be reset per-video)
      setShowPreWatchPopover(true)
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
    }
  }

  const handleReAnalyze = async (videoId: string) => {
    if (videoId === currentVideoId) {
      startVideoAnalysis(videoId)
    }
  }

  const handleSearch = async (query: string) => {
    if (!userStats || userStats.searchesRemaining <= 0) return

    setIsLoading(true)
    try {
      const response = await FocusGuardAPI.search({ query })
      setResults(response.results)
      setUserStats((prev: UserStats | null) =>
        prev
          ? {
              ...prev,
              searchesRemaining: response.searchesRemaining,
              searchesUsedToday: prev.searchesUsedToday + 1
            }
          : null
      )
    } catch (error) {
      console.error("Search failed:", error)
      // Mock data for development
      setResults([
        {
          id: "1",
          title: "Understanding Climate Change: The Science Explained",
          channelName: "ScienceExplained",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          relevanceScore: 0.95,
          transcriptSentiment: { score: 0.8, label: "positive" },
          commentSentiment: { score: 0.6, label: "neutral" },
          duration: "12:34",
          viewCount: "1.2M"
        }
      ])
      setUserStats((prev: UserStats | null) =>
        prev
          ? {
              ...prev,
              searchesRemaining: prev.searchesRemaining - 1,
              searchesUsedToday: prev.searchesUsedToday + 1
            }
          : null
      )
    } finally {
      setIsLoading(false)
    }
  }

  // FR-102: SidePanel and Toggle injection handled by React render below

  const injectWatchPageUI = () => {
    // Legacy StatusChip injection removed; ToggleButton now rendered by React.
  }

  // Note: cleanupWatchPageUI removed (StatusChip no longer injected)

  // // Render home/feed page overlay (original functionality)
  // if (isYouTubeHome) {
  //   return (
  //     <div
  //       style={{
  //         position: "fixed",
  //         top: 0,
  //         left: 0,
  //         width: "100%",
  //         height: "100%",
  //         backgroundColor: "white",
  //         zIndex: 9999,
  //         overflowY: "auto",
  //         fontFamily:
  //           '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  //         animation: "fadeIn 0.4s ease-in"
  //       }}>
  //       <style>
  //         {`
  //           @keyframes fadeIn {
  //             from { opacity: 0; }
  //             to { opacity: 1; }
  //           }
  //         `}
  //       </style>
  //       <SearchInterface
  //         onSearch={handleSearch}
  //         isLoading={isLoading}
  //         userStats={userStats}
  //       />
  //       <ResultsList results={results} isLoading={isLoading} />
  //     </div>
  //   )
  // }

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
          <ToggleButton
            trustScore={analysisStatus?.trustScore}
            verdict={analysisStatus?.clickbaitVerdict}
            dock={panelDock}
            state={analysisState}
            onToggle={() => {
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
