import { useState, useEffect } from "react"

import { AccountInfo } from "~components/popup/AccountInfo"
import { LoginForm } from "~components/popup/LoginForm"
import { ModeSelector } from "~components/popup/ModeSelector"
import { ToggleSwitch } from "~components/popup/ToggleSwitch"
import { AuthService } from "~lib/auth"
import { SubscriptionService } from "~lib/subscription"
import type { UserAccount, FocusGuardSettings } from "~types/popup"

import "./style.css"

// Portal URL (dev default -> localhost). Can be overridden with PLASMO_PUBLIC_PORTAL_URL
const PORTAL_URL = process.env.PLASMO_PUBLIC_PORTAL_URL || "http://localhost:3000"

function IndexPopup() {
  const [account, setAccount] = useState<UserAccount | null>(null)
  const [settings, setSettings] = useState<FocusGuardSettings>({
    isEnabled: true,
    mode: "curated",
    videoAnalysis: {
      showPreWatchPopover: true,
      autoAnalyze: true,
      botDetectionEnabled: true
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log("Focus Guard popup loaded");
    // Test storage first
    AuthService.testStorage()
      .then(() => console.log("Storage test passed"))
      .catch((err) => console.error("Storage test failed:", err))
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      console.log("Popup: Loading user data...")
      
      // Load settings from chrome storage
      const result = await chrome.storage.sync.get(["settings"])
      if (result.settings) {
        setSettings(result.settings)
      }

      // Check if user is authenticated
      const isAuth = await AuthService.isAuthenticated()
      console.log("Popup: isAuthenticated =", isAuth)
      
      if (isAuth) {
        // Get user and subscription info
        console.log("Popup: Fetching user, subscription, and usage...")
        const [user, subscription, usage] = await Promise.all([
          AuthService.getCurrentUser(),
          SubscriptionService.getSubscription(),
          SubscriptionService.getUsage()
        ])

        console.log("Popup: Got user data:", { user, subscription, usage })

        if (user) {
          // Map backend tier (FREE/STARTER/PRO) to frontend tier (free/starter/pro)
          let tier: "free" | "starter" | "pro"
          if (subscription.tier === "PRO") {
            tier = "pro"
          } else if (subscription.tier === "STARTER") {
            tier = "starter"
          } else {
            tier = "free"
          }

          const newAccount: UserAccount = {
            isLoggedIn: true,
            email: user.email,
            tier,
            dailySearchesLimit: usage.daily_searches_limit,
            searchesUsedToday: usage.daily_searches_used,
            searchesRemaining: usage.searches_remaining,
            resetTime: subscription.last_reset_date
          }
          setAccount(newAccount)
        } else {
          console.log("Popup: No user data, setting account to null")
          setAccount(null)
        }
      } else {
        console.log("Popup: Not authenticated, setting account to null")
        setAccount(null)
      }
    } catch (error) {
      console.error("Popup: Failed to load user data:", error)
      // If there's an error, user is likely not authenticated
      setAccount(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Try to login first - if successful, we're done
      try {
        await AuthService.login(email, password)
      } catch (loginError) {
        // If login fails, it might be a new user, try registration
        // However, the LoginForm should handle this by having separate modes
        throw loginError
      }
      
      // Reload user data
      await loadUserData()
    } catch (error) {
      console.error("Authentication failed:", error)
      setError(error instanceof Error ? error.message : "Authentication failed")
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async () => {
    try {
      // Open the hosted portal for upgrading (dev default: http://localhost:3000)
      // The portal will handle creating a Stripe checkout session and redirecting back to the app.
      await chrome.tabs.create({ url: `${PORTAL_URL}/signup` })
    } catch (error) {
      console.error("Failed to open portal:", error)
      setError(error instanceof Error ? error.message : "Failed to open portal")
    }
  }

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      setAccount(null)
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const handleToggle = async (enabled: boolean) => {
    const newSettings = { ...settings, isEnabled: enabled }
    setSettings(newSettings)
    await chrome.storage.sync.set({ settings: newSettings })
  }

  const handleModeChange = async (mode: FocusGuardSettings["mode"]) => {
    const newSettings = { ...settings, mode }
    setSettings(newSettings)
    await chrome.storage.sync.set({ settings: newSettings })
  }

  if (isLoading) {
    return (
      <div
        style={{
          width: 360,
          padding: 40,
          textAlign: "center"
        }}>
        <div
          style={{
            display: "inline-block",
            width: "32px",
            height: "32px",
            border: "3px solid #e5e5e5",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />
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

  // Show login if not logged in
  if (!account?.isLoggedIn) {
    return (
      <div style={{ width: 360 }}>
        <LoginForm onLogin={handleLogin} isLoading={isLoading} />
      </div>
    )
  }

  // Show main popup content
  return (
    <div
      style={{
        width: 360,
        padding: "20px"
      }}>
      {/* Header */}
      <div
        style={{
          marginBottom: "20px",
          paddingBottom: "16px",
          borderBottom: "1px solid #e5e5e5"
        }}>
        <h1
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#1a1a1a",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
          <span>🛡️</span>
          Focus Guard
        </h1>
      </div>

      {/* Account Info */}
      <AccountInfo account={account} onUpgrade={handleUpgrade} />

      {/* Enable/Disable Toggle */}
      <ToggleSwitch
        enabled={settings.isEnabled}
        onToggle={handleToggle}
        label="Focus Guard Active"
        description={
          settings.isEnabled
            ? "YouTube feed is being filtered"
            : "Using default YouTube experience"
        }
      />

      {/* Mode Selector */}
      {settings.isEnabled && (
        <ModeSelector
          currentMode={settings.mode}
          onModeChange={handleModeChange}
        />
      )}

      {/* Video Analysis Settings */}
      {settings.isEnabled && settings.mode === "video-analysis" && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: "10px",
            border: "1px solid #e5e5e5"
          }}>
          <h3
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#1a1a1a",
              marginBottom: "12px"
            }}>
            Analysis Preferences
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer"
              }}>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>
                Show pre-watch popover
              </span>
              <input
                type="checkbox"
                checked={settings.videoAnalysis?.showPreWatchPopover ?? true}
                onChange={async (e) => {
                  const newSettings = {
                    ...settings,
                    videoAnalysis: {
                      ...settings.videoAnalysis!,
                      showPreWatchPopover: e.target.checked
                    }
                  }
                  setSettings(newSettings)
                  await chrome.storage.sync.set({ settings: newSettings })
                }}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer"
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer"
              }}>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>
                Auto-analyze on page load
              </span>
              <input
                type="checkbox"
                checked={settings.videoAnalysis?.autoAnalyze ?? true}
                onChange={async (e) => {
                  const newSettings = {
                    ...settings,
                    videoAnalysis: {
                      ...settings.videoAnalysis!,
                      autoAnalyze: e.target.checked
                    }
                  }
                  setSettings(newSettings)
                  await chrome.storage.sync.set({ settings: newSettings })
                }}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer"
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer"
              }}>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>
                Filter bot comments
              </span>
              <input
                type="checkbox"
                checked={settings.videoAnalysis?.botDetectionEnabled ?? true}
                onChange={async (e) => {
                  const newSettings = {
                    ...settings,
                    videoAnalysis: {
                      ...settings.videoAnalysis!,
                      botDetectionEnabled: e.target.checked
                    }
                  }
                  setSettings(newSettings)
                  await chrome.storage.sync.set({ settings: newSettings })
                }}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer"
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "20px",
          paddingTop: "16px",
          borderTop: "1px solid #e5e5e5",
          textAlign: "center"
        }}>
        <button
          onClick={handleLogout}
          style={{
            fontSize: "12px",
            color: "#999",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#666"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#999"
          }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default IndexPopup
