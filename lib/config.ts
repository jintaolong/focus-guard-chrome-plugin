// Configuration service - uses environment variables baked into build
interface RemoteConfig {
  api_url: string
  portal_url: string
  features?: {
    [key: string]: boolean
  }
}

// Environment variables are baked in at build time by Plasmo
// Development: Uses .env and .env.development
// Production: Uses .env.production
const DEFAULT_API_URL = "https://api.commentverdict.com/api/v1"
const DEFAULT_PORTAL_URL = "https://app.commentverdict.com"

export class ConfigService {
  /**
   * Get configuration from environment variables
   * These are baked into the build by Plasmo, so no remote fetching needed
   */
  static async getConfig(): Promise<RemoteConfig> {
    const config = {
      api_url: process.env.PLASMO_PUBLIC_API_URL || DEFAULT_API_URL,
      portal_url: process.env.PLASMO_PUBLIC_WEB_PORTAL_URL || DEFAULT_PORTAL_URL
    }
    
    console.log("ConfigService: Using build-time config:", config)
    return config
  }

  /**
   * Legacy method for compatibility - just returns getConfig()
   */
  static async refreshConfig(): Promise<RemoteConfig> {
    return await this.getConfig()
  }

  /**
   * Legacy method for compatibility - no-op since we don't cache
   */
  static clearCache(): void {
    // No-op: config is baked in at build time
  }
}