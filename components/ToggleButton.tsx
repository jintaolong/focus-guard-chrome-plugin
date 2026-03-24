import { useState, useEffect, useRef } from "react";
import type React from "react";
import { COLORS, getTrustScoreColor, getClickbaitVerdictColor, getClickbaitColorPart } from "~lib/colors";

// CSS animations injected once in the DOM —  module-level constant to avoid recreation
const TOGGLE_CSS = `
  @keyframes cv-orbit-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes cv-orbit-fast {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes cv-color-cycle {
    0%   { stroke: #10b981; filter: drop-shadow(0 0 7px rgba(16,185,129,0.95)); }
    18%  { stroke: #f59e0b; filter: drop-shadow(0 0 7px rgba(245,158,11,0.95)); }
    36%  { stroke: #3b82f6; filter: drop-shadow(0 0 7px rgba(59,130,246,0.95)); }
    54%  { stroke: #ef4444; filter: drop-shadow(0 0 7px rgba(239,68,68,0.95)); }
    72%  { stroke: #991b1b; filter: drop-shadow(0 0 7px rgba(153,27,27,0.85)); }
    90%  { stroke: #10b981; filter: drop-shadow(0 0 7px rgba(16,185,129,0.95)); }
    100% { stroke: #10b981; filter: drop-shadow(0 0 7px rgba(16,185,129,0.95)); }
  }
  @keyframes cv-idle-pulse {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 0.85; }
  }
`

