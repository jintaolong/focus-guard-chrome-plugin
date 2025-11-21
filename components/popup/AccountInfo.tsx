import type { UserAccount } from "~types/popup"

interface AccountInfoProps {
  account: UserAccount
  onUpgrade: () => void
}

export const AccountInfo = ({ account, onUpgrade }: AccountInfoProps) => {
  const isStarter = account.tier === "starter"
  const usagePercent = isStarter
    ? (account.searchesUsedToday / 3) * 100
    : 0

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#f9fafb",
        borderRadius: "12px",
        marginBottom: "16px"
      }}>
      {/* Email & Tier */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px"
        }}>
        <div>
          <p
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#1a1a1a",
              marginBottom: "2px"
            }}>
            {account.email}
          </p>
          <p style={{ fontSize: "12px", color: "#666" }}>
            {isStarter ? "🌱 Starter Plan" : "⭐ Pro Plan"}
          </p>
        </div>
        {isStarter && (
          <button
            onClick={onUpgrade}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "600",
              color: "#3b82f6",
              backgroundColor: "white",
              border: "1px solid #3b82f6",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#3b82f6"
              e.currentTarget.style.color = "white"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "white"
              e.currentTarget.style.color = "#3b82f6"
            }}>
            Upgrade to Pro
          </button>
        )}
      </div>

      {/* Usage Stats for Starter */}
      {isStarter && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px"
            }}>
            <span style={{ fontSize: "13px", color: "#666" }}>
              AI Searches Today
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: account.searchesRemaining === 0 ? "#dc2626" : "#16a34a"
              }}>
              {account.searchesRemaining} remaining
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "#e5e5e5",
              borderRadius: "3px",
              overflow: "hidden"
            }}>
            <div
              style={{
                width: `${usagePercent}%`,
                height: "100%",
                backgroundColor:
                  account.searchesRemaining === 0 ? "#dc2626" : "#3b82f6",
                transition: "width 0.3s ease"
              }}
            />
          </div>

          <p
            style={{
              marginTop: "6px",
              fontSize: "11px",
              color: "#999"
            }}>
            Resets at {new Date(account.resetTime).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Pro Benefits */}
      {!isStarter && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px",
            backgroundColor: "#fef3c7",
            borderRadius: "6px"
          }}>
          <span style={{ fontSize: "16px" }}>✨</span>
          <span style={{ fontSize: "12px", color: "#92400e" }}>
            Unlimited AI searches & all features unlocked
          </span>
        </div>
      )}
    </div>
  )
}
