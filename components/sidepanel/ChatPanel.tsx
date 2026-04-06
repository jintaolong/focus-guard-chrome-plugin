// Chat Panel — FR: Chat Dialog for querying comments and report
// Renders below analysis in the SidePanel when analysis data is available.
// Uses chrome.runtime.connect Port for SSE streaming from background worker.
// Supports: model selection, meme generation, credit confirmation, session persistence.

import { useState, useEffect, useRef, useCallback, memo } from "react"
import { Send, AlertCircle, X, RefreshCw, MessageCircle, Image, ChevronDown } from "lucide-react"
import { useTheme } from "~components/SidePanel"
import { CHAT_PORT_NAME, CHAT_MAX_TURNS_PER_SESSION, CHAT_INPUT_MAX_LENGTH, RETRYABLE_ERROR_CODES } from "~lib/constants"
import { AuthService } from "~lib/auth"
import type { VideoAnalysis } from "~types/analysis"
import type { ChatMessage, ChatError, ChatPortMessage, MemeResponse, ChatCitationsMessage } from "~types/chat"
import { CHAT_MODELS } from "~types/chat"

interface ChatPanelProps {
  videoId: string | null
  analysis: VideoAnalysis | null
  userTier?: string
  sessionScopeId?: string | null
}

// ── Message formatter: handles bold, likes with 👍, and mention cleanup ────
const formatMessageContent = (content: string) => {
  const parts: (string | React.ReactNode)[] = []
  let lastIndex = 0

  // Regex to match: **bold text** (bold), (+ digits) (likes), @@text (mentions)
  const boldRegex = /\*\*([^*]+)\*\*/g
  const likesRegex = /\(\+(\d+)\)/g
  const doubleAtRegex = /@@+/g

  // First, replace all markdown patterns
  let temp = content
  temp = temp.replace(doubleAtRegex, "@")  // Clean up @@ → @

  // Split by bold first, then process likes
  const boldSplit = temp.split(boldRegex)
  for (let i = 0; i < boldSplit.length; i++) {
    const segment = boldSplit[i]
    if (i % 2 === 1) {
      // This is bold text (inside ** **)
      parts.push(<strong key={`bold-${i}`} style={{ fontWeight: "600" }}>{segment}</strong>)
    } else {
      // Regular text, now process likes
      let lastLikeIndex = 0
      const likeSplit = segment.split(likesRegex)
      for (let j = 0; j < likeSplit.length; j++) {
        const part = likeSplit[j]
        if (j % 2 === 1) {
          // This is a like count (the captured digits)
          parts.push(
            <span key={`likes-${i}-${j}`} style={{ display: "inline-flex", alignItems: "center", gap: "3px", marginLeft: "2px" }}>
              👍 <span style={{ fontSize: "12px" }}>{part}</span>
            </span>
          )
        } else {
          // Regular text
          parts.push(part)
        }
      }
    }
  }

  return parts.length > 0 ? parts : content
}

// ── Streaming message (memo'd to avoid re-rendering siblings) ──────────────
const StreamingMessage = memo(({ content, colors }: { content: string; colors: any }) => (
  <div style={{
    padding: "10px 14px",
    borderRadius: "12px 12px 12px 4px",
    backgroundColor: colors.ui.surface,
    color: colors.ui.text.primary,
    fontSize: "13px",
    lineHeight: "1.55",
    maxWidth: "85%",
    alignSelf: "flex-start",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  }}>
    {formatMessageContent(content) || "\u200B"}
    <span style={{
      display: "inline-block",
      width: "2px",
      height: "14px",
      backgroundColor: "#2563eb",
      marginLeft: "2px",
      verticalAlign: "text-bottom",
      animation: "cv-cursor-blink 1s step-end infinite",
    }} />
  </div>
))

// ── Meme display component ─────────────────────────────────────────────────
const MemeDisplay = ({ meme, colors }: { meme: MemeResponse; colors: any }) => (
  <div style={{
    padding: "10px 14px", borderRadius: "12px 12px 12px 4px",
    backgroundColor: colors.ui.surface, color: colors.ui.text.primary,
    fontSize: "13px", maxWidth: "85%", alignSelf: "flex-start",
  }}>
    <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", marginBottom: "8px" }}>
      <img src={meme.image_url} alt="Generated meme" style={{ width: "100%", borderRadius: "8px" }} />
      {meme.overlay_text?.top && (
        <div style={{
          position: "absolute", top: "8px", left: 0, right: 0,
          textAlign: "center", fontWeight: "900", fontSize: "18px",
          color: "white", textShadow: "2px 2px 4px rgba(0,0,0,0.8)", padding: "0 8px",
        }}>{meme.overlay_text.top}</div>
      )}
      {meme.overlay_text?.bottom && (
        <div style={{
          position: "absolute", bottom: "8px", left: 0, right: 0,
          textAlign: "center", fontWeight: "900", fontSize: "18px",
          color: "white", textShadow: "2px 2px 4px rgba(0,0,0,0.8)", padding: "0 8px",
        }}>{meme.overlay_text.bottom}</div>
      )}
    </div>
  </div>
)

