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
}

type DockPosition = "left" | "right"

export const ToggleButton = ({ trustScore, verdict, onToggle, dock = "right", onDockChange }: ToggleButtonProps) => {
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
    const baseStyle: React.CSSProperties = {
      position: "fixed",
      zIndex: 10000,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      padding: "12px 16px",
      backgroundColor: COLORS[trustColor].primary,
      border: `3px solid white`,
      cursor: isDragging ? "grabbing" : "grab",
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

  return (
    <div
      onMouseDown={handleDragStart}
      onClick={handleClick}
      style={getPositionStyle()}
      title="Drag to reposition • Click to open panel"
    >
      <div style={{ 
        display: "flex", 
        flexDirection: dockPosition === "top" || dockPosition === "bottom" ? "row" : "column",
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
    </div>
  );
};