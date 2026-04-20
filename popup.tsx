import { useState, useEffect, useRef, useCallback } from "react"

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

const DEFAULT_SETTINGS: FocusGuardSettings = {
  isEnabled: true,
  videoAnalysis: {
    showPreWatchPopover: true,
    autoAnalyze: false,
    botDetectionEnabled: true,
    showCachedVerdict: false,
    confirmCreditUsage: true,
    maxCommentDepth: 100,
    autoQuickVerdict: true
  }
}

function normalizeSettings(input?: FocusGuardSettings | null): FocusGuardSettings {
  const rawDepth = input?.videoAnalysis?.maxCommentDepth
  const normalizedDepth = typeof rawDepth === "number" && Number.isFinite(rawDepth)
    ? Math.max(100, Math.min(1000, Math.round(rawDepth)))
    : 100

  return {
    isEnabled: input?.isEnabled ?? true,
    videoAnalysis: {
      showPreWatchPopover: input?.videoAnalysis?.showPreWatchPopover ?? true,
      autoAnalyze: input?.videoAnalysis?.autoAnalyze ?? false,
      botDetectionEnabled: input?.videoAnalysis?.botDetectionEnabled ?? true,
      showCachedVerdict: input?.videoAnalysis?.showCachedVerdict ?? false,
      confirmCreditUsage: input?.videoAnalysis?.confirmCreditUsage ?? true,
      maxCommentDepth: normalizedDepth,
      proToggleMode: input?.videoAnalysis?.proToggleMode ?? "free_verdict",
      autoQuickVerdict: input?.videoAnalysis?.autoQuickVerdict ?? true,
    }
  }
}

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
  const [settings, setSettings] = useState<FocusGuardSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadUserDataInFlight = useRef<Promise<void> | null>(null)
  const lastLoadTime = useRef(0)
  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const loadUserData = useCallback(async (reason: string = "manual", force: boolean = false) => {
    const now = Date.now()
    const minIntervalMs = 1000
    if (loadUserDataInFlight.current) {
      if (!force) {
        console.log("Popup: loadUserData already in progress, skipping", reason)
        return loadUserDataInFlight.current
      }
      // force=true: wait for current in-flight to settle, then run a fresh load so
      // event-driven reloads (OAuth, auth-state-change, logout) always reflect latest state.
      console.log("Popup: loadUserData force-waiting for in-flight to settle", reason)
      await loadUserDataInFlight.current.catch(() => {})
    }
    // Throttle only applies to non-forced calls (e.g. visibility/focus triggers).
    // Event-driven reloads (OAuth, auth state change, storage token change) must
    // always run so the UI reflects the new state immediately.
    if (!force && now - lastLoadTime.current < minIntervalMs) {
      console.log("Popup: loadUserData throttled", reason)
      return
    }
    lastLoadTime.current = now

    const run = (async () => {
      try {
        console.log("Popup: Loading user data...", reason)
        const currentSettings = settingsRef.current
      
      // Load settings from chrome storage
      const result = await chrome.storage.sync.get(["settings"])
      const storedSettings = normalizeSettings(result.settings || currentSettings)
      if (result.settings) {
        setSettings(storedSettings)
      } else {
        // If no settings exist, initialize defaults and save them
        setSettings(storedSettings)
        await chrome.storage.sync.set({ settings: storedSettings })
        console.log("Popup: Initialized default settings")
      }

      // Check if user is authenticated
      const isAuth = await AuthService.isAuthenticated()
      console.log("Popup: isAuthenticated =", isAuth)
      
      if (isAuth) {
        // Get user and subscription info
        console.log("Popup: Fetching user, subscription, usage, and credits...")
        const [user, subscription, usage, credits] = await Promise.all([
          AuthService.getCurrentUser(true),
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
          // free: max 100, starter: max 300, pro: max 1000
          const tierMaxComments = tier === "pro" ? 1000 : tier === "starter" ? 300 : 100
          const currentMaxCommentDepth = storedSettings.videoAnalysis?.maxCommentDepth ?? 100
          const shouldEnforceLimit = currentMaxCommentDepth > tierMaxComments
          const needsUpdate = result.settings?.videoAnalysis?.confirmCreditUsage === undefined || shouldEnforceLimit
          
          if (needsUpdate) {
            const updatedSettings: FocusGuardSettings = {
              ...storedSettings,
              videoAnalysis: {
                showPreWatchPopover: storedSettings.videoAnalysis?.showPreWatchPopover ?? true,
                autoAnalyze: storedSettings.videoAnalysis?.autoAnalyze ?? false,
                botDetectionEnabled: storedSettings.videoAnalysis?.botDetectionEnabled ?? true,
                showCachedVerdict: storedSettings.videoAnalysis?.showCachedVerdict ?? false,
                confirmCreditUsage: tier === "free", // ON for free, OFF for starter/pro
                maxCommentDepth: Math.min(currentMaxCommentDepth, tierMaxComments),
                proToggleMode: storedSettings.videoAnalysis?.proToggleMode ?? "free_verdict",
                autoQuickVerdict: storedSettings.videoAnalysis?.autoQuickVerdict ?? true,
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
        console.log("Popup: Not authenticated, checking for saved guest session")
        // Restore a persisted guest session so visitors aren't asked to log in
        // again every time the popup is reopened.
        const localResult = await chrome.storage.local.get(["guest_session"])
        if (localResult.guest_session?.deviceFingerprint) {
          const fp: string = localResult.guest_session.deviceFingerprint
          const guestAccount: UserAccount = {
            isLoggedIn: true,
            isGuest: true,
            deviceFingerprint: fp,
            tier: "free",
            dailySearchesLimit: 0,
            searchesUsedToday: 0,
            searchesRemaining: 0,
            resetTime: "",
            creditsBalance: 0,
            monthlyCreditsRemaining: 0,
            monthlyQuota: 0,
            purchasedCredits: 0
          }
          console.log("Popup: Restored guest session from local storage")
          setAccount(guestAccount)
        } else {
          console.log("Popup: No guest session found, setting account to null")
          setAccount(null)
        }
      }
      } catch (error) {
        console.error("Popup: Failed to load user data:", error)
        // If there's an error, user is likely not authenticated
        setAccount(null)
      } finally {
        setIsLoading(false)
      }
    })()

    loadUserDataInFlight.current = run
    try {
      await run
    } finally {
      loadUserDataInFlight.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    console.log("Comment Verdict popup loaded")
    // Optional storage test in development; disabled by default to avoid
    // generating extra sync writes on every popup open.
    if (process.env.NODE_ENV === "development" && process.env.PLASMO_PUBLIC_ENABLE_STORAGE_TEST === "1" && typeof AuthService.testStorage === "function") {
      Promise.resolve()
        .then(() => AuthService.testStorage())
        .then(() => console.log("Storage test passed"))
        .catch((err) => console.error("Storage test failed:", err))
    }
    loadUserData("initial")
    
    // Reload data when popup becomes visible (e.g., user reopens it)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("Popup: Became visible, refreshing user data")
        loadUserData("visibility")
      }
    }
    
    // Also reload on window focus (for when popup is already open but user returns to it)
    const handleFocus = () => {
      console.log("Popup: Got focus, refreshing user data")
      loadUserData("focus")
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    // Listen for storage changes (e.g., OAuth completion in background or portal sync)
    const storageListener = (changes: any, areaName: string) => {
      if (areaName === 'sync') {
        // Check for token, user, or account changes
        if (changes.focus_guard_access_token || changes.focus_guard_user || changes.account || changes.isAuthenticated) {
          console.log("Popup: Detected auth change in storage, reloading data")
          // force=true: bypass throttle so logout/login storage events always reflect immediately
          loadUserData("storage-change", true)
        }
      }
      if (areaName === 'local') {
        // Guest session cleared in another context (e.g. background script)
        if (changes.guest_session && !changes.guest_session.newValue) {
          console.log("Popup: Guest session cleared externally, resetting account")
          setAccount(null)
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
        // small delay to allow storage propagation; force=true bypasses throttle
        setTimeout(() => {
          loadUserData("oauth-complete", true)
        }, 100)
        return
      }

      if (message.type === 'AUTH_STATE_CHANGED') {
        console.log('Popup: AUTH_STATE_CHANGED received, reloading user data', message.isAuthenticated)
        // force=true: bypass throttle so the new auth state is always reflected
        loadUserData("auth-state", true)
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
  }, [loadUserData])

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

  const handleGuestLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const fingerprint = await FocusGuardAPI.getDeviceFingerprint()
      const guestAccount: UserAccount = {
        isLoggedIn: true,
        isGuest: true,
        deviceFingerprint: fingerprint,
        tier: "free",
        dailySearchesLimit: 0,
        searchesUsedToday: 0,
        searchesRemaining: 0,
        resetTime: "",
        creditsBalance: 0,
        monthlyCreditsRemaining: 0,
        monthlyQuota: 0,
        purchasedCredits: 0
      }
      // Persist to local storage so the session survives popup close/reload
      await chrome.storage.local.set({ guest_session: { deviceFingerprint: fingerprint } })
      setAccount(guestAccount)
    } catch (error) {
      console.error("Guest login failed:", error)
      setError(error instanceof Error ? error.message : "Failed to continue as visitor")
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
    // For guest sessions clear the persisted session and in-memory account
    if (account?.isGuest) {
      await chrome.storage.local.remove("guest_session")
      setAccount(null)
      return
    }
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
          maxCommentDepth: 100,
          autoQuickVerdict: true
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
        <LoginForm onLogin={handleLogin} onGuestLogin={handleGuestLogin} isLoading={isLoading} />
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
          {account.isGuest && (
            <span style={{
              marginLeft: "auto",
              fontSize: "10px",
              fontWeight: "700",
              color: "#6b7280",
              backgroundColor: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "2px 8px",
              letterSpacing: "0.04em"
            }}>VISITOR</span>
          )}
        </h1>
        {account.isGuest && (
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#9ca3af" }}>
            You're browsing as a visitor.{" "}
            <button
              type="button"
              onClick={() => setAccount(null)}
              style={{
                color: "#3b82f6",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: "12px",
                textDecoration: "underline"
              }}>
              Sign in
            </button>
            {" "}for full access.
          </p>
        )}
      </div>

      {/* Account Info — skip for visitors since they have no account data */}
      {!account.isGuest && (
      <AccountInfo 
        account={account} 
        onManagePlan={handleManagePlan} 
        onTopUp={handleTopUp} 
        onResendVerification={handleResendVerification}
      />
      )}

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
                maxCommentDepth: settings.videoAnalysis?.maxCommentDepth ?? 100,
                proToggleMode: settings.videoAnalysis?.proToggleMode ?? "free_verdict",
                autoQuickVerdict: settings.videoAnalysis?.autoQuickVerdict ?? true,
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
                  maxCommentDepth: settings.videoAnalysis?.maxCommentDepth ?? 100,
                  proToggleMode: settings.videoAnalysis?.proToggleMode ?? "free_verdict",
                  autoQuickVerdict: settings.videoAnalysis?.autoQuickVerdict ?? true,
                }
              }
              setSettings(newSettings)
              await chrome.storage.sync.set({ settings: newSettings })
            }}
            label="Confirm Before Using Credits"
            description="Get a confirmation dialog before analyzing a video"
          />
        </div>

        {/* Auto Quick Verdict Toggle */}
        <div style={{ marginTop: "12px" }}>
          <ToggleSwitch
            enabled={settings.videoAnalysis?.autoQuickVerdict !== false}
            onToggle={async (enabled) => {
              const newSettings: FocusGuardSettings = {
                ...settings,
                videoAnalysis: {
                  showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                  autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                  botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                  showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                  confirmCreditUsage: settings.videoAnalysis?.confirmCreditUsage ?? true,
                  maxCommentDepth: settings.videoAnalysis?.maxCommentDepth ?? 100,
                  proToggleMode: settings.videoAnalysis?.proToggleMode ?? "free_verdict",
                  autoQuickVerdict: enabled,
                }
              }
              setSettings(newSettings)
              await chrome.storage.sync.set({ settings: newSettings })
            }}
            label="Auto Quick Verdict"
            description="Automatically run quick verdict when you open a video"
          />
        </div>

        {/* Comment Depth Slider removed — slider now lives in the side panel header for PRO users */}

        {/* Toggle Button Default — visible to all users */}
        <div style={{ marginTop: "16px" }}>
          <div style={{
            padding: "12px 16px",
            backgroundColor: "white",
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
          }}>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", margin: "0 0 2px" }}>
              Toggle Button Default
            </p>
            <p style={{ fontSize: "12px", color: "#666", margin: "0 0 10px" }}>
              What the ⊙ button triggers when you click it on a new video
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(["free_verdict", "full_analysis"] as const).map((mode) => {
                const isVisitor = !!account?.isGuest
                const isPro = account?.tier === "pro"
                const isDisabledOption = isVisitor && mode === "full_analysis"
                const selectedMode = isVisitor ? "free_verdict" : (settings.videoAnalysis?.proToggleMode ?? "free_verdict")
                const isSelected = selectedMode === mode

                // Fixed values for non-pro tiers
                const fixedVal = mode === "free_verdict" ? 200 : 100
                const sliderMax = mode === "free_verdict" ? 500 : 1000
                const sliderSteps = mode === "free_verdict"
                  ? [100, 200, 300, 400, 500]
                  : [100, 300, 500, 700, 1000]
                const canSlide = isPro && !isDisabledOption
                const currentDepth = settings.videoAnalysis?.maxCommentDepth ?? fixedVal
                const displayVal = canSlide ? Math.min(currentDepth, sliderMax) : fixedVal

                return (
                  <div key={mode} style={{
                    padding: "10px",
                    borderRadius: "8px",
                    backgroundColor: isSelected ? "#eff6ff" : (isDisabledOption ? "#fafafa" : "#f9fafb"),
                    border: `1px solid ${isSelected ? "#3b82f6" : "#e5e7eb"}`,
                    opacity: isDisabledOption ? 0.4 : 1,
                    transition: "all 0.15s",
                  }}>
                    {/* Mode header row — clickable for free/pro */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "10px", cursor: isDisabledOption || isVisitor ? "default" : "pointer" }}
                      onClick={isDisabledOption || isVisitor ? undefined : async () => {
                        const ns: FocusGuardSettings = {
                          ...settings,
                          videoAnalysis: {
                            showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                            autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                            botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                            showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                            confirmCreditUsage: settings.videoAnalysis?.confirmCreditUsage ?? true,
                            maxCommentDepth: settings.videoAnalysis?.maxCommentDepth ?? fixedVal,
                            proToggleMode: mode,
                            autoQuickVerdict: settings.videoAnalysis?.autoQuickVerdict ?? true,
                          }
                        }
                        setSettings(ns)
                        await chrome.storage.sync.set({ settings: ns })
                      }}
                    >
                      {/* Custom radio dot */}
                      <div style={{
                        width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${isSelected ? "#3b82f6" : "#d1d5db"}`,
                        backgroundColor: isSelected ? "#3b82f6" : "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isSelected && <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "white" }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: isSelected ? "#1d4ed8" : (isDisabledOption ? "#9ca3af" : "#374151") }}>
                            {mode === "free_verdict" ? "⚡ Quick Verdict" : "🔬 Full Analysis"}
                          </span>
                          {isDisabledOption && (
                            <span style={{ fontSize: "9px", color: "#9ca3af", fontStyle: "italic" }}>sign in required</span>
                          )}
                          {mode === "full_analysis" && !isDisabledOption && !isPro && (
                            <span style={{ fontSize: "9px", color: "#6b7280", fontStyle: "italic" }}>credits used</span>
                          )}
                        </div>
                        <p style={{ fontSize: "11px", color: "#6b7280", margin: "2px 0 0" }}>
                          {mode === "free_verdict" ? "Fast free verdict — no credits used" : "Comprehensive analysis using credits"}
                        </p>
                      </div>
                    </div>

                    {/* Max comments sub-row */}
                    {!isDisabledOption && (
                      <div style={{ marginTop: "8px", paddingLeft: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: canSlide ? "5px" : "0" }}>
                          <span style={{ fontSize: "9.5px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                            Max Comments
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: canSlide ? "#2563eb" : "#9ca3af" }}>
                            {displayVal}
                          </span>
                        </div>
                        {canSlide ? (
                          <>
                            <input
                              type="range"
                              min={100}
                              max={sliderMax}
                              step={100}
                              value={displayVal}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const v = parseInt(e.target.value)
                                setSettings({
                                  ...settings,
                                  videoAnalysis: {
                                    showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                                    autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                                    botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                                    showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                                    confirmCreditUsage: settings.videoAnalysis?.confirmCreditUsage ?? true,
                                    maxCommentDepth: v,
                                    proToggleMode: settings.videoAnalysis?.proToggleMode ?? "free_verdict",
                                    autoQuickVerdict: settings.videoAnalysis?.autoQuickVerdict ?? true,
                                  }
                                })
                              }}
                              onMouseUp={async (e) => {
                                const v = parseInt((e.target as HTMLInputElement).value)
                                const ns: FocusGuardSettings = {
                                  ...settings,
                                  videoAnalysis: {
                                    showPreWatchPopover: settings.videoAnalysis?.showPreWatchPopover ?? true,
                                    autoAnalyze: settings.videoAnalysis?.autoAnalyze ?? false,
                                    botDetectionEnabled: settings.videoAnalysis?.botDetectionEnabled ?? true,
                                    showCachedVerdict: settings.videoAnalysis?.showCachedVerdict ?? false,
                                    confirmCreditUsage: settings.videoAnalysis?.confirmCreditUsage ?? true,
                                    maxCommentDepth: v,
                                    proToggleMode: settings.videoAnalysis?.proToggleMode ?? "free_verdict",
                                    autoQuickVerdict: settings.videoAnalysis?.autoQuickVerdict ?? true,
                                  }
                                }
                                setSettings(ns)
                                await chrome.storage.sync.set({ settings: ns })
                              }}
                              style={{ width: "100%", height: "3px", borderRadius: "2px", cursor: "pointer", accentColor: "#3b82f6" }}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", color: "rgba(0,0,0,0.3)", marginTop: "3px", padding: "0 1px" }}>
                              {sliderSteps.map(n => (
                                <span key={n} style={{
                                  fontWeight: n === displayVal ? "700" : "400",
                                  color: n === displayVal ? "#2563eb" : undefined,
                                }}>
                                  {n >= 1000 ? "1k" : n}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: "9px", color: "#c4b5fd", marginTop: "2px" }}>
                            {isPro ? "" : "fixed — upgrade to Pro to adjust"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
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
          {account.isGuest ? "Exit Visitor Mode" : "Sign Out"}
        </button>
      </div>
    </div>
  )
}

export default IndexPopup
