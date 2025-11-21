import type { FocusGuardSettings } from "~types/popup"
import { MODE_INFO } from "~types/popup"

interface ModeSelectorProps {
  currentMode: FocusGuardSettings["mode"]
  onModeChange: (mode: FocusGuardSettings["mode"]) => void
}

export const ModeSelector = ({ currentMode, onModeChange }: ModeSelectorProps) => {
  const modes: Array<FocusGuardSettings["mode"]> = [
    "deep-work",
    "curated",
    "intelligence"
  ]

  return (
    <div>
      <h3
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#1a1a1a",
          marginBottom: "12px"
        }}>
        Select Mode
      </h3>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
        {modes.map((mode) => {
          const info = MODE_INFO[mode]
          const isActive = currentMode === mode

          return (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              style={{
                padding: "12px 16px",
                textAlign: "left",
                backgroundColor: isActive ? "#eff6ff" : "white",
                border: isActive ? "2px solid #3b82f6" : "1px solid #e5e5e5",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.2s",
                position: "relative"
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#f9fafb"
                  e.currentTarget.style.borderColor = "#d1d5db"
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "white"
                  e.currentTarget.style.borderColor = "#e5e5e5"
                }
              }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}>
                <span style={{ fontSize: "24px" }}>{info.icon}</span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: isActive ? "#1e40af" : "#1a1a1a",
                      marginBottom: "2px"
                    }}>
                    {info.name}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: isActive ? "#3b82f6" : "#666",
                      lineHeight: "1.4"
                    }}>
                    {info.description}
                  </p>
                </div>
                {isActive && (
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      backgroundColor: "#3b82f6",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      color: "white"
                    }}>
                    ✓
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
