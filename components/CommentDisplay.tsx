// Reusable CommentDisplay component for YouTube Data Policy compliance
// Displays author attribution and creates anchor links to YouTube comments

import { useState } from "react"
import type { CommentObject } from "~types/analysis"
import { COLORS } from "~lib/colors"

interface CommentDisplayProps {
  comment: string | CommentObject | any
  videoId: string
  maxLength?: number // For text truncation (default: no truncation)
  showLikes?: boolean // Show likes count (default: true)
  showAuthor?: boolean // Show author name (default: true)
  showDate?: boolean // Show comment date (default: false)
  borderColor?: string // Border color for the comment box
  backgroundColor?: string // Background color for the comment box
  className?: string
  panelDock?: "left" | "right" // Side panel docking position for toast alignment
}

export const CommentDisplay = ({
  comment,
  videoId,
  maxLength,
  showLikes = true,
  showAuthor = true,
  showDate = false,
  borderColor = COLORS.ui.border,
  backgroundColor = COLORS.ui.surface,
  className = "",
  panelDock = "right"
}: CommentDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Normalize comment to work with both string and CommentObject formats
  const isCommentObject = typeof comment === 'object' && comment !== null
  
  const normalizeText = (value: any): string => {
    if (typeof value === "string") return value
    if (!value || typeof value !== "object") return ""
    // Nested CommentObject: { text: "..." }
    if (typeof value.text === "string") return value.text
    if (typeof value.content === "string") return value.content
    if (typeof value.body === "string") return value.body
    if (typeof value.message === "string") return value.message
    if (typeof value.comment_text === "string") return value.comment_text
    // Deeply nested: { text: { text: "..." } }
    if (value.text && typeof value.text === "object" && typeof value.text.text === "string") return value.text.text
    return ""
  }

  const commentText = isCommentObject
    ? normalizeText(comment.text)
    : normalizeText(comment)

  const rawAuthor = isCommentObject
    ? (comment.author_display_name || comment.user || comment.author || null)
    : null

  const authorName = typeof rawAuthor === "string"
    ? rawAuthor
    : (rawAuthor && typeof rawAuthor.name === "string" ? rawAuthor.name : null)
  
  const likes = isCommentObject 
    ? (comment.likes || 0) 
    : 0
  
  const youtubeCommentId = isCommentObject 
    ? (comment.youtube_comment_id || null)
    : null
  
  const createdAt = isCommentObject 
    ? (comment.created_at || null)
    : null
  
  // Only show the "cleaned" banner when the comment is *genuinely* deleted:
  // - must be a CommentObject (not a plain string)
  // - is_cleaned must be strictly true (not 1, not "true")
  // - and there must be no recoverable text anywhere in the object
  const hasAnyText = !!(commentText ||
    (isCommentObject && (
      (typeof comment.text === "string" && comment.text) ||
      (typeof comment.body === "string" && comment.body) ||
      (typeof comment.message === "string" && comment.message) ||
      (comment.text && typeof comment.text === "object" && comment.text.text)
    ))
  )
  if (isCommentObject && comment.is_cleaned === true && !hasAnyText) {
    console.warn("CommentDisplay: showing cleaned banner for comment", comment)
  }
  const isCleaned = isCommentObject && comment.is_cleaned === true && !hasAnyText

  // Build YouTube comment anchor link - only if both videoId and commentId exist
  const commentLink = youtubeCommentId && videoId && videoId !== "" 
    ? `https://www.youtube.com/watch?v=${videoId}&lc=${youtubeCommentId}`
    : null
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && youtubeCommentId && !commentLink) {
    console.warn('CommentDisplay: Missing videoId for comment link', { 
      youtubeCommentId, 
      videoId, 
      hasVideoId: !!videoId,
      videoIdEmpty: videoId === ""
    })
  }

  // Handler to scroll to comment on YouTube page
  const handleCommentLinkClick = (e: React.MouseEvent) => {
    if (!commentLink) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const currentUrl = new URL(window.location.href)
    const targetUrl = new URL(commentLink)
    
    // Check if we're on the same video page
    const currentVideoId = currentUrl.searchParams.get('v')
    const targetVideoId = targetUrl.searchParams.get('v')
    
    if (currentVideoId === targetVideoId) {
      // Same video - find comment first, only update URL / trigger the content-script
      // scrollToLinkedComment when the comment is NOT already visible.
      // Calling pushState when the comment IS visible would trigger the content-script's
      // scroll loop unnecessarily, causing out-of-control scrolling.

      // Helper function to find comment element using multiple strategies
      const findCommentElement = () => {
        // Strategy 1: Find by youtube_comment_id in various attributes on comment thread
        let element = document.querySelector(`ytd-comment-thread-renderer[has-comment-id="${youtubeCommentId}"]`) ||
                     document.querySelector(`ytd-comment-thread-renderer[comment-id="${youtubeCommentId}"]`)

        if (element) return element

        // Strategy 2: Find all comment threads and check their internal data (YouTube bundles sometimes attach ids)
        const allComments = document.querySelectorAll('ytd-comment-thread-renderer')
        for (const comment of allComments) {
          const commentData = (comment as any).__data
          const commentId = commentData?.commentId || commentData?.comment?.commentId || commentData?.commentIdStr
          if (commentId === youtubeCommentId) {
            return comment
          }
        }

        // Strategy 3: Look for any element whose id or data-comment-id contains the comment id
        const allElements = document.querySelectorAll('[id], [data-comment-id]')
        for (const el of allElements) {
          const id = el.getAttribute('id') || el.getAttribute('data-comment-id') || ''
          if (id && id.indexOf(youtubeCommentId) !== -1) {
            return el
          }
        }

        // Strategy 4: Search for any anchor whose href contains the lc= comment id (permalink anchors)
        const anchors = document.querySelectorAll('a[href*="&lc="]')
        for (const a of anchors) {
          const href = (a as HTMLAnchorElement).href || ''
          if (href.indexOf(`&lc=${youtubeCommentId}`) !== -1) {
            // Prefer the nearest comment-thread ancestor
            const thread = (a as HTMLElement).closest('ytd-comment-thread-renderer') || a.closest('ytd-comment-renderer')
            if (thread) return thread
            return a as Element
          }
        }

        // Strategy 5: Anchors exist but may use different LC ids. Try matching by content/author.
        try {
          const snippet = commentText ? commentText.substring(0, 80).trim().toLowerCase() : ''
          const author = authorName ? authorName.trim().toLowerCase() : ''
          if (snippet || author) {
            for (const a of document.querySelectorAll('a[href*="&lc="]')) {
              const thread = (a as HTMLElement).closest('ytd-comment-thread-renderer') || a.closest('ytd-comment-renderer')
              if (!thread) continue
              try {
                const contentEl = thread.querySelector && thread.querySelector('#content-text')
                const content = contentEl ? (contentEl.textContent || '') : ((thread as HTMLElement).textContent || '')
                const authorEl = thread.querySelector && (thread.querySelector('#author-text')?.textContent || '')
                const contentLower = (content || '').toLowerCase()
                const authorLower = (authorEl || '').toLowerCase()
                if (snippet && contentLower.indexOf(snippet) !== -1) return thread
                if (author && authorLower.indexOf(author) !== -1) return thread
              } catch (er) {
                // ignore
              }
            }
          }
        } catch (er) {
          // ignore
        }

        return null
      }
      
      const commentElement = findCommentElement()
      
      if (commentElement) {
        // Comment is already loaded — scroll to it directly without touching the URL.
        // NOT updating the URL means the content-script's scrollToLinkedComment is
        // never triggered for this case, preventing the out-of-control scroll loop.
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Highlight briefly
        const originalBg = (commentElement as HTMLElement).style.backgroundColor
        const originalTransition = (commentElement as HTMLElement).style.transition
        ;(commentElement as HTMLElement).style.transition = 'background-color 0.2s ease'
        ;(commentElement as HTMLElement).style.backgroundColor = '#fff3cd'
        setTimeout(() => {
          (commentElement as HTMLElement).style.backgroundColor = originalBg
          setTimeout(() => {
            (commentElement as HTMLElement).style.transition = originalTransition
          }, 150)
        }, 800)
      } else {
        // Comment not yet in DOM — offer manual scroll option.
        // Do NOT call pushState here: doing so would trigger the content-script's
        // scrollToLinkedComment loop in parallel with scrollToLoadMore, creating two
        // independent scroll loops that race each other and never cleanly stop.
        console.log('Comment not found, offering jump to comments...', youtubeCommentId)
        const commentsSection = document.querySelector('ytd-comments#comments') || document.querySelector('#comments')

        // Enhanced toast with multiple action buttons
        const showToast = (msg: string, actions?: Array<{ label: string; callback: () => void }>) => {
          try {
            const id = `cv-toast-${Math.random().toString(36).slice(2,8)}`
            const el = document.createElement('div')
            el.id = id
            el.style.position = 'fixed'
            // Position toast on the same side as the panel to avoid overlapping it
            if (panelDock === 'left') {
              el.style.left = '18px'
              el.style.right = ''
            } else {
              el.style.right = '18px'
              el.style.left = ''
            }
            el.style.bottom = '18px'
            el.style.padding = '12px 16px'
            el.style.background = 'rgba(0,0,0,0.9)'
            el.style.color = 'white'
            el.style.fontSize = '12px'
            el.style.borderRadius = '8px'
            el.style.zIndex = '2147483647'
            el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)'
            el.style.maxWidth = '320px'
            el.style.fontWeight = '500'
            el.innerHTML = `<div>${msg}</div><div style="font-size: 10px; margin-top: 4px; opacity: 0.7; font-weight: 400;">Comments are loaded as needed. Try scrolling down on YouTube to load more.</div>`
            
            if (actions && actions.length > 0) {
              const buttonContainer = document.createElement('div')
              buttonContainer.style.display = 'flex'
              buttonContainer.style.gap = '6px'
              buttonContainer.style.marginTop = '8px'
              buttonContainer.style.flexWrap = 'wrap'
              
              actions.forEach(({ label, callback }) => {
                const btn = document.createElement('button')
                btn.textContent = label
                btn.style.padding = '4px 8px'
                btn.style.background = 'rgba(255,255,255,0.15)'
                btn.style.border = '1px solid rgba(255,255,255,0.25)'
                btn.style.borderRadius = '4px'
                btn.style.color = 'white'
                btn.style.fontSize = '11px'
                btn.style.fontWeight = '600'
                btn.style.cursor = 'pointer'
                btn.style.transition = 'all 0.2s'
                btn.onmouseenter = () => {
                  btn.style.background = 'rgba(255,255,255,0.25)'
                  btn.style.borderColor = 'rgba(255,255,255,0.4)'
                }
                btn.onmouseleave = () => {
                  btn.style.background = 'rgba(255,255,255,0.15)'
                  btn.style.borderColor = 'rgba(255,255,255,0.25)'
                }
                btn.onclick = (ev) => {
                  ev.stopPropagation()
                  callback()
                  if (document.body.contains(el)) {
                    document.body.removeChild(el)
                  }
                }
                buttonContainer.appendChild(btn)
              })
              
              el.appendChild(buttonContainer)
            }
            
            document.body.appendChild(el)
            setTimeout(() => { try { if (document.body.contains(el)) document.body.removeChild(el) } catch(e){} }, 5000)
          } catch (er) { /* ignore */ }
        }

        // Progressively scroll down the comments section to trigger YouTube lazy-loading.
        // Returns a stop function the caller can invoke to cancel mid-scroll.
        const scrollToLoadMore = (onFound: (el: Element) => void, onNotFound: () => void): (() => void) => {
          if (!commentsSection) {
            onNotFound()
            return () => {}
          }
          // Scroll to comments section first
          commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })

          let scrollAttempts = 0
          const maxScrollAttempts = 20 // scroll up to 20 times (~10 seconds)
          const scrollIntervalMs = 500
          let stopped = false

          const scrollInterval = setInterval(() => {
            if (stopped) { clearInterval(scrollInterval); return }
            scrollAttempts++
            // Try finding the comment after each scroll
            const found = findCommentElement()
            if (found) {
              clearInterval(scrollInterval)
              onFound(found)
              return
            }
            if (scrollAttempts >= maxScrollAttempts) {
              clearInterval(scrollInterval)
              onNotFound()
              return
            }
            // Scroll down incrementally to load more comments
            window.scrollBy({ top: 800, behavior: 'smooth' })
          }, scrollIntervalMs)

          // Return a stop function so the caller can cancel anytime
          return () => {
            stopped = true
            clearInterval(scrollInterval)
          }
        }

        const highlightElement = (el: Element) => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          const originalBg = (el as HTMLElement).style.backgroundColor
          const originalTransition = (el as HTMLElement).style.transition
          ;(el as HTMLElement).style.transition = 'background-color 0.2s ease'
          ;(el as HTMLElement).style.backgroundColor = '#fff3cd'
          setTimeout(() => {
            (el as HTMLElement).style.backgroundColor = originalBg
            setTimeout(() => { (el as HTMLElement).style.transition = originalTransition }, 150)
          }, 800)
        }

        // Helper: show a persistent "searching…" toast with a ⏹ Stop button while scroll is running.
        // Returns a dismiss function.
        const showSearchingToast = (stopFn: () => void): (() => void) => {
          try {
            const el = document.createElement('div')
            el.style.position = 'fixed'
            if (panelDock === 'left') { el.style.left = '18px'; el.style.right = '' }
            else { el.style.right = '18px'; el.style.left = '' }
            el.style.bottom = '18px'
            el.style.padding = '12px 16px'
            el.style.background = 'rgba(0,0,0,0.9)'
            el.style.color = 'white'
            el.style.fontSize = '12px'
            el.style.borderRadius = '8px'
            el.style.zIndex = '2147483647'
            el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)'
            el.style.maxWidth = '320px'
            el.style.fontWeight = '500'

            const msgDiv = document.createElement('div')
            msgDiv.textContent = 'Searching for comment…'
            el.appendChild(msgDiv)

            const subDiv = document.createElement('div')
            subDiv.style.cssText = 'font-size:10px;margin-top:4px;opacity:0.7;font-weight:400'
            subDiv.textContent = 'Scrolling down to load more comments.'
            el.appendChild(subDiv)

            const stopBtn = document.createElement('button')
            stopBtn.textContent = '⏹ Stop Scrolling'
            stopBtn.style.cssText = 'margin-top:8px;padding:4px 10px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:white;font-size:11px;font-weight:600;cursor:pointer'
            stopBtn.onmouseenter = () => { stopBtn.style.background = 'rgba(255,255,255,0.28)' }
            stopBtn.onmouseleave = () => { stopBtn.style.background = 'rgba(255,255,255,0.15)' }
            stopBtn.onclick = (ev) => {
              ev.stopPropagation()
              stopFn()
              if (document.body.contains(el)) document.body.removeChild(el)
            }
            el.appendChild(stopBtn)
            document.body.appendChild(el)

            const dismiss = () => { try { if (document.body.contains(el)) document.body.removeChild(el) } catch(e){} }
            // Safety auto-dismiss after 15 s (longer than max scroll time)
            setTimeout(dismiss, 15000)
            return dismiss
          } catch (er) {
            return () => {}
          }
        }

        // Toast: only the two useful options
        showToast('Comment not loaded yet. Comments load as you scroll down:', [
          { label: 'Scroll to Load More', callback: () => {
            // Use a mutable ref so the stop/dismiss handle is accessible inside
            // the scrollToLoadMore callbacks even though it's set right after.
            let dismissSearching: () => void = () => {}

            const stop = scrollToLoadMore(
              (el) => { dismissSearching(); highlightElement(el) },
              () => {
                dismissSearching()
                showToast('Comment not found. It may have been removed by the author or creator.', [
                  { label: 'Go to Comment on YouTube', callback: () => { if (commentLink) window.open(commentLink) } }
                ])
              }
            )
            // Show the "searching" toast with a stop button immediately after starting scroll
            dismissSearching = showSearchingToast(stop)
          }},
          { label: 'Go to Comment on YouTube', callback: () => { if (commentLink) window.open(commentLink) } }
        ])
      }
    } else {
      // Different video - navigate normally
      window.location.href = commentLink
    }
  }

  // Handle text truncation
  const shouldTruncate = maxLength && commentText.length > maxLength
  const displayText = shouldTruncate && !isExpanded
    ? commentText.substring(0, maxLength) + "..."
    : commentText

  // Hide deleted/cleaned comments entirely — they provide no useful information
  // Comments get cleaned by backend after 30-day retention; a force-refresh re-fetches them
  if (isCleaned) {
    return null
  }

  // Also hide comments with no displayable text at all (empty/corrupt data)
  if (!commentText.trim()) {
    return null
  }

  return (
    <div
      className={className}
      style={{
        padding: "10px 12px",
        backgroundColor,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: "4px",
        fontSize: "13px",
        lineHeight: "1.6",
        color: COLORS.ui.textPrimary
      }}>
      {/* Author name and likes */}
      {(showAuthor && authorName) || (showLikes && likes > 0) || commentLink ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
            fontSize: "11px"
          }}>
          {/* Author and anchor link */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {showAuthor && authorName && (
              <span
                style={{
                  fontWeight: "600",
                  color: COLORS.ui.textPrimary
                }}>
                {authorName}
              </span>
            )}
            {commentLink && (
              <a
                href={commentLink}
                onClick={handleCommentLinkClick}
                style={{
                  color: COLORS.ui.textSecondary,
                  textDecoration: "none",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  padding: "2px",
                  cursor: "pointer",
                  opacity: 0.6,
                  transition: "opacity 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.6"
                }}
                title="Jump to this comment on YouTube. If not found, you can scroll to Comments or open the full video page.">
                🔗
              </a>
            )}
          </div>

          {/* Likes */}
          {showLikes && likes > 0 && (
            <span
              style={{
                color: COLORS.ui.textSecondary,
                fontSize: "11px"
              }}>
              👍 {likes}
            </span>
          )}
        </div>
      ) : null}

      {/* Comment text */}
      <div
        style={{
          fontSize: "13px",
          color: COLORS.ui.textPrimary,
          lineHeight: "1.6",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}>
        {displayText}
      </div>

      {/* Show more/less button */}
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            marginTop: "6px",
            padding: "2px 6px",
            fontSize: "11px",
            color: COLORS.neutral.primary,
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline"
          }}>
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Created date */}
      {showDate && createdAt && (
        <div
          style={{
            marginTop: "6px",
            fontSize: "10px",
            color: COLORS.ui.textSecondary
          }}>
          {new Date(createdAt).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
