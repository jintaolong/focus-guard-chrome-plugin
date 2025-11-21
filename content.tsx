import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect } from "react"

import { ResultsList } from "~components/ResultsList"
import { SearchInterface } from "~components/SearchInterface"
import { FocusGuardAPI } from "~lib/api"
import type { VideoResult, UserStats } from "~types"

// Configure to only run on YouTube
export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  all_frames: false
}

const ContentScript = () => {
  const [results, setResults] = useState<VideoResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isYouTubeHome, setIsYouTubeHome] = useState(false)

  useEffect(() => {
    // Check if we're on YouTube home page
    const checkYouTubeHome = () => {
      const isHome =
        window.location.pathname === "/" ||
        window.location.pathname === "/feed/subscriptions" ||
        window.location.pathname === "/feed/trending"
      setIsYouTubeHome(isHome)
    }

    checkYouTubeHome()

    // Listen for URL changes (YouTube is a SPA)
    const observer = new MutationObserver(checkYouTubeHome)
    observer.observe(document.body, { childList: true, subtree: true })

    // Load user stats
    loadUserStats()

    return () => observer.disconnect()
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

  // Only render on YouTube home/feed pages
  if (!isYouTubeHome) return null

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

export default ContentScript
