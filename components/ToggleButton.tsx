import { useState, useEffect, useRef } from "react";
import type React from "react";
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor, getClickbaitColorPart } from "~lib/colors";

interface ToggleButtonProps {
  // accepted shapes: a raw number, or an object like { score: number }
  trustScore?: number | { score?: number } | null
  verdict?: string | { verdict?: string } | null
  onToggle: () => void
  // parent-provided dock (controlled). If omitted, defaults to 'right'
  dock?: "left" | "right"
  onDockChange?: (pos: "left" | "right") => void
  // state: 'idle' = pre-analysis, 'analyzing' = in progress, 'complete' = results ready
  state?: "idle" | "analyzing" | "complete"
  // Whether the video is cached (true = cached, false = not cached, null = unknown)
  isCached?: boolean | null
  // Error message to display when analysis fails
  errorMessage?: string | null
  // Progress percentage (0-100) for async job tracking
  progressPercent?: number | null
  // Progress message from backend (e.g., "Analyzing comments...")
  progressMessage?: string | null
  // Whether to show cached verdict (from settings)
  showCachedVerdict?: boolean
}

type DockPosition = "left" | "right"

export const ToggleButton = ({ trustScore, verdict, onToggle, dock = "right", onDockChange, state = "complete", isCached = null, errorMessage = null, progressPercent = null, progressMessage = null, showCachedVerdict = false }: ToggleButtonProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const movedRef = useRef(false)
  const [dockPosition, setDockPosition] = useState<DockPosition>(dock)

  // Normalize score to a finite number when possible
  const numericScore = (() => {
    if (typeof trustScore === "number" && Number.isFinite(trustScore)) return trustScore
    if (trustScore && typeof (trustScore as any).score === "number" && Number.isFinite((trustScore as any).score))
      return (trustScore as any).score
    return NaN
  })()

  const scoreDisplay = Number.isFinite(numericScore) ? numericScore.toFixed(1) : "—"
  const trustColor = Number.isFinite(numericScore) ? getTrustScoreColor(numericScore) : ("neutral" as any)

  // Normalize verdict into a plain string
  const verdictLabel = (() => {
    if (!verdict) return "UNKNOWN"
    if (typeof verdict === "string") return verdict
    if (typeof (verdict as any).verdict === "string") return (verdict as any).verdict
    return String(verdict)
  })()

  const verdictColor = getClickbaitVerdictColor(verdictLabel)

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true)
    movedRef.current = false
    e.preventDefault()
  }

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return
    movedRef.current = true
    const { clientX } = e
    const viewportWidth = window.innerWidth
    const distanceToLeft = clientX
    const distanceToRight = viewportWidth - clientX
    const newDock: DockPosition = distanceToLeft <= distanceToRight ? "left" : "right"
    // update local UI immediately
    setDockPosition(newDock)
    // notify parent immediately so SidePanel and parent state stay in sync
    if (onDockChange) onDockChange(newDock)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    // movedRef is used to suppress click after a drag
    movedRef.current = false
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleDragMove)
      document.addEventListener("mouseup", handleDragEnd)
      return () => {
        document.removeEventListener("mousemove", handleDragMove)
        document.removeEventListener("mouseup", handleDragEnd)
      }
    }
  }, [isDragging, onDockChange])

  // Keep local dockPosition in sync if parent changes `dock` prop
  useEffect(() => {
    setDockPosition(dock)
  }, [dock])

  useEffect(() => {
    const handleFullScreenChange = () => {
      const isFullScreen = document.fullscreenElement !== null
      // In fullscreen, we could hide it or keep it visible based on preference
      // For now, we'll keep the dock position
    }

    document.addEventListener("fullscreenchange", handleFullScreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange)
  }, [])

  // Calculate position based on dock
  const getPositionStyle = (): React.CSSProperties => {
    // Use amber (medium) color for error state (milder than red), neutral for idle/analyzing, verdict color for complete
    const isComplete = state === "complete"
    const bgColor = errorMessage ? COLORS.medium.primary : 
                    isComplete ? "transparent" : 
                    COLORS.neutral.primary
    
      const baseStyle: React.CSSProperties = {
      position: "fixed",
      zIndex: 10000,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "3px",
      padding: isComplete ? "4px" : "8px 11px",
      backgroundColor: bgColor,
      border: isComplete ? "none" : `3px solid white`,
      cursor: isDragging ? "grabbing" : (state === "analyzing" ? "wait" : "pointer"),
      boxShadow: isComplete ? "none" : "0 4px 12px rgba(0, 0, 0, 0.3)",
      transition: isDragging ? "none" : "all 0.18s ease",
      userSelect: "none"
    }

    if (dockPosition === "left") {
      return {
        ...baseStyle,
        left: 0,
        top: "50%",
        transform: "translateY(-50%)",
        borderRadius: "0 12px 12px 0"
      }
    }

    return {
      ...baseStyle,
      right: 0,
      top: "50%",
      transform: "translateY(-50%)",
      borderRadius: "12px 0 0 12px"
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger toggle if this was not a drag (movedRef set during move)
    if (!movedRef.current) {
      onToggle()
    }
  }

  // Render content based on state
  const renderContent = () => {
    // Show error message if present
    if (errorMessage) {
      return (
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          textAlign: "center",
          padding: "4px 8px",
          maxWidth: "100px"
        }}>
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <span style={{ 
            fontSize: "11px", 
            fontWeight: "600",
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            lineHeight: 1.2
          }}>
            {errorMessage}
          </span>
        </div>
      )
    }

    if (state === "idle") {
      // If there's a cached analysis but showCachedVerdict is false, show "Verdict Available"
      // Note: isCached=true means it's cached, showCachedVerdict controls whether to show the verdict
      if (isCached === true && showCachedVerdict === false) {
        return (
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "3px",
            textAlign: "center",
            padding: "3px 0"
          }}>
            <span style={{ fontSize: "22px" }}>✅</span>
            <span style={{ 
              fontSize: "9px", 
              fontWeight: "700",
              color: "white",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              lineHeight: 1.2,
              maxWidth: "70px"
            }}>
              Verdict Available!
            </span>
            <span style={{ 
              fontSize: "8px", 
              fontWeight: "600",
              color: "white",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              lineHeight: 1.2,
              maxWidth: "70px"
            }}>
              View Report (Free)
            </span>
          </div>
        )
      }
      
      // Show different text based on cache status
      const buttonText = isCached === false ? "Summarize Comments" : "Someone analyzed it!"
      
      // Get icon URL safely - handle extension context invalidation
      let iconUrl: string | null = null
      try {
        iconUrl = chrome.runtime.getURL("assets/stroke.png")
      } catch (error) {
        // Extension context invalidated - will show emoji instead
        console.warn("ToggleButton: Extension context invalidated, using emoji fallback")
      }
      
      return (
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "3px",
          textAlign: "center",
          padding: "3px 0"
        }}>
          {iconUrl ? (
            <img src={iconUrl} alt="Comment Verdict" style={{ width: "27px", height: "27px" }} />
          ) : (
            <span style={{ fontSize: "27px" }}>🛡️</span>
          )}
          <span style={{ 
            fontSize: "9px", 
            fontWeight: "700",
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            lineHeight: 1.2,
            maxWidth: "60px"
          }}>
            {buttonText}
          </span>
        </div>
      )
    }

    if (state === "analyzing") {
      // Check if we're in cache checking phase (no score yet) vs actual analysis
      const isCheckingCache = !trustScore && isCached === null
      const hasProgress = progressPercent !== null && progressPercent !== undefined && progressPercent >= 0
      
      return (
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          textAlign: "center"
        }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "white",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }}
          />
          {hasProgress ? (
            <>
              <span style={{ 
                fontSize: "11px", 
                fontWeight: "700",
                color: "white",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                lineHeight: 1
              }}>
                {Math.round(progressPercent)}%
              </span>
              <span style={{ 
                fontSize: "7px", 
                fontWeight: "600",
                color: "white",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                lineHeight: 1,
                maxWidth: "70px"
              }}>
                {progressMessage || "Analyzing..."}
              </span>
            </>
          ) : (
            <span style={{ 
              fontSize: "8px", 
              fontWeight: "600",
              color: "white",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              lineHeight: 1
            }}>
              {isCheckingCache ? "Checking..." : progressMessage || "Analyzing..."}
            </span>
          )}
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )
    }

    // state === "complete"
    // Show SVG verdict gauge when cached results available and user opted in
    const gaugeStampColorMap: Record<string, { bg: string; text: string; arc: string }> = {
      LEGIT:      { bg: '#D1FAE5', text: '#065F46', arc: '#10B981' },
      CLICKBAIT:  { bg: '#FEE2E2', text: '#991B1B', arc: '#EF4444' },
      DANGEROUS:  { bg: '#FEE2E2', text: '#7F1D1D', arc: '#991B1B' },
      DISPUTED:   { bg: '#FEF3C7', text: '#92400E', arc: '#F59E0B' },
      MISLEADING: { bg: '#FEF3C7', text: '#92400E', arc: '#F59E0B' },
      MIXED:      { bg: '#DBEAFE', text: '#1E40AF', arc: '#3B82F6' },
    }
    const vUpper = verdictLabel.toUpperCase()
    const gaugeSC = gaugeStampColorMap[vUpper] ?? gaugeStampColorMap.MIXED
    const gaugeScore = Number.isFinite(numericScore) ? numericScore : 0
    // Normalize score: if 0-10 scale, multiply by 10 for percentage arc
    const arcPct = gaugeScore > 10 ? gaugeScore : gaugeScore * 10
    const r = 28
    const circ = 2 * Math.PI * r

    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        textAlign: "center",
        padding: "2px 0",
      }}>
        <div style={{ width: "70px", height: "70px", position: "relative" }}>
          <svg width="70" height="70" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r={r} fill={gaugeSC.bg} stroke="#e2e8f0" strokeWidth="4" />
            <circle cx="35" cy="35" r={r} fill="none" stroke={gaugeSC.arc} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(arcPct / 100) * circ} ${(1 - arcPct / 100) * circ}`}
              style={{ transform: "rotate(-90deg)", transformOrigin: "35px 35px" }} />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontWeight: "900", fontSize: vUpper.length > 8 ? "7px" : "9px", letterSpacing: "0.03em",
              color: gaugeSC.text, lineHeight: 1, textAlign: "center", maxWidth: "52px",
              wordBreak: "break-word",
            }}>
              {vUpper}
            </span>
            <span style={{ fontSize: "8px", fontWeight: "700", marginTop: "2px", color: gaugeSC.text, opacity: 0.7 }}>
              {Math.round(arcPct)}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onMouseDown={state === "complete" ? handleDragStart : undefined}
      onClick={handleClick}
      style={getPositionStyle()}
      title={
        errorMessage ? "Analysis failed - Click to retry" :
        state === "idle" ? (isCached === false ? "Click to generate report" : "Click to analyze video comments") :
        state === "analyzing" ? "Analysis in progress..." :
        "Drag to reposition • Click to open panel"
      }
    >
      {renderContent()}
    </div>
  );
};