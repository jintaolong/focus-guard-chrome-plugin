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
  className = ""
}: CommentDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Normalize comment to work with both string and CommentObject formats
  const isCommentObject = typeof comment === 'object' && comment !== null
  
  const commentText = isCommentObject 
    ? (comment.text || "") 
    : (typeof comment === 'string' ? comment : "")
  
  const authorName = isCommentObject 
    ? (comment.author_display_name || comment.user || comment.author || null)
    : null
  
  const likes = isCommentObject 
    ? (comment.likes || 0) 
    : 0
  
  const youtubeCommentId = isCommentObject 
    ? (comment.youtube_comment_id || null)
    : null
  
  const createdAt = isCommentObject 
    ? (comment.created_at || null)
    : null
  
  const isCleaned = isCommentObject 
    ? (comment.is_cleaned || false)
    : false

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
      // Same video - update URL without page reload and let YouTube scroll to comment
      const newUrl = `${window.location.pathname}?v=${videoId}&lc=${youtubeCommentId}`
      
      // Update URL without reload
      window.history.pushState({}, '', newUrl)
      
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
        // Comment is loaded, scroll to it
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
        // Comment not loaded yet - offer a subtle jump option instead of forcing a scroll
        console.log('Comment not found, offering jump to comments...', youtubeCommentId)
        const commentsSection = document.querySelector('ytd-comments#comments') || document.querySelector('#comments')

        // Helper to show a subtle toast with optional action
        const showToast = (msg: string, actionLabel?: string, onAction?: () => void) => {
          try {
            const id = `cv-toast-${Math.random().toString(36).slice(2,8)}`
            const el = document.createElement('div')
            el.id = id
            el.style.position = 'fixed'
            el.style.right = '18px'
            el.style.bottom = '18px'
            el.style.padding = '8px 12px'
            el.style.background = 'rgba(0,0,0,0.8)'
            el.style.color = 'white'
            el.style.fontSize = '12px'
            el.style.borderRadius = '8px'
            el.style.zIndex = '2147483647'
            el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2)'
            el.style.cursor = actionLabel ? 'pointer' : 'default'
            el.textContent = msg
            if (actionLabel && onAction) {
              const btn = document.createElement('span')
              btn.style.marginLeft = '8px'
              btn.style.padding = '4px 8px'
              btn.style.background = 'rgba(255,255,255,0.06)'
              btn.style.borderRadius = '6px'
              btn.style.fontWeight = '700'
              btn.style.marginRight = '0'
              btn.textContent = actionLabel
              el.appendChild(btn)
              el.onclick = (ev) => { ev.stopPropagation(); onAction(); document.body.removeChild(el) }
            }
            document.body.appendChild(el)
            setTimeout(() => { try { if (document.body.contains(el)) document.body.removeChild(el) } catch(e){} }, 3500)
          } catch (er) { /* ignore */ }
        }

        const startPollingAndObserve = () => {
          if (!commentsSection) {
            showToast('Comments section not available on this page.')
            return
          }
          commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })

          // Wait for YouTube to load the comment (with timeout). Use both polling and a MutationObserver that
          // looks for anchors with &lc= or new comment thread nodes.
          let attempts = 0
          const maxAttempts = 30 // ~15 seconds
          const intervalMs = 500

          // Observer to detect new nodes or anchor links
          const observer = new MutationObserver((mutations, obs) => {
            const found = findCommentElement()
            if (found) {
              obs.disconnect()
              clearInterval(checkInterval)
              found.scrollIntoView({ behavior: 'smooth', block: 'center' })
              const originalBg = (found as HTMLElement).style.backgroundColor
              const originalTransition = (found as HTMLElement).style.transition
              ;(found as HTMLElement).style.transition = 'background-color 0.2s ease'
              ;(found as HTMLElement).style.backgroundColor = '#fff3cd'
              setTimeout(() => {
                (found as HTMLElement).style.backgroundColor = originalBg
                setTimeout(() => {
                  (found as HTMLElement).style.transition = originalTransition
                }, 150)
              }, 800)
            }
          })

          observer.observe(document.body, { childList: true, subtree: true })

          const checkInterval = setInterval(() => {
            attempts++
            const loadedComment = findCommentElement()

            if (loadedComment || attempts >= maxAttempts) {
              clearInterval(checkInterval)
              observer.disconnect()
              if (loadedComment) {
                loadedComment.scrollIntoView({ behavior: 'smooth', block: 'center' })
                const originalBg = (loadedComment as HTMLElement).style.backgroundColor
                const originalTransition = (loadedComment as HTMLElement).style.transition
                ;(loadedComment as HTMLElement).style.transition = 'background-color 0.2s ease'
                ;(loadedComment as HTMLElement).style.backgroundColor = '#fff3cd'
                setTimeout(() => {
                  (loadedComment as HTMLElement).style.backgroundColor = originalBg
                  setTimeout(() => {
                    (loadedComment as HTMLElement).style.transition = originalTransition
                  }, 150)
                }, 800)
              } else {
                console.warn('Comment not found after waiting:', youtubeCommentId)
                try {
                  const anchors = Array.from(document.querySelectorAll('a[href*="&lc="]'))
                    .map(a => (a as HTMLAnchorElement).href)
                    .filter(h => h.includes(`&lc=${youtubeCommentId}`))
                  console.log('Permalink anchors matching comment id:', anchors)
                } catch (err) {
                  // ignore
                }

                // Fallback: try to find the comment by matching a text snippet and/or author name
                const findByTextAuthor = () => {
                  const snippet = commentText ? commentText.substring(0, 40).trim() : ''
                  const author = authorName ? authorName.trim() : ''
                  const candidates = Array.from(document.querySelectorAll('ytd-comment-renderer, ytd-comment-thread-renderer'))
                  for (const c of candidates) {
                    try {
                      const contentEl = (c as Element).querySelector && (c as Element).querySelector('#content-text')
                      const content = contentEl ? (contentEl.textContent || '') : ((c as HTMLElement).textContent || '')
                      const authorEl = (c as Element).querySelector && ((c as Element).querySelector('#author-text')?.textContent || '')
                      if (snippet && content && content.indexOf(snippet) !== -1) return c
                      if (author && authorEl && authorEl.indexOf(author) !== -1) return c
                    } catch (er) {
                      // ignore DOM reading errors
                    }
                  }
                  return null
                }

                const fuzzy = findByTextAuthor()
                if (fuzzy) {
                  console.log('Found comment by text/author fallback for', youtubeCommentId)
                  fuzzy.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  const originalBg = (fuzzy as HTMLElement).style.backgroundColor
                  const originalTransition = (fuzzy as HTMLElement).style.transition
                  ;(fuzzy as HTMLElement).style.transition = 'background-color 0.2s ease'
                  ;(fuzzy as HTMLElement).style.backgroundColor = '#fff3cd'
                  setTimeout(() => {
                    (fuzzy as HTMLElement).style.backgroundColor = originalBg
                    setTimeout(() => {
                      (fuzzy as HTMLElement).style.transition = originalTransition
                    }, 150)
                  }, 800)
                } else {
                  // Final fallback: show a subtle toast offering to open the permalink
                  showToast('Comment not found on this page.', 'Open', () => { if (commentLink) window.location.href = commentLink })
                }
              }
            }
          }, intervalMs)
        }

        // Offer jump action to the user instead of auto-scrolling
        showToast('Comment not found on page.', 'Jump', startPollingAndObserve)
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

  // Handle deleted/cleaned comments
  if (isCleaned) {
    return (
      <div
        className={className}
        style={{
          padding: "10px 12px",
          backgroundColor: COLORS.ui.background,
          borderLeft: `3px solid ${borderColor}`,
          borderRadius: "4px",
          opacity: 0.6
        }}>
        <div
          style={{
            fontSize: "12px",
            color: COLORS.ui.textSecondary,
            fontStyle: "italic"
          }}
          title="Comment removed after 30-day retention period per YouTube Data Policy">
          [Comment removed after 30-day retention period]
        </div>
      </div>
    )
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
                title="Jump to this comment on YouTube">
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
