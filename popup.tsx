import { useState, useEffect } from "react"

import { AccountInfo } from "~components/popup/AccountInfo"
import { LoginForm } from "~components/popup/LoginForm"
import { ToggleSwitch } from "~components/popup/ToggleSwitch"
import { initConsole } from "~lib/console-manager"
import { AuthService } from "~lib/auth"
import { SubscriptionService } from "~lib/subscription"
import { ConfigService } from "~lib/config"
import { FocusGuardAPI } from "~lib/api"
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
      botDetectionEnabled: true,
      showCachedVerdict: false, // Default: hide verdict for cached analyses
      confirmCreditUsage: true, // Default: confirm credit usage
      maxCommentDepth: 100 // Default: 100 comments
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log("Comment Verdict popup loaded");
    // Test storage first (defensive: some test environments may not expose this helper)
    if (typeof AuthService.testStorage === "function") {
      Promise.resolve()
        .then(() => AuthService.testStorage())
        .then(() => console.log("Storage test passed"))
        .catch((err) => console.error("Storage test failed:", err))
    } else {
      console.warn("AuthService.testStorage not available in this environment")
    }
    loadUserData()
    
    // Reload data when popup becomes visible (e.g., user reopens it)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("Popup: Became visible, refreshing user data")
        loadUserData()
      }
    }
    
    // Also reload on window focus (for when popup is already open but user returns to it)
    const handleFocus = () => {
      console.log("Popup: Got focus, refreshing user data")
      loadUserData()
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
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
    
    // Listen for runtime messages (e.g., SESSION_EXPIRED or OAUTH_COMPLETE from background)
    const messageListener = (message: any) => {
      if (message.type === 'SESSION_EXPIRED') {
        console.log("Popup: Session expired, logging out")
        setAccount(null)
        setError("Your session has expired. Please log in again.")
        return
      }

      if (message.type === 'OAUTH_COMPLETE') {
        console.log('Popup: OAUTH_COMPLETE received, reloading user data')
        // small delay to allow storage propagation
        setTimeout(() => {
          loadUserData()
        }, 100)
        return
      }

      if (message.type === 'AUTH_STATE_CHANGED') {
        console.log('Popup: AUTH_STATE_CHANGED received, reloading user data', message.isAuthenticated)
        // Reload user data to reflect new auth state
        loadUserData()
        return
      }
    }
    
    chrome.storage.onChanged.addListener(storageListener)
    chrome.runtime.onMessage.addListener(messageListener)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
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
            botDetectionEnabled: true,
            showCachedVerdict: false,
            confirmCreditUsage: true,
            maxCommentDepth: 100
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
        console.log("Popup: Fetching user, subscription, usage, and credits...")
        const [user, subscription, usage, credits] = await Promise.all([
          AuthService.getCurrentUser(),
          SubscriptionService.getSubscription(),
          SubscriptionService.getUsage(),
          FocusGuardAPI.getCreditBalance().catch(err => {
            console.warn("Popup: Failed to fetch credits, continuing without credit info:", err)
            return null
          })
        ])

        console.log("Popup: Got user data:", { user, subscription, usage, credits })
        console.log("Popup: Subscription tier from backend:", subscription.tier)
        console.log("Popup: Usage data from backend:", usage)
        console.log("Popup: Credit balance data:", credits)

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
            isVerified: user.is_verified,
            welcomeBonusUsed: user.welcome_bonus_used ?? false, // Default to false - assume bonus not used yet
            tier,
            dailySearchesLimit: usage.daily_searches_limit,
            searchesUsedToday: usage.daily_searches_used,
            searchesRemaining: searchesRemaining,
            resetTime: subscription.last_reset_date,
            // Credit system fields
            creditsBalance: credits?.total_credits || 0, // Use total_credits for display
            monthlyCreditsRemaining: credits?.credits_balance || 0, // Monthly credits only
            monthlyQuota: credits?.monthly_quota || 0,
            purchasedCredits: credits?.purchased_credits_balance || 0,
            nextResetDate: credits?.next_reset_date || null,
            // Subscription cancellation info
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: subscription.current_period_end
          }
          console.log("📊 Popup: Setting account state:", newAccount)
          setAccount(newAccount)
          
          // Sanitize settings based on current tier
          const currentMaxCommentDepth = settings.videoAnalysis?.maxCommentDepth ?? 100
          const shouldEnforceLimit = tier !== "pro" && currentMaxCommentDepth > 100
          const needsUpdate = result.settings?.videoAnalysis?.confirmCreditUsage === undefined || shouldEnforceLimit
          
          if (needsUpdate) {
            const updatedSettings: FocusGuardSettings = {
              ...settings,
              videoAnalysis: {
                showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                confirmCreditUsage: tier === "free", // ON for free, OFF for starter/pro
                maxCommentDepth: tier === "pro" ? currentMaxCommentDepth : Math.min(currentMaxCommentDepth, 100) // Enforce 100 cap for free/starter
              }
            }
            setSettings(updatedSettings)
            await chrome.storage.sync.set({ settings: updatedSettings })
            console.log("Popup: Sanitized settings based on tier:", tier, "maxCommentDepth capped at", updatedSettings.videoAnalysis?.maxCommentDepth)
          }
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
        
        // Give storage a moment to propagate (Chrome storage API quirk)
        await new Promise(resolve => setTimeout(resolve, 100))
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
      // Open the web portal Plans & Billing tab
      await chrome.tabs.create({ url: `${PORTAL_URL}/dashboard?tab=billing` })
    } catch (error) {
      console.error("Failed to open portal:", error)
      setError(error instanceof Error ? error.message : "Failed to open portal")
    }
  }

  const handleTopUp = async () => {
    try {
      // Open the web portal Plans & Billing tab for credit top-up
      await chrome.tabs.create({ url: `${PORTAL_URL}/dashboard?tab=billing&purchase_type=credits` })
    } catch (error) {
      console.error("Failed to open billing page:", error)
      setError(error instanceof Error ? error.message : "Failed to open billing page")
    }
  }

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      setAccount(null)
      // Reset settings to defaults on logout
      setSettings({
        isEnabled: true,
        videoAnalysis: {
          showPreWatchPopover: true,
          autoAnalyze: false,
          botDetectionEnabled: true,
          showCachedVerdict: false,
          confirmCreditUsage: true,
          maxCommentDepth: 100
        }
      })
      
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

  const handleResendVerification = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Call backend to resend verification email
      const response = await fetch(`${PORTAL_URL}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AuthService.getAccessToken()}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to resend verification email')
      }

      alert('Verification email sent! Please check your inbox and spam folder.')
    } catch (error) {
      console.error('Failed to resend verification email:', error)
      setError('Failed to resend verification email. Please try again.')
    } finally {
      setIsLoading(false)
    }
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
          <img src={chrome.runtime.getURL("assets/blue.png")} alt="Comment Verdict" style={{ width: "24px", height: "24px" }} />
          Comment Verdict
        </h1>
      </div>

      {/* Account Info */}
      <AccountInfo 
        account={account} 
        onManagePlan={handleManagePlan} 
        onTopUp={handleTopUp} 
        onResendVerification={handleResendVerification}
      />

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

      {/* Credit Usage Settings */}
      <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "12px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px" }}>
          Analysis Settings
        </h3>
        
        {/* Show Cached Verdict Toggle */}
        <ToggleSwitch
          enabled={settings.videoAnalysis?.showCachedVerdict || false}
          onToggle={async (enabled) => {
            const newSettings: FocusGuardSettings = {
              ...settings,
              videoAnalysis: {
                showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                showCachedVerdict: enabled,
                confirmCreditUsage: settings.videoAnalysis?.confirmCreditUsage ?? true,
                maxCommentDepth: settings.videoAnalysis?.maxCommentDepth ?? 100
              }
            }
            setSettings(newSettings)
            await chrome.storage.sync.set({ settings: newSettings })
          }}
          label="Show Verdict for Cached Videos"
          description="Display confidence & verdict on videos that have been analyzed"
        />

        {/* Confirm Credit Usage Toggle */}
        <div style={{ marginTop: "12px" }}>
          <ToggleSwitch
            enabled={settings.videoAnalysis?.confirmCreditUsage !== false}
            onToggle={async (enabled) => {
              const newSettings: FocusGuardSettings = {
                ...settings,
                videoAnalysis: {
                  showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                  autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                  botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                  showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                  confirmCreditUsage: enabled,
                  maxCommentDepth: settings.videoAnalysis?.maxCommentDepth ?? 100
                }
              }
              setSettings(newSettings)
              await chrome.storage.sync.set({ settings: newSettings })
            }}
            label="Confirm Before Using Credits"
            description="Get a confirmation dialog before analyzing a video"
          />
        </div>

        {/* Comment Depth Slider - Always visible, disabled for free/starter */}
        <div style={{ marginTop: "16px", opacity: account?.tier === "pro" ? 1 : 0.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>
              Max Comments per Analysis
              {account?.tier !== "pro" && (
                <span style={{ fontSize: "10px", fontWeight: "400", color: "#f59e0b", marginLeft: "6px" }}>
                  🔒 PRO Only
                </span>
              )}
            </label>
            <span style={{ fontSize: "12px", fontWeight: "700", color: account?.tier === "pro" ? "#3b82f6" : "#999" }}>
              {(() => {
                const rawValue = settings.videoAnalysis?.maxCommentDepth || 100
                const displayValue = account?.tier === "pro" ? rawValue : Math.min(rawValue, 100)
                return `${displayValue} • ${Math.ceil(displayValue / 100)} credit${displayValue > 100 ? 's' : ''}`
              })()}
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="1000"
            step="100"
            value={(() => {
              const rawValue = settings.videoAnalysis?.maxCommentDepth || 100
              return account?.tier === "pro" ? rawValue : Math.min(rawValue, 100)
            })()}
            disabled={!account || account.tier !== "pro"}
            onChange={async (e) => {
              const newDepth = parseInt(e.target.value)
              console.log("📊 Slider onChange: newDepth =", newDepth)
              const newSettings: FocusGuardSettings = {
                ...settings,
                videoAnalysis: {
                  showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                  autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                  botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                  showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                  confirmCreditUsage: settings.videoAnalysis?.confirmCreditUsage ?? true,
                  maxCommentDepth: newDepth
                }
              }
              console.log("📊 Saving settings to storage:", newSettings)
              setSettings(newSettings)
              await chrome.storage.sync.set({ settings: newSettings })
              console.log("✅ Settings saved to chrome.storage.sync")
              
              // Verify it was saved
              const verify = await chrome.storage.sync.get(["settings"])
              console.log("🔍 Verified saved settings:", verify.settings)
            }}
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "3px",
              outline: "none",
              cursor: account?.tier === "pro" ? "pointer" : "not-allowed"
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#999", marginTop: "4px" }}>
            <span>Fast (100)</span>
            <span>Deep (1000)</span>
          </div>
          {account.tier !== "pro" && (
            <div style={{
              fontSize: "11px",
              color: "#f59e0b",
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#fffbeb",
              borderRadius: "4px",
              border: "1px solid #fef3c7"
            }}>
              💎 <strong>Upgrade to PRO</strong> to analyze up to 1,000 comments per video for deeper insights.
            </div>
          )}
        </div>
      </div>

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
