// Subscription service for CommentVerdict API integration
import { AuthService } from "./auth"
import type {
  SubscriptionResponse,
  SubscriptionTiersResponse,
  SubscriptionUsage,
  CheckoutResponse
} from "~types/backend"

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "https://api.commentverdict.com/api/v1"

export class SubscriptionService {
  private static async fetchWithAuth<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    await AuthService.ensureValidToken()
    const accessToken = await AuthService.getAccessToken()

    // Use background worker to make the request (bypasses CORS for content scripts)
    console.log("SubscriptionService: Sending API request via background worker:", endpoint)
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        endpoint,
        options: {
          method: options?.method || 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...options?.headers
          },
          body: options?.body
        }
      })

      console.log("SubscriptionService: Background response:", response?.success ? 'success' : 'failed')

      if (!response?.success) {
        throw new Error(response?.error || 'API request failed')
      }

      return response.data as T
    } catch (error) {
      console.error("SubscriptionService: API request error:", error)
      throw error
    }
  }

  /**
   * Get available subscription tiers
   */
  static async getTiers(): Promise<SubscriptionTiersResponse> {
    // This endpoint doesn't require authentication
    console.log("SubscriptionService: Fetching tiers via background worker")
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        endpoint: '/subscriptions/tiers',
        options: { method: 'GET', headers: {} }
      })

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to fetch tiers')
      }

      return response.data as SubscriptionTiersResponse
    } catch (error) {
      console.error("SubscriptionService: Failed to fetch tiers:", error)
      throw error
    }
  }

  /**
   * Get current user's subscription
   */
  static async getSubscription(): Promise<SubscriptionResponse> {
    return this.fetchWithAuth<SubscriptionResponse>("/subscriptions/")
  }

  /**
   * Get subscription usage information
   */
  static async getUsage(): Promise<SubscriptionUsage> {
    return this.fetchWithAuth<SubscriptionUsage>("/subscriptions/usage")
  }

  /**
   * Change subscription tier (MVP/test mode without payment)
   */
  static async changeTier(targetTier: "free" | "starter" | "pro"): Promise<SubscriptionResponse> {
    return this.fetchWithAuth<SubscriptionResponse>(
      `/subscriptions/change-tier/${targetTier}`,
      { method: "POST" }
    )
  }

  /**
   * Downgrade subscription (cancels at period end)
   */
  static async downgrade(): Promise<SubscriptionResponse> {
    return this.fetchWithAuth<SubscriptionResponse>("/subscriptions/downgrade", {
      method: "POST"
    })
  }

  /**
   * Create Stripe checkout session for upgrade
   */
  static async createCheckoutSession(): Promise<CheckoutResponse> {
    return this.fetchWithAuth<CheckoutResponse>("/subscriptions/checkout", {
      method: "POST"
    })
  }

  /**
   * Check if user can perform a search/analysis
   */
  static async canSearch(): Promise<boolean> {
    try {
      const usage = await this.getUsage()
      return usage.can_search
    } catch (error) {
      console.error("Failed to check search availability:", error)
      return false
    }
  }

  /**
   * Check if user has pro features
   */
  static async hasProFeatures(): Promise<boolean> {
    try {
      const subscription = await this.getSubscription()
      return subscription.tier === "PRO"
    } catch (error) {
      console.error("Failed to check pro features:", error)
      return false
    }
  }

  /**
   * Increment search/analysis usage (called after successful analysis)
   * Note: The backend automatically increments usage, but we can track it locally
   */
  static async trackUsage(): Promise<void> {
    // The backend automatically tracks usage when endpoints are called
    // This method is here for any local tracking we might need
    try {
      const usage = await this.getUsage()
      
      // Store usage in local storage for quick access
      await chrome.storage.local.set({
        focus_guard_usage: {
          ...usage,
          last_updated: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error("Failed to track usage:", error)
    }
  }

  /**
   * Get cached usage from local storage (for quick UI updates)
   */
  static async getCachedUsage(): Promise<SubscriptionUsage | null> {
    try {
      const result = await chrome.storage.local.get(["focus_guard_usage"])
      return result.focus_guard_usage || null
    } catch (error) {
      console.error("Failed to get cached usage:", error)
      return null
    }
  }

  /**
   * Open checkout URL in new tab
   */
  static async openCheckout(): Promise<void> {
    try {
      const checkout = await this.createCheckoutSession()
      await chrome.tabs.create({ url: checkout.checkout_url })
    } catch (error) {
      console.error("Failed to open checkout:", error)
      throw error
    }
  }
}