export const ChatPanel = ({ videoId, analysis, userTier, sessionScopeId }: ChatPanelProps) => {
  const { colors } = useTheme()
  const effectiveSessionScopeId = sessionScopeId || "latest"
  const chatContextKey = `${videoId || "no-video"}::${effectiveSessionScopeId}`

  // ── State ─────────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<ChatError | null>(null)
  const [turnCount, setTurnCount] = useState(0)
  const [maxTurns, setMaxTurns] = useState(CHAT_MAX_TURNS_PER_SESSION)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [sessionErrorMessage, setSessionErrorMessage] = useState<string>("")

  // New feature state
  const [selectedModelId, setSelectedModelId] = useState<string>(CHAT_MODELS[2].id) // default until storage is read
  const modelStorageLoadedRef = useRef(false)
  const [isMemeMode, setIsMemeMode] = useState(false)
  const [isGeneratingMeme, setIsGeneratingMeme] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showCreditConfirm, setShowCreditConfirm] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [isFirstTurn, setIsFirstTurn] = useState(true)

  // Citations from the most recent assistant response
  type CitationItem = ChatCitationsMessage["citations"][string]
  const [lastCitations, setLastCitations] = useState<Record<string, CitationItem> | null>(null)
  const pendingCitationsRef = useRef<Record<string, CitationItem> | null>(null)

  // Refs for closure-safe access
  const streamingContentRef = useRef("")
  const streamCompletedRef = useRef(false)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastUserMessageRef = useRef<string>("")
  // Always reflects the latest chatContextKey so async callbacks can detect stale contexts
  const chatContextKeyRef = useRef(chatContextKey)

  // Restore persisted model preference on mount
  useEffect(() => {
    chrome.storage.local.get(['cv_chat_preferred_model'], (result) => {
      const saved = result.cv_chat_preferred_model
      if (saved && CHAT_MODELS.some(m => m.id === saved)) {
        setSelectedModelId(saved)
      }
      modelStorageLoadedRef.current = true
    })
  }, [])

  // Persist model preference when the user changes it (skip initial pre-load write)
  useEffect(() => {
    if (!modelStorageLoadedRef.current) return
    chrome.storage.local.set({ cv_chat_preferred_model: selectedModelId })
  }, [selectedModelId])

  // Sync streaming content to ref
  useEffect(() => {
    streamingContentRef.current = streamingContent
  }, [streamingContent])

  // Keep chatContextKeyRef in sync so in-flight createSession calls can detect staleness
  useEffect(() => {
    chatContextKeyRef.current = chatContextKey
  }, [chatContextKey])

  // ── Determine credit cost for first turn ──────────────────────────────
  const selectedModel = CHAT_MODELS.find(m => m.id === selectedModelId)
  const firstTurnCreditCost = !selectedModel
    ? 1
    : selectedModel.band === "premium"
    ? 2
    : 0

  // ── Session creation ──────────────────────────────────────────────────────
  const createSession = useCallback(async () => {
    if (!videoId || isCreatingSession) return
    // Capture the context key at call-time so we can detect if it changes while
    // async operations (storage reads, network requests) are in flight.
    const capturedContextKey = chatContextKeyRef.current
    setIsCreatingSession(true)
    setSessionError(null)
    setSessionErrorMessage("")

    try {
      const accessToken = await AuthService.ensureValidToken()
      const storageKey = `cv_chat_session_${videoId}_${effectiveSessionScopeId}`

      // 1. Check if we have a persisted session for this video
      const stored = await new Promise<Record<string, any>>(resolve =>
        chrome.storage.local.get([storageKey], resolve)
      )
      const storedSessionId: string | undefined = stored[storageKey]

      if (storedSessionId) {
        // Restore existing session — fetch history first to validate it
        try {
          const historyResp = await chrome.runtime.sendMessage({
            type: "FETCH_CHAT_HISTORY",
            payload: {
              session_id: storedSessionId,
              authHeaders: { Authorization: `Bearer ${accessToken}` },
            },
          })

          const isStale = !historyResp?.success ||
            (typeof historyResp?.error === 'string' && (
              historyResp.error.includes("not_found") ||
              historyResp.error.includes("session_not_found")
            ))

          if (isStale) {
            // Clear stale session from storage — fall through to create a new one
            chrome.storage.local.remove(storageKey)
          } else {
            // Guard: if context changed while fetching history, discard this result.
            // The outer finally will reset isCreatingSession so the auto-create
            // effect fires again for the correct (new) context.
            if (chatContextKeyRef.current !== capturedContextKey) return
            // Session is valid — apply it
            setSessionId(storedSessionId)
            if (historyResp.data?.messages?.length > 0) {
              setHistory(historyResp.data.messages.map((m: any) => ({
                role: m.role,
                content: m.content,
              })))
              setTurnCount(historyResp.data.turn_count ?? 0)
              setIsFirstTurn(false)
            } else {
              setHistory([])
              setTurnCount(0)
              setIsFirstTurn(true)
            }
            setIsCreatingSession(false)
            return
          }
        } catch {
          // Network failure — guard against stale context before optimistic restore
          if (chatContextKeyRef.current !== capturedContextKey) return
          // Still try to use the stored session optimistically
          setSessionId(storedSessionId)
          setHistory([])
          setTurnCount(0)
          setIsFirstTurn(true)
          setIsCreatingSession(false)
          return
        }
      }

      // 2. No stored session — create a new one
      const videoMetadata = {
        video_id: videoId,
        video_title: analysis?.videoTitle ?? "",
        channel_name: analysis?.channelName ?? "",
        channel_id: analysis?.channelTrust?.channel_id ?? "",
        video_url: analysis?.videoUrl ?? "",
      }

      // Collect example comments from sentiment distribution + content gaps
      const exPos = ((analysis?.sentiment?.distribution as any)?.exampleComments?.positive ?? []) as any[]
      const exNeu = ((analysis?.sentiment?.distribution as any)?.exampleComments?.neutral ?? []) as any[]
      const exNeg = ((analysis?.sentiment?.distribution as any)?.exampleComments?.negative ?? []) as any[]
      const gapComments = (analysis?.contentGaps?.unansweredQuestions ?? []).flatMap((q: any) => q.supportingComments ?? []) as any[]
      const allComments = [...exPos, ...exNeu, ...exNeg, ...gapComments]
      const comments = allComments.map((c: any) => ({
        comment_id: c.youtube_comment_id ?? String(c.id ?? ""),
        author: c.author_display_name ?? "",
        text: c.text ?? "",
        like_count: c.likes ?? 0,
        reply_count: 0,
        published_at: c.created_at ?? new Date().toISOString(),
        is_reply: false,
        parent_id: null,
      }))

      // Build flat report matching backend schema
      const dist = analysis?.sentiment?.distribution as any
      const total = (dist?.totalCommentsAnalyzed ?? 0) || 1
      const sentimentBreakdown = {
        positive: Math.round(((dist?.positive ?? 0) / total) * 100) / 100,
        neutral: Math.round(((dist?.neutral ?? 0) / total) * 100) / 100,
        negative: Math.round(((dist?.negative ?? 0) / total) * 100) / 100,
      }
      const trustScore: number =
        typeof analysis?.summary?.trustScore === "number"
          ? analysis.summary.trustScore
          : typeof (analysis?.trustScore as any)?.score === "number"
          ? (analysis?.trustScore as any).score
          : 5
      const sentimentSummary: string =
        analysis?.executiveSummary ??
        analysis?.summary?.key_takeaways?.join(", ") ??
        `Overall sentiment: ${analysis?.sentiment?.overall ?? "unknown"}. ${dist?.totalCommentsAnalyzed ?? 0} comments analyzed.`
      const clusters = (analysis?.topicClustersData?.clusters ?? []).map((c: any) => ({
        cluster_id: c.cluster_id ?? 0,
        label: c.statement ?? "",
        size: c.count ?? 0,
        representative_comment_ids: (c.supporting_quote_ids ?? []).map((id: any) => String(id)),
        summary: c.reasoning ?? c.statement ?? "",
        sentiment: "mixed",
      }))
      const topicGaps = (analysis?.contentGaps?.unansweredQuestions ?? []).map((q: any) => q.statement ?? "")
      const claimChecks = ((analysis?.summary as any)?.clickbaitVerdict?.claims ?? []).map((c: any) => ({
        claim: c.claim_text ?? c.claim ?? "",
        verdict: c.status ?? c.verdict ?? "unknown",
        reasoning: (c.danger_warnings ?? []).join("; ") || "",
        source_comment_ids: [...(c.evidence_for_ids ?? []), ...(c.evidence_against_ids ?? [])].map((id: any) => String(id)),
      }))
      const topComments = [...exPos, ...exNeu, ...exNeg]
        .sort((a: any, b: any) => (b.likes ?? 0) - (a.likes ?? 0))
        .slice(0, 10)
        .map((c: any) => c.text ?? "")

      const reportPayload = {
        sentiment_summary: sentimentSummary,
        sentiment_breakdown: sentimentBreakdown,
        clusters,
        topic_gaps: topicGaps,
        trust_score: trustScore,
        trust_reasoning: "",
        claim_checks: claimChecks,
        top_comments: topComments,
        generated_at: new Date().toISOString(),
      }

      const response = await chrome.runtime.sendMessage({
        type: "CREATE_CHAT_SESSION",
        payload: {
          video_id: videoId,
          video_metadata: videoMetadata,
          comments,
          report: reportPayload,
          snapshot_id: analysis?.snapshotId ?? null,
          authHeaders: { Authorization: `Bearer ${accessToken}` },
        },
      })

      // Guard: if context changed while the CREATE_CHAT_SESSION round-trip was
      // in flight, discard the new session so we don't pollute the wrong scope.
      if (chatContextKeyRef.current !== capturedContextKey) return

      if (response?.success) {
        const newSessionId = response.session_id
        // Persist session_id for this video so it survives remounts
        chrome.storage.local.set({ [storageKey]: newSessionId })
        setSessionId(newSessionId)
        if (response.max_turns) setMaxTurns(response.max_turns)
        setHistory([])
        setTurnCount(0)
        setIsFirstTurn(true)
      } else {
        setSessionError(response?.code || "session_creation_failed")
        setSessionErrorMessage(response?.message || "")
      }
    } catch (err) {
      setSessionError("network_error")
      setSessionErrorMessage("Could not reach the server.")
    } finally {
      setIsCreatingSession(false)
    }
  }, [videoId, isCreatingSession, analysis, effectiveSessionScopeId])

  // Auto-create session when videoId is available and no session exists
  useEffect(() => {
    if (videoId && !sessionId && !isCreatingSession && !sessionError) {
      createSession()
    }
  }, [videoId, sessionId, isCreatingSession, sessionError, createSession, chatContextKey])

  // Reset when video or snapshot context changes
  useEffect(() => {
    setSessionId(null)
    setHistory([])
    setTurnCount(0)
    setStreamingContent("")
    setIsStreaming(false)
    setError(null)
    setSessionError(null)
    setSessionErrorMessage("")
    setIsFirstTurn(true)
    setIsMemeMode(false)
    setShowCreditConfirm(false)
    setPendingMessage(null)
  }, [chatContextKey])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [streamingContent, history.length])

  // ── Cleanup port on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (portRef.current) {
        try { portRef.current.disconnect() } catch {}
        portRef.current = null
      }
    }
  }, [])

  // ── Generate meme ─────────────────────────────────────────────────────────
  const generateMeme = useCallback(async (prompt: string) => {
    if (!sessionId) return
    setIsGeneratingMeme(true)
    setError(null)
    setHistory(prev => [...prev, { role: "user" as const, content: `🎨 ${prompt}` }])
    setInputValue("")

    try {
      const accessToken = await AuthService.ensureValidToken()
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_MEME",
        payload: {
          session_id: sessionId,
          original_prompt: prompt,
          authHeaders: { Authorization: `Bearer ${accessToken}` },
        },
      })
      if (response?.success && response.data) {
        const meme: MemeResponse = response.data
        setHistory(prev => [...prev, { role: "assistant" as const, content: `[MEME]\n${JSON.stringify(meme)}` }])
      } else {
        setError({
          code: response?.code || "meme_generation_failed",
          message: response?.error?.detail || response?.error || "Meme generation failed.",
          retryable: false,
        })
      }
    } catch {
      setError({ code: "network_error", message: "Could not reach the server.", retryable: true })
    } finally {
      setIsGeneratingMeme(false)
    }
  }, [sessionId])

  // ── Core send (after credit confirmation) ─────────────────────────────────
  const doSubmitMessage = useCallback((message: string) => {
    if (!message || !sessionId || isStreaming || turnCount >= maxTurns) return
    if (message.length > CHAT_INPUT_MAX_LENGTH) return

    if (isMemeMode) { generateMeme(message); return }

    const priorHistory = [...history]
    setHistory(prev => [...prev, { role: "user" as const, content: message }])
    setInputValue("")
    setError(null)
    lastUserMessageRef.current = message
    setIsStreaming(true)
    setStreamingContent("")
    streamCompletedRef.current = false
    // Clear previous citations; any new citations will arrive before [DONE]
    setLastCitations(null)
    pendingCitationsRef.current = null

    const port = chrome.runtime.connect({ name: CHAT_PORT_NAME })
    portRef.current = port

    port.onMessage.addListener((msg: ChatPortMessage) => {
      switch (msg.type) {
        case "CHAT_TOKEN":
          setStreamingContent(prev => prev + (msg as any).token)
          break

        case "CHAT_DONE": {
          streamCompletedRef.current = true
          const finalContent = streamingContentRef.current
          setHistory(prev => [
            ...prev,
            { role: "assistant", content: finalContent },
          ])
          setStreamingContent("")
          setIsStreaming(false)
          setTurnCount(prev => prev + 1)
          setIsFirstTurn(false)
          // Promote any citations that arrived before [DONE]
          if (pendingCitationsRef.current) {
            setLastCitations(pendingCitationsRef.current)
            pendingCitationsRef.current = null
          }
          try { port.disconnect() } catch {}
          portRef.current = null
          break
        }

        case "CHAT_CITATIONS":
          pendingCitationsRef.current = (msg as ChatCitationsMessage).citations
          break

        case "CHAT_ERROR": {
          streamCompletedRef.current = true
          setIsStreaming(false)
          setStreamingContent("")
          const errMsg = msg as ChatPortMessage & { code: string; message: string }
          setError({
            code: errMsg.code,
            message: errMsg.message,
            retryable: RETRYABLE_ERROR_CODES.has(errMsg.code),
          })
          try { port.disconnect() } catch {}
          portRef.current = null
          break
        }
      }
    })

    port.onDisconnect.addListener(() => {
      portRef.current = null
      if (!streamCompletedRef.current) {
        setIsStreaming(false)
        setStreamingContent("")
        setError({
          code: "connection_lost",
          message: "Connection to the extension was interrupted. Please try again.",
          retryable: true,
        })
      }
    })

    port.postMessage({
      type: "CHAT_REQUEST",
      payload: { session_id: sessionId, message, history: priorHistory, model_id: selectedModelId },
    })
  }, [sessionId, isStreaming, turnCount, maxTurns, history, selectedModelId, isMemeMode, generateMeme])

  // ── Submit with credit confirmation gate ──────────────────────────────────
  const submitMessage = useCallback((text?: string) => {
    const message = (text ?? inputValue).trim()
    if (!message) return

    if (isFirstTurn && firstTurnCreditCost > 0) {
      setPendingMessage(message)
      setShowCreditConfirm(true)
      return
    }

    doSubmitMessage(message)
  }, [inputValue, isFirstTurn, firstTurnCreditCost, doSubmitMessage])

  const confirmCreditAndSend = useCallback(() => {
    setShowCreditConfirm(false)
    if (pendingMessage) {
      doSubmitMessage(pendingMessage)
      setPendingMessage(null)
    }
  }, [pendingMessage, doSubmitMessage])

  const cancelCreditConfirm = useCallback(() => {
    setShowCreditConfirm(false)
    setPendingMessage(null)
  }, [])

  // ── Retry ─────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    // Remove the last user message (optimistic append) if assistant didn't respond
    setHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === "user") {
        return prev.slice(0, -1)
      }
      return prev
    })
    setInputValue(lastUserMessageRef.current)
    setError(null)
  }, [])

  // ── Dismiss error ─────────────────────────────────────────────────────────
  const dismissError = useCallback(() => {
    // If last message is user with no assistant reply, remove it
    setHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === "user") {
        return prev.slice(0, -1)
      }
      return prev
    })
    setError(null)
  }, [])

  // ── Handle Enter key ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop propagation on all keys so YouTube/page hotkeys (space, f, k, etc.) don't fire
    e.stopPropagation()
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }, [submitMessage])

  const stopKeyPropagation = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
  }, [])

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    // Auto-resize
    const ta = e.target
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px"
  }, [])

  // ── Render states ─────────────────────────────────────────────────────────

  // Session creation loading
  if (isCreatingSession) {
    return (
      <div style={{
        padding: "40px 24px",
        textAlign: "center",
        color: colors.ui.text.secondary,
      }}>
        <div style={{
          width: "24px", height: "24px",
          margin: "0 auto 12px",
          border: `3px solid ${colors.ui.border}`,
          borderTopColor: "#2563eb",
          borderRadius: "50%",
          animation: "cv-spin 1s linear infinite",
        }} />
        <p style={{ margin: 0, fontSize: "13px" }}>Starting chat session...</p>
        <style>{`@keyframes cv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Session error
  if (sessionError) {
    const isCredits = sessionError === "insufficient_credits"
    const isProRequired = sessionError === "chat_requires_pro_subscription"
    return (
      <div style={{
        padding: "24px",
        textAlign: "center",
        color: colors.ui.text.secondary,
      }}>
        <AlertCircle size={24} style={{ color: colors.low.primary, margin: "0 auto 8px", display: "block" }} />
        <p style={{ margin: "0 0 12px", fontSize: "13px", color: colors.ui.text.primary }}>
          {isProRequired
            ? "Chat is available for PRO subscribers only."
            : isCredits
            ? "You don't have enough credits to start a chat session."
            : "Failed to start chat session. Please try again."}
        </p>
        {!!sessionErrorMessage && (
          <p style={{
            margin: "0 0 12px",
            fontSize: "12px",
            color: colors.ui.text.secondary,
            wordBreak: "break-word",
          }}>
            {sessionErrorMessage}
          </p>
        )}
        {isProRequired && (
          <button
            onClick={async () => {
              try {
                const { ConfigService } = await import("~lib/config")
                const config = await ConfigService.getConfig()
                chrome.runtime.sendMessage({ type: 'OPEN_TAB', url: `${config.portal_url}/dashboard` })
              } catch {}
            }}
            style={{
              padding: "8px 20px", borderRadius: "6px", border: "none",
              backgroundColor: "#7c3aed", color: "white",
              fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>
            Upgrade to PRO
          </button>
        )}
        {!isCredits && !isProRequired && (
          <button
            onClick={() => { setSessionError(null); setSessionErrorMessage(""); createSession() }}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "white",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}>
            Retry
          </button>
        )}
      </div>
    )
  }

  // Waiting for session
  if (!sessionId) {
    return null
  }

  const canSend = !isStreaming && !isGeneratingMeme && turnCount < maxTurns && inputValue.trim().length > 0 && inputValue.trim().length <= CHAT_INPUT_MAX_LENGTH
  const isLimitReached = turnCount >= maxTurns
  const isBusy = isStreaming || isGeneratingMeme

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
    }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "8px 12px",
        borderBottom: `1px solid ${colors.ui.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        gap: "6px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <MessageCircle size={14} style={{ color: "#2563eb" }} />
          <span style={{ fontSize: "12px", fontWeight: "700", color: colors.ui.text.primary }}>
            AI Chat
          </span>
        </div>

        {/* Model selector */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "3px 8px", borderRadius: "6px",
              border: `1px solid ${colors.ui.border}`,
              backgroundColor: "transparent", color: colors.ui.text.secondary,
              fontSize: "10px", cursor: "pointer",
            }}>
            {CHAT_MODELS.find(m => m.id === selectedModelId)?.label ?? "Model"}
            <ChevronDown size={10} />
          </button>
          {showModelSelector && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: "4px",
              backgroundColor: colors.ui.background, border: `1px solid ${colors.ui.border}`,
              borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 100, minWidth: "180px", overflow: "hidden",
            }}>
              {CHAT_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => { setSelectedModelId(model.id); setShowModelSelector(false) }}
                  style={{
                    width: "100%", padding: "8px 12px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    border: "none", backgroundColor: selectedModelId === model.id ? colors.ui.hover : "transparent",
                    color: colors.ui.text.primary, fontSize: "12px", cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.ui.hover }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selectedModelId === model.id ? colors.ui.hover : "transparent" }}>
                  <span>{model.label}</span>
                  <span style={{
                    fontSize: "9px", fontWeight: "700", padding: "1px 5px",
                    borderRadius: "3px",
                    backgroundColor: model.band === "premium" ? "#fef3c7" : "#dbeafe",
                    color: model.band === "premium" ? "#92400e" : "#1e40af",
                  }}>
                    {model.band === "premium" ? "2 cr" : "free"}
                  </span>
                </button>
              ))}
              <div style={{
                padding: "6px 12px", fontSize: "10px", color: colors.ui.text.tertiary,
                borderTop: `1px solid ${colors.ui.border}`,
              }}>
                Premium models: 3 sessions/day limit
              </div>
            </div>
          )}
        </div>

        <span style={{
          fontSize: "10px",
          fontWeight: "600",
          color: isLimitReached ? colors.low.primary : colors.ui.text.tertiary,
          padding: "2px 6px",
          borderRadius: "4px",
          backgroundColor: isLimitReached ? colors.low.light : "transparent",
        }}>
          {turnCount}/{maxTurns}
        </span>
      </div>

      {/* ── Credit confirmation dialog ────────────────────────────────────── */}
      {showCreditConfirm && (
        <div style={{
          margin: "8px 12px", padding: "12px",
          borderRadius: "8px", border: `1px solid ${colors.ui.border}`,
          backgroundColor: colors.ui.surface,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600", color: colors.ui.text.primary }}>
            Confirm credit usage
          </p>
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: colors.ui.text.secondary }}>
            {firstTurnCreditCost > 0
              ? `Your first message will use ${firstTurnCreditCost} credit${firstTurnCreditCost > 1 ? "s" : ""}. Subsequent turns in this session are free.`
              : "This model is free to use. No credits will be deducted."}
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={cancelCreditConfirm}
              style={{
                padding: "5px 14px", borderRadius: "6px",
                border: `1px solid ${colors.ui.border}`, backgroundColor: "transparent",
                color: colors.ui.text.secondary, fontSize: "12px", cursor: "pointer",
              }}>
              Cancel
            </button>
            <button
              onClick={confirmCreditAndSend}
              style={{
                padding: "5px 14px", borderRadius: "6px", border: "none",
                backgroundColor: "#2563eb", color: "white",
                fontSize: "12px", fontWeight: "600", cursor: "pointer",
              }}>
              {firstTurnCreditCost > 0 ? `Send (${firstTurnCreditCost} cr)` : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* ── Message list ──────────────────────────────────────────────────── */}
      <div
        ref={messageListRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}>
        {/* Empty state */}
        {history.length === 0 && !isStreaming && (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            gap: "12px",
          }}>
            <MessageCircle size={32} style={{ color: colors.ui.text.tertiary, opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: "13px", color: colors.ui.text.secondary }}>
              Ask anything about this video's comments and analysis.
            </p>
            {/* Suggestion chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginTop: "8px" }}>
              {[
                "What are the main concerns?",
                "Summarize the positive feedback",
                "Any controversial opinions?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInputValue(suggestion); submitMessage(suggestion) }}
                  disabled={isBusy}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "16px",
                    border: `1px solid ${colors.ui.border}`,
                    backgroundColor: "transparent",
                    color: colors.ui.text.secondary,
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.ui.hover
                    e.currentTarget.style.color = colors.ui.text.primary
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent"
                    e.currentTarget.style.color = colors.ui.text.secondary
                  }}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message history */}
        {history.map((msg, i) => {
          // Handle meme assistant messages
          if (msg.role === "assistant" && msg.content.startsWith("[MEME]\n")) {
            try {
              const memeData: MemeResponse = JSON.parse(msg.content.slice(7))
              return <div key={i}><MemeDisplay meme={memeData} colors={colors} /></div>
            } catch { /* fall through to normal render */ }
          }
          return msg.role === "user" ? (
            <div key={i} style={{
              padding: "10px 14px",
              borderRadius: "12px 12px 4px 12px",
              backgroundColor: "#2563eb",
              color: "white",
              fontSize: "13px",
              lineHeight: "1.55",
              maxWidth: "85%",
              alignSelf: "flex-end",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {msg.content}
            </div>
          ) : (
            <div key={i} style={{
              padding: "10px 14px",
              borderRadius: "12px 12px 12px 4px",
              backgroundColor: colors.ui.surface,
              color: colors.ui.text.primary,
              fontSize: "13px",
              lineHeight: "1.55",
              maxWidth: "85%",
              alignSelf: "flex-start",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {formatMessageContent(msg.content)}
            </div>
          )
        })}

        {/* Citations for the last assistant response */}
        {lastCitations && !isStreaming && Object.keys(lastCitations).length > 0 && (
          <div style={{
            alignSelf: "flex-start",
            maxWidth: "90%",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}>
            <span style={{ fontSize: "10px", fontWeight: "600", color: colors.ui.text.secondary, marginBottom: "2px" }}>
              Referenced comments:
            </span>
            {Object.entries(lastCitations).map(([idx, c]) => (
              <div
                key={idx}
                title={c.text}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                  padding: "6px 10px",
                  backgroundColor: colors.ui.surface,
                  border: `1px solid ${colors.ui.border}`,
                  borderRadius: "8px",
                  fontSize: "11px",
                  lineHeight: "1.45",
                  cursor: "default",
                }}>
                <span style={{
                  minWidth: "18px",
                  height: "18px",
                  borderRadius: "999px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  fontSize: "10px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {idx}
                </span>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: "600", color: colors.ui.text.primary }}>{c.author}</span>
                  {c.like_count > 0 && (
                    <span style={{ marginLeft: "6px", color: colors.ui.text.secondary }}>
                      👍 {c.like_count}
                    </span>
                  )}
                  {c.is_reply && (
                    <span style={{ marginLeft: "6px", fontSize: "10px", color: colors.ui.text.tertiary }}>↩ reply</span>
                  )}
                  <p style={{
                    margin: "2px 0 0",
                    color: colors.ui.text.secondary,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-word",
                  }}>
                    {c.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Streaming message */}
        {isStreaming && (
          <StreamingMessage content={streamingContent} colors={colors} />
        )}

        {/* Meme generating indicator */}
        {isGeneratingMeme && (
          <div style={{
            padding: "10px 14px", borderRadius: "12px 12px 12px 4px",
            backgroundColor: colors.ui.surface, color: colors.ui.text.secondary,
            fontSize: "13px", maxWidth: "85%", alignSelf: "flex-start",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <div style={{
              width: "16px", height: "16px",
              border: `2px solid ${colors.ui.border}`, borderTopColor: "#2563eb",
              borderRadius: "50%", animation: "cv-spin 1s linear infinite",
            }} />
            Generating meme...
          </div>
        )}

        {/* Turn limit message */}
        {isLimitReached && (
          <div style={{
            padding: "10px 14px",
            borderRadius: "8px",
            backgroundColor: colors.medium.light,
            color: colors.medium.text,
            fontSize: "12px",
            textAlign: "center",
          }}>
            You've reached the maximum number of turns for this session.
          </div>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          margin: "0 12px",
          padding: "8px 12px",
          borderRadius: "8px",
          backgroundColor: colors.low.light,
          color: colors.low.text,
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error.message}</span>
          {error.code === "band1_daily_limit_reached" && (
            <button
              onClick={() => { setSelectedModelId("llama-4-maverick"); setError(null) }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "rgba(0,0,0,0.1)",
                color: "inherit",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                flexShrink: 0,
              }}>
              Switch to free
            </button>
          )}
          {error.retryable && (
            <button
              onClick={handleRetry}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "rgba(0,0,0,0.1)",
                color: "inherit",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                flexShrink: 0,
              }}>
              <RefreshCw size={10} />
              Retry
            </button>
          )}
          <button
            onClick={dismissError}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: "2px",
              flexShrink: 0,
              display: "flex",
            }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Input bar ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "8px 12px",
        borderTop: `1px solid ${colors.ui.border}`,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        flexShrink: 0,
      }}>
        {/* Meme mode toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setIsMemeMode(!isMemeMode)}
            title={isMemeMode ? "Switch to chat mode" : "Switch to meme mode"}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "3px 8px", borderRadius: "6px",
              border: `1px solid ${isMemeMode ? "#7c3aed" : colors.ui.border}`,
              backgroundColor: isMemeMode ? "#ede9fe" : "transparent",
              color: isMemeMode ? "#7c3aed" : colors.ui.text.secondary,
              fontSize: "10px", fontWeight: "600", cursor: "pointer",
            }}>
            <Image size={12} />
            {isMemeMode ? "Meme mode" : "Meme"}
          </button>
          {isMemeMode && (
            <span style={{ fontSize: "10px", color: colors.ui.text.tertiary }}>
              Describe a meme to generate
            </span>
          )}
        </div>

        {/* Text input + send */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyUp={stopKeyPropagation}
          onKeyPress={stopKeyPropagation}
          maxLength={isMemeMode ? 1000 : CHAT_INPUT_MAX_LENGTH}
          disabled={isBusy || isLimitReached}
          placeholder={isLimitReached ? "Turn limit reached." : isMemeMode ? "Describe a meme from the comments..." : "Ask about the comments..."}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: `1px solid ${isMemeMode ? "#7c3aed" : colors.ui.border}`,
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "13px",
            lineHeight: "1.4",
            fontFamily: "inherit",
            backgroundColor: isBusy || isLimitReached ? colors.ui.surface : colors.ui.background,
            color: colors.ui.text.primary,
            outline: "none",
            minHeight: "36px",
            maxHeight: "120px",
            overflowY: "auto",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => { e.target.style.borderColor = isMemeMode ? "#7c3aed" : "#2563eb" }}
          onBlur={(e) => { e.target.style.borderColor = isMemeMode ? "#7c3aed" : colors.ui.border }}
        />
        <button
          onClick={() => submitMessage()}
          disabled={!canSend}
          title={isBusy ? "Processing..." : "Send"}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: canSend ? (isMemeMode ? "#7c3aed" : "#2563eb") : colors.ui.border,
            color: canSend ? "white" : colors.ui.text.disabled,
            cursor: canSend ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}>
          {isMemeMode ? <Image size={16} /> : <Send size={16} />}
        </button>
        </div>
      </div>

      {/* Blinking cursor keyframe */}
      <style>{`
        @keyframes cv-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes cv-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
