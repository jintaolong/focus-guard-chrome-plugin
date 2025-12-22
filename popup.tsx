import { useState, useEffect } from "react"

import { AccountInfo } from "~components/popup/AccountInfo"
import { LoginForm } from "~components/popup/LoginForm"
import { ToggleSwitch } from "~components/popup/ToggleSwitch"
import { initConsole } from "~lib/console-manager"
import { AuthService } from "~lib/auth"
import { SubscriptionService } from "~lib/subscription"
import { ConfigService } from "~lib/config"
import type { UserAccount, FocusGuardSettings } from "~types/popup"

import "./style.css"

initConsole()

console.log("🚀 Comment Verdict Popup: Module loaded")

// Portal URL - will be updated from config
let PORTAL_URL = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"

// Load config on module initialization
ConfigService.getConfig().then(config => {
  PORTAL_URL = config.portal_url
  console.log("Popup: Config loaded, PORTAL_URL =", PORTAL_URL)
}).catch(err => {
  console.warn("Popup: Failed to load config, using environment variable", err)
})

function IndexPopup() {
  console.log("🎯 Comment Verdict Popup: Component initializing")
  const [account, setAccount] = useState<UserAccount | null>(null)
  const [settings, setSettings] = useState<FocusGuardSettings>({
    isEnabled: true,
    videoAnalysis: {
      showPreWatchPopover: true,
      autoAnalyze: false,
      botDetectionEnabled: true
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log("Comment Verdict popup loaded");
    // Test storage first
    AuthService.testStorage()
      .then(() => console.log("Storage test passed"))
      .catch((err) => console.error("Storage test failed:", err))
    loadUserData()
    
    // Listen for storage changes (e.g., OAuth completion in background or portal sync)
    const storageListener = (changes: any, areaName: string) => {
      if (areaName === 'sync') {
        // Check for token, user, or account changes
        if (changes.focus_guard_access_token || changes.focus_guard_user || changes.account || changes.isAuthenticated) {
          console.log("Popup: Detected auth change in storage, reloading data")
          loadUserData()
        }
      }
    }
    
    // Listen for runtime messages (e.g., SESSION_EXPIRED from background)
    const messageListener = (message: any) => {
      if (message.type === 'SESSION_EXPIRED') {
        console.log("Popup: Session expired, logging out")
        setAccount(null)
        setError("Your session has expired. Please log in again.")
      }
    }
    
    chrome.storage.onChanged.addListener(storageListener)
    chrome.runtime.onMessage.addListener(messageListener)
    
    return () => {
      chrome.storage.onChanged.removeListener(storageListener)
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  const loadUserData = async () => {
    try {
      console.log("Popup: Loading user data...")
      
      // Load settings from chrome storage
      const result = await chrome.storage.sync.get(["settings"])
      if (result.settings) {
        setSettings(result.settings)
      } else {
        // If no settings exist, initialize defaults and save them
        const defaultSettings: FocusGuardSettings = {
          isEnabled: true,
          videoAnalysis: {
            showPreWatchPopover: true,
            autoAnalyze: false,
            botDetectionEnabled: true
          }
        }
        setSettings(defaultSettings)
        await chrome.storage.sync.set({ settings: defaultSettings })
        console.log("Popup: Initialized default settings")
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
        console.log("Popup: Subscription tier from backend:", subscription.tier)
        console.log("Popup: Usage data from backend:", usage)

        if (user) {
          // Map backend tier (FREE/STARTER/PRO) to frontend tier (free/starter/pro)
          // Make comparison case-insensitive
          const backendTier = (subscription.tier || "").toUpperCase()
          console.log("Popup: Backend tier (uppercased):", backendTier)
          
          let tier: "free" | "starter" | "pro"
          if (backendTier === "PRO") {
            tier = "pro"
            console.log("✅ Popup: Mapped to 'pro' tier")
          } else if (backendTier === "STARTER") {
            tier = "starter"
            console.log("✅ Popup: Mapped to 'starter' tier")
          } else {
            tier = "free"
            console.log("⚠️ Popup: Mapped to 'free' tier (default) - backend tier was:", subscription.tier)
          }

          console.log("Popup: Creating account with:", {
            tier,
            dailySearchesLimit: usage.daily_searches_limit,
            searchesUsedToday: usage.daily_searches_used,
            searchesRemaining: usage.searches_remaining,
            calculatedRemaining: Math.max(0, usage.daily_searches_limit - usage.daily_searches_used)
          })

          // Use the backend's searches_remaining value
          // For PRO users, this will be -1 (unlimited)
          // For FREE/STARTER, it's calculated as limit - used
          const searchesRemaining = usage.searches_remaining

          const newAccount: UserAccount = {
            isLoggedIn: true,
            email: user.email,
            tier,
            dailySearchesLimit: usage.daily_searches_limit,
            searchesUsedToday: usage.daily_searches_used,
            searchesRemaining: searchesRemaining,
            resetTime: subscription.last_reset_date
          }
          console.log("📊 Popup: Setting account state:", newAccount)
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

  const handleManagePlan = async () => {
    try {
      // Open the web portal dashboard for plan management
      // Users can upgrade, downgrade, or cancel their subscription there
      await chrome.tabs.create({ url: `${PORTAL_URL}/dashboard` })
    } catch (error) {
      console.error("Failed to open portal:", error)
      setError(error instanceof Error ? error.message : "Failed to open portal")
    }
  }

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      setAccount(null)
      
      // Notify background to clear badge
      chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        isAuthenticated: false
      }).catch(err => {
        console.log('Popup: Failed to notify background of logout:', err)
      })
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const handleToggle = async (enabled: boolean) => {
    const newSettings = { ...settings, isEnabled: enabled }
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
          <img src={chrome.runtime.getURL("assets/green.png")} alt="Comment Verdict" style={{ width: "24px", height: "24px" }} />
          Comment Verdict
        </h1>
      </div>

      {/* Account Info */}
      <AccountInfo account={account} onManagePlan={handleManagePlan} />

      {/* Enable/Disable Toggle */}
      <ToggleSwitch
        enabled={settings.isEnabled}
        onToggle={handleToggle}
        label="Comment Verdict Active"
        description={
          settings.isEnabled
            ? "You can analyze comments on YouTube videos"
            : "Comment Verdict is paused"
        }
      />

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
