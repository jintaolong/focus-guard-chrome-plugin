import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"

import { ResultsList } from "~components/ResultsList"
import { SearchInterface } from "~components/SearchInterface"
import { StatusChip } from "~components/StatusChip"
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

// Configure to only run on YouTube
export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/watch?v=*"],
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

const ContentScript = () => {
  // Original feed replacement state
  const [results, setResults] = useState<VideoResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isYouTubeHome, setIsYouTubeHome] = useState(false)

  // FR-102 & FR-103: Watch page analysis state
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<VideoAnalysisStatus | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([])
  const [onWatchPage, setOnWatchPage] = useState(false)
  const [showPreWatchPopover, setShowPreWatchPopover] = useState(false)
  const [preWatchDismissed, setPreWatchDismissed] = useState(false)

  useEffect(() => {
    // Check if we're on YouTube home page or watch page
    console.log("Focus Guard content script loaded");
    const checkPageType = () => {
      const isHome =
        window.location.pathname === "/" ||
        window.location.pathname === "/feed/subscriptions" ||
        window.location.pathname === "/feed/trending"
      const isWatch = isWatchPage()

      setIsYouTubeHome(isHome)
      setOnWatchPage(isWatch)
      console.log("Focus Guard checkPageType: isHome=", isHome, "isWatch=", isWatch, "href=", window.location.href)

      // FR-202: Auto-activate analysis on watch page
      if (isWatch) {
        const videoId = getVideoIdFromUrl(window.location.href)
        if (videoId && videoId !== currentVideoId) {
          setCurrentVideoId(videoId)
          startVideoAnalysis(videoId)
        }
      } else {
        setCurrentVideoId(null)
        setVideoAnalysis(null)
        setAnalysisStatus(null)
        setIsSidePanelOpen(false)
        setShowPreWatchPopover(false)
        setPreWatchDismissed(false)
      }
    }

    checkPageType()

    // // Listen for URL changes (YouTube is a SPA)
    // const observer = new MutationObserver(checkPageType)
    // observer.observe(document.body, { childList: true, subtree: true })

    // // Load user stats and history
    // loadUserStats()
    // loadAnalysisHistory()

    // return () => observer.disconnect()
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
    setAnalysisStatus({
      trustScore: 0,
      clickbaitVerdict: "LEGIT",
      isAnalyzing: true
    })

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
      // FR-101: Show pre-watch popover after analysis completes
      if (!preWatchDismissed) {
        setShowPreWatchPopover(true)
      }
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

  // FR-102 & FR-103: Inject Status Chip and Side Panel on watch page
  useEffect(() => {
    if (onWatchPage && analysisStatus) {
      injectWatchPageUI()
    }

    return () => {
      cleanupWatchPageUI()
    }
  }, [onWatchPage, analysisStatus, isSidePanelOpen])

  const injectWatchPageUI = () => {
    // FR-103: Inject Status Chip near video title
    const selectors = [
      "#title h1.ytd-watch-metadata",
      "#container h1.title",
      "h1.title",
      "h1.ytd-video-primary-info-renderer",
      "yt-formatted-string.ytd-video-primary-info-renderer"
    ]

    let titleElement: Element | null = null
    for (const sel of selectors) {
      titleElement = document.querySelector(sel)
      if (titleElement) {
        console.log("Focus Guard: found title element with selector:", sel, titleElement)
        break
      }
    }

    if (!titleElement) {
      console.log("Focus Guard: title element not found, skipping injection")
      return
    }

    if (!document.getElementById("focus-guard-status-chip")) {
      const chipContainer = document.createElement("div")
      chipContainer.id = "focus-guard-status-chip"
    // Render as a floating fixed element on the left so it doesn't block the video
    chipContainer.style.display = "inline-block"
    chipContainer.style.position = "fixed"
    chipContainer.style.left = "12px"
    chipContainer.style.top = "50%"
    chipContainer.style.transform = "translateY(-50%)"
    chipContainer.style.zIndex = "2147483647"

      // Prefer appending to the title's parent, but fall back to inserting after the title
      if (titleElement.parentElement) {
        titleElement.parentElement.appendChild(chipContainer)
        console.log("Focus Guard: appended chip to title parent")
      } else {
        titleElement.insertAdjacentElement("afterend", chipContainer)
        console.log("Focus Guard: inserted chip after title element")
      }

      const root = createRoot(chipContainer)
      root.render(
        <StatusChip
          status={analysisStatus}
          onViewReport={() => setIsSidePanelOpen(true)}
        />
      )
    }
  }

  const cleanupWatchPageUI = () => {
    const chipContainer = document.getElementById("focus-guard-status-chip")
    if (chipContainer) {
      console.log("Focus Guard: removing chip container")
      chipContainer.remove()
    }
  }

  // Render home/feed page overlay (original functionality)
  if (isYouTubeHome) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "white",
          zIndex: 9999,
          overflowY: "auto",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          animation: "fadeIn 0.4s ease-in"
        }}>
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}
        </style>
        <SearchInterface
          onSearch={handleSearch}
          isLoading={isLoading}
          userStats={userStats}
        />
        <ResultsList results={results} isLoading={isLoading} />
      </div>
    )
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
        
        {/* FR-102: Side Panel */}
        {/* Persistent left-side toggle so panel can be shown/hidden from the left edge */}
        <div
          id="focus-guard-sidepanel-toggle"
          style={{
            position: "fixed",
            left: "12px",
            top: "60%",
            transform: "translateY(-50%)",
            zIndex: 2147483650,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
          <button
            onClick={() => setIsSidePanelOpen((s) => !s)}
            title={isSidePanelOpen ? "Hide Focus Guard" : "Show Focus Guard"}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              border: `1px solid ${"#e5e7eb"}`,
              background: isSidePanelOpen ? "white" : "#111827",
              color: isSidePanelOpen ? "#111827" : "white",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)"
            }}>
            {isSidePanelOpen ? "✕" : "▸"}
          </button>
        </div>

        <SidePanel
        analysis={videoAnalysis}
        isLoading={isAnalyzing}
        isOpen={isSidePanelOpen}
        position="left"
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