// WiFi signal watermark — reusable SVG group
const WiFiWatermark = ({ opacity }: { opacity: number }) => (
  <g opacity={opacity} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="35" cy="46" r="2.5" fill="white" stroke="none" />
    <path d="M 29 41 Q 35 33 41 41" />
    <path d="M 22 36 Q 35 25 48 36" />
    <path d="M 16 31 Q 35 17 54 31" />
  </g>
)

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
    const baseStyle: React.CSSProperties = {
      position: "fixed",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "4px",
      backgroundColor: "transparent",
      border: "none",
      cursor: isDragging ? "grabbing" : (state === "analyzing" ? "wait" : "pointer"),
      transition: isDragging ? "none" : "all 0.18s ease",
      userSelect: "none",
    }

    if (dockPosition === "left") {
      return { ...baseStyle, left: "4px", top: "50%", transform: "translateY(-50%)" }
    }
    return { ...baseStyle, right: "4px", top: "50%", transform: "translateY(-50%)" }
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger toggle if this was not a drag (movedRef set during move)
    if (!movedRef.current) {
      onToggle()
    }
  }

    // CSS animations for all circle states — injected from module constant

  // Reusable WiFi signal watermark (SVG group) — defined at module level

  // Render content based on state
  const renderContent = () => {
    // ── Error ──────────────────────────────────────────────────────────────────
    if (errorMessage) {
      return (
        <div style={{ width: 70, height: 70, position: "relative" }}>
          <style>{TOGGLE_CSS}</style>
          <svg width="70" height="70" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r="33" fill="rgba(217,119,6,0.85)" />
            <circle cx="35" cy="35" r="33" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px" }}>
            <span style={{ fontSize: "18px" }}>⚠️</span>
            <span style={{ fontSize: "8px", fontWeight: "600", color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.4)", textAlign: "center", maxWidth: "52px", lineHeight: 1.2 }}>
              {errorMessage}
            </span>
          </div>
        </div>
      )
    }

    // ── Idle ──────────────────────────────────────────────────────────────────
    if (state === "idle") {

      // ── Sub-state: Cache available, verdict hidden → Rainbow orbit glow ──
      if (isCached === true && showCachedVerdict === false) {
        return (
          <div style={{ width: 70, height: 70, position: "relative" }}>
            <style>{TOGGLE_CSS}</style>
            <svg width="70" height="70" viewBox="0 0 70 70">
              {/* Dark navy fill */}
              <circle cx="35" cy="35" r="31" fill="rgba(15,23,42,0.9)" />
              {/* Track ring */}
              <circle cx="35" cy="35" r="33" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
              {/* Orbiting colour-cycling glow arc */}
              <circle cx="35" cy="35" r="33" fill="none" strokeWidth="4" strokeLinecap="round"
                strokeDasharray="55 152"
                style={{
                  animation: "cv-orbit-slow 5s linear infinite, cv-color-cycle 10s linear infinite",
                  transformOrigin: "center",
                }} />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "9px", fontWeight: "900", color: "white", letterSpacing: "0.07em", textAlign: "center", lineHeight: 1.2 }}>
                ANALYZED
              </span>
              <span style={{ fontSize: "7px", fontWeight: "600", color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: "3px" }}>
                View Report
              </span>
              <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                Free ↗
              </span>
            </div>
          </div>
        )
      }

      // ── Sub-state: Normal idle (or cached+showCachedVerdict=true) ──
      const buttonText = isCached === false ? "Summarize" : "Analyzed!"
      return (
        <div style={{ width: 70, height: 70, position: "relative" }}>
          <style>{TOGGLE_CSS}</style>
          <svg width="70" height="70" viewBox="0 0 70 70">
            {/* Semi-transparent logo-blue fill */}
            <circle cx="35" cy="35" r="33" fill="rgba(37,99,235,0.55)" />
            {/* Pulsing ring */}
            <circle cx="35" cy="35" r="33" fill="none" stroke="rgba(96,165,250,0.6)" strokeWidth="2"
              style={{ animation: "cv-idle-pulse 2.5s ease-in-out infinite" }} />
            {/* WiFi watermark */}
            <WiFiWatermark opacity={0.2} />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: "9px", fontWeight: "700", color: "white",
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              textAlign: "center", lineHeight: 1.3, maxWidth: "52px",
            }}>
              {buttonText}
            </span>
          </div>
        </div>
      )
    }

    // ── Analyzing ─────────────────────────────────────────────────────────────
    if (state === "analyzing") {
      const isCheckingCache = !trustScore && isCached === null
      const hasProgress = progressPercent !== null && progressPercent !== undefined && progressPercent >= 0

      return (
        <div style={{ width: 70, height: 70, position: "relative" }}>
          <style>{TOGGLE_CSS}</style>
          <svg width="70" height="70" viewBox="0 0 70 70">
            {/* Semi-transparent logo-blue fill */}
            <circle cx="35" cy="35" r="33" fill="rgba(37,99,235,0.55)" />
            {/* Track ring */}
            <circle cx="35" cy="35" r="33" fill="none" stroke="rgba(96,165,250,0.18)" strokeWidth="4" />
            {/* Spinning glow arc */}
            <circle cx="35" cy="35" r="33" fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round"
              strokeDasharray="52 155"
              style={{
                filter: "drop-shadow(0 0 5px rgba(96,165,250,0.95))",
                animation: "cv-orbit-fast 1.2s linear infinite",
                transformOrigin: "center",
              }} />
            {/* Dimmed WiFi watermark */}
            <WiFiWatermark opacity={0.1} />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px",
          }}>
            {hasProgress ? (
              <>
                <span style={{ fontSize: "14px", fontWeight: "900", color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.5)", lineHeight: 1 }}>
                  {Math.round(progressPercent!)}%
                </span>
                <span style={{ fontSize: "7px", fontWeight: "600", color: "rgba(255,255,255,0.85)", textAlign: "center", maxWidth: "52px", lineHeight: 1.3 }}>
                  {progressMessage || "Analyzing..."}
                </span>
              </>
            ) : (
              <span style={{ fontSize: "8px", fontWeight: "600", color: "rgba(255,255,255,0.9)", textAlign: "center", maxWidth: "52px", lineHeight: 1.3 }}>
                {isCheckingCache ? "Checking..." : progressMessage || "Analyzing..."}
              </span>
            )}
          </div>
        </div>
      )
    }

    // ── Complete: verdict gauge (unchanged) ────────────────────────────────
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