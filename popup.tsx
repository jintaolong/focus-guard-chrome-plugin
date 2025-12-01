import { useState, useEffect } from "react"

import { AccountInfo } from "~components/popup/AccountInfo"
import { LoginForm } from "~components/popup/LoginForm"
import { ModeSelector } from "~components/popup/ModeSelector"
import { ToggleSwitch } from "~components/popup/ToggleSwitch"
import type { UserAccount, FocusGuardSettings } from "~types/popup"

import "./style.css"

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

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      // Load from chrome storage
      const result = await chrome.storage.sync.get([
        "account",
        "settings"
      ])

      if (result.account) {
        setAccount(result.account)
      }
      if (result.settings) {
        setSettings(result.settings)
      }
    } catch (error) {
      console.error("Failed to load user data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (email: string) => {
    setIsLoading(true)
    try {
      // TODO: Implement actual login API call
      // Mock login for now
      const newAccount: UserAccount = {
        isLoggedIn: true,
        email,
        tier: "starter",
        searchesUsedToday: 0,
        searchesRemaining: 3,
        resetTime: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
      }

      await chrome.storage.sync.set({ account: newAccount })
      setAccount(newAccount)
    } catch (error) {
      console.error("Login failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = () => {
    // TODO: Open upgrade page
    chrome.tabs.create({ url: "https://focusguard.com/upgrade" })
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
          onClick={() => {
            chrome.storage.sync.clear()
            setAccount(null)
          }}
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
