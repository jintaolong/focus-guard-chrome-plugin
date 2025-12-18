import { useState, useEffect, useRef } from "react";
import type React from "react";
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor } from "~lib/colors";

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
}

type DockPosition = "left" | "right"

export const ToggleButton = ({ trustScore, verdict, onToggle, dock = "right", onDockChange, state = "complete", isCached = null, errorMessage = null }: ToggleButtonProps) => {
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
    const bgColor = errorMessage ? COLORS.medium.primary : 
                    state === "complete" ? COLORS[verdictColor].primary : 
                    COLORS.neutral.primary
    
    const baseStyle: React.CSSProperties = {
      position: "fixed",
      zIndex: 10000,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      padding: "12px 16px",
      backgroundColor: bgColor,
      border: `3px solid white`,
      cursor: isDragging ? "grabbing" : (state === "analyzing" ? "wait" : "pointer"),
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
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
      // Show different text based on cache status
      const buttonText = isCached === false ? "Generate Report" : "Analyze Comments"
      
      return (
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          textAlign: "center",
          padding: "4px 0"
        }}>
          <img src={chrome.runtime.getURL("assets/grey.png")} alt="Comment Verdict" style={{ width: "20px", height: "20px" }} />
          <span style={{ 
            fontSize: "13px", 
            fontWeight: "700",
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            lineHeight: 1.2,
            maxWidth: "80px"
          }}>
            {buttonText}
          </span>
        </div>
      )
    }

    if (state === "analyzing") {
      // Check if we're in cache checking phase (no score yet) vs actual analysis
      const isCheckingCache = !trustScore && isCached === null
      
      return (
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          textAlign: "center"
        }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              border: "3px solid rgba(255,255,255,0.3)",
              borderTopColor: "white",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }}
          />
          <span style={{ 
            fontSize: "12px", 
            fontWeight: "600",
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            lineHeight: 1
          }}>
            {isCheckingCache ? "Checking..." : "Analyzing..."}
          </span>
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
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        textAlign: "center"
      }}>
        <span style={{ 
          fontSize: "20px", 
          fontWeight: "900",
          color: "white",
          textShadow: "0 1px 3px rgba(0,0,0,0.3)",
          lineHeight: 1
        }}>
          {scoreDisplay}
        </span>
        <span style={{ 
          fontSize: "13px", 
          fontWeight: "700",
          color: "white",
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          letterSpacing: "0.5px",
          lineHeight: 1
        }}>
          {verdictLabel}
        </span>
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