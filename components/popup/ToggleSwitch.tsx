interface ToggleSwitchProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  label: string
  description?: string
}

export const ToggleSwitch = ({
  enabled,
  onToggle,
  label,
  description
}: ToggleSwitchProps) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px",
        backgroundColor: "white",
        border: "1px solid #e5e5e5",
        borderRadius: "12px",
        marginBottom: "16px"
      }}>
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#1a1a1a",
            marginBottom: description ? "4px" : "0"
          }}>
          {label}
        </p>
        {description && (
          <p style={{ fontSize: "12px", color: "#666" }}>{description}</p>
        )}
      </div>

      <button
        onClick={() => onToggle(!enabled)}
        style={{
          position: "relative",
          width: "48px",
          height: "28px",
          backgroundColor: enabled ? "#3b82f6" : "#d1d5db",
          borderRadius: "14px",
          border: "none",
          cursor: "pointer",
          transition: "background-color 0.3s",
          flexShrink: 0,
          marginLeft: "16px"
        }}
        aria-label={`Toggle ${label}`}>
        <div
          style={{
            position: "absolute",
            top: "3px",
            left: enabled ? "23px" : "3px",
            width: "22px",
            height: "22px",
            backgroundColor: "white",
            borderRadius: "50%",
            transition: "left 0.3s",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)"
          }}
        />
      </button>
    </div>
  )
}
