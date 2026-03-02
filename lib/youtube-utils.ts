/**
 * YouTube Utilities
 * 
 * This module contains YouTube-specific utility functions for extracting
 * video information, detecting page changes, and interacting with YouTube's DOM.
 * 
 * Refactoring Guidelines:
 * - Move getVideoIdFromUrl() here from content.tsx
 * - Move extractVideoMetadata() here
 * - Move YouTube DOM manipulation functions here
 * - Move video page detection logic here
 * - Add helper functions for YouTube-specific operations
 */

/**
 * Extracts video ID from YouTube URL
 * Supports standard watch URLs, shorts, and youtu.be links
 * @param url - YouTube URL to parse
 * @returns Video ID or null if not found
 */
export function getVideoIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    
    // Standard watch page: /watch?v={id}
    const urlParams = new URLSearchParams(urlObj.search)
    const vParam = urlParams.get("v")
    if (vParam) return vParam
    
    // YouTube Shorts: /shorts/{id}
    const shortsMatch = urlObj.pathname.match(/^\/shorts\/([^/?]+)/)
    if (shortsMatch) return shortsMatch[1]
    
    // Short links: youtu.be/{id}
    if (urlObj.hostname === "youtu.be") {
      const pathParts = urlObj.pathname.split("/")
      if (pathParts[1]) return pathParts[1]
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Extracts video metadata from YouTube page DOM
 * @returns Object containing video title, channel name, and other metadata
 */
export function extractVideoMetadata(): {
  title: string | null
  channelName: string | null
  channelId: string | null
  viewCount: string | null
  uploadDate: string | null
} {
  // TODO: Move DOM extraction logic from content.tsx
  return {
    title: null,
    channelName: null,
    channelId: null,
    viewCount: null,
    uploadDate: null
  }
}

/**
 * Checks if current page is a valid YouTube video page
 * @param url - Current page URL
 * @returns Boolean indicating if on video page
 */
export function isVideoPage(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return (
      (urlObj.pathname === "/watch" && urlObj.searchParams.has("v")) ||
      urlObj.pathname.startsWith("/shorts/")
    )
  } catch {
    return false
  }
}

/**
 * Gets the primary column element where YouTube places video content
 * Used for injecting UI components in the correct location
 * @returns DOM element or null
 */
export function getYouTubePrimaryColumn(): HTMLElement | null {
  // TODO: Move DOM selector logic here
  return document.querySelector("#primary")
}

/**
 * Gets the secondary column element (sidebar area)
 * @returns DOM element or null
 */
export function getYouTubeSecondaryColumn(): HTMLElement | null {
  // TODO: Move DOM selector logic here
  return document.querySelector("#secondary")
}

/**
 * Detects when YouTube URL changes (for SPA navigation)
 * YouTube uses client-side routing, so we need to detect URL changes
 * @param callback - Function to call when URL changes
 * @returns Cleanup function to stop detecting
 */
export function observeYouTubeNavigation(
  callback: (newUrl: string, oldUrl: string) => void
): () => void {
  let previousUrl = window.location.href
  
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href
    if (currentUrl !== previousUrl) {
      callback(currentUrl, previousUrl)
      previousUrl = currentUrl
    }
  })
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  
  return () => observer.disconnect()
}

/**
 * Waits for a specific YouTube element to appear in the DOM
 * Useful for ensuring elements exist before interacting with them
 * @param selector - CSS selector to wait for
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves with element or null if timeout
 */
export function waitForYouTubeElement(
  selector: string,
  timeout: number = 5000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
    
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

/**
 * Gets video duration from YouTube page
 * @returns Duration in seconds or null if not found
 */
export function getVideoDuration(): number | null {
  // TODO: Extract video duration from DOM or video player
  return null
}

/**
 * Checks if video is a YouTube Short
 * @param url - YouTube URL to check
 * @returns Boolean indicating if it's a Short
 */
export function isYouTubeShort(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.startsWith("/shorts/")
  } catch {
    return false
  }
}
