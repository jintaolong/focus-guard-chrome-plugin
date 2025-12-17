// Configuration service - loads remote config on extension startup
interface RemoteConfig {
  api_url: string
  portal_url: string
  features?: {
    [key: string]: boolean
  }
}

const CONFIG_STORAGE_KEY = "comment_verdict_remote_config"
const CONFIG_CACHE_DURATION = 1000 * 60 * 60 // 1 hour
const REMOTE_CONFIG_URL = "https://focus-guard.github.io/focus-guard-config/config.json"

// Check if we're in debug/development mode
const isDebugMode = () => {
  const debugEnv = process.env.FOCUS_GUARD_DEBUG
  return debugEnv === "1" || debugEnv === "true" || process.env.NODE_ENV === "development"
}

export class ConfigService {
  private static cachedConfig: RemoteConfig | null = null
  private static lastFetch: number = 0

  /**
   * Get configuration with fallback to environment variables
   * In debug mode: always use .env file
   * In production mode: fetch from remote with .env fallback
   */
  static async getConfig(): Promise<RemoteConfig> {
    // In debug/development mode, always use environment variables
    if (isDebugMode()) {
      console.log("ConfigService: Debug mode enabled, using .env file")
      return {
        api_url: process.env.PLASMO_PUBLIC_API_URL || "https://commentverdict.com/api/v1",
        portal_url: process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "http://localhost:3000"
      }
    }

    // In production mode, try to load from remote first
    const remoteConfig = await this.fetchRemoteConfig()
    
    if (remoteConfig) {
      return remoteConfig
    }

    // Fallback to environment variables if remote fetch fails
    console.warn("ConfigService: Remote config failed, using .env fallback")
    return {
      api_url: process.env.PLASMO_PUBLIC_API_URL || "https://commentverdict.com/api/v1",
      portal_url: process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || "https://app.focus-guard.com"
    }
  }

  /**
   * Fetch remote configuration with caching
   */
  private static async fetchRemoteConfig(): Promise<RemoteConfig | null> {
    const now = Date.now()

    // Return cached if still valid
    if (this.cachedConfig && (now - this.lastFetch) < CONFIG_CACHE_DURATION) {
      return this.cachedConfig
    }

    try {
      // Try to fetch from remote
      const response = await fetch(REMOTE_CONFIG_URL, {
        method: "GET",
        cache: "no-cache"
      })

      if (!response.ok) {
        throw new Error(`Config fetch failed: ${response.status}`)
      }

      const config = await response.json() as RemoteConfig
      
      // Validate config structure
      if (!config.api_url || !config.portal_url) {
        throw new Error("Invalid config structure")
      }

      // Cache the config
      this.cachedConfig = config
      this.lastFetch = now
      
      // Persist to storage
      await chrome.storage.local.set({
        [CONFIG_STORAGE_KEY]: config,
        [`${CONFIG_STORAGE_KEY}_timestamp`]: now
      })

      console.log("ConfigService: Remote config loaded successfully")
      return config
    } catch (error) {
      console.warn("ConfigService: Failed to fetch remote config, using cached/fallback", error)

      // Try to load from storage
      try {
        const stored = await chrome.storage.local.get([CONFIG_STORAGE_KEY, `${CONFIG_STORAGE_KEY}_timestamp`])
        if (stored[CONFIG_STORAGE_KEY]) {
          this.cachedConfig = stored[CONFIG_STORAGE_KEY]
          this.lastFetch = stored[`${CONFIG_STORAGE_KEY}_timestamp`] || 0
          return this.cachedConfig
        }
      } catch (e) {
        console.error("ConfigService: Failed to load from storage", e)
      }

      return null
    }
  }

  /**
   * Force refresh configuration from remote
   */
  static async refreshConfig(): Promise<RemoteConfig> {
    this.cachedConfig = null
    this.lastFetch = 0
    return await this.getConfig()
  }

  /**
   * Clear cached configuration
   */
  static clearCache(): void {
    this.cachedConfig = null
    this.lastFetch = 0
    chrome.storage.local.remove([CONFIG_STORAGE_KEY, `${CONFIG_STORAGE_KEY}_timestamp`])
  }
}