// API utilities and error handling
import { AuthService } from "./auth"
import type { TierRestriction } from "~types/tierRestriction"

export interface APIErrorDetails {
  message: string
  status?: number
  code?: string
  isAuthError: boolean
  isRateLimitError: boolean
  isNetworkError: boolean
  isTierRestriction: boolean
  tierRestriction?: TierRestriction
}

export class APIError extends Error {
  public status?: number
  public code?: string
  public isAuthError: boolean
  public isRateLimitError: boolean
  public isNetworkError: boolean
  public isTierRestriction: boolean
  public tierRestriction?: TierRestriction

  constructor(details: APIErrorDetails) {
    super(details.message)
    this.name = "APIError"
    this.status = details.status
    this.code = details.code
    this.isAuthError = details.isAuthError
    this.isRateLimitError = details.isRateLimitError
    this.isNetworkError = details.isNetworkError
    this.isTierRestriction = details.isTierRestriction
    this.tierRestriction = details.tierRestriction
  }
}

/**
 * Parse API error response and create structured error
 */
export async function parseAPIError(response: Response): Promise<APIError> {
  let message = `API Error: ${response.statusText}`
  let code: string | undefined
  let isAuthError = false
  let isRateLimitError = false
  let isTierRestriction = false
  let tierRestriction: TierRestriction | undefined

  try {
    const data = await response.json()
    
    // Check for tier restriction first
    if (data.code === "TIER_RESTRICTION" || data.detail?.code === "TIER_RESTRICTION") {
      const restriction = data.detail || data
      isTierRestriction = true
      tierRestriction = {
        code: "TIER_RESTRICTION",
        required_tier: restriction.required_tier,
        current_tier: restriction.current_tier,
        message: restriction.message,
        upgrade_url: restriction.upgrade_url
      }
      message = restriction.message
      code = "TIER_RESTRICTION"
    } else if (typeof data.detail === "string") {
      message = data.detail
    } else if (Array.isArray(data.detail)) {
      // Validation errors
      message = data.detail.map((e: any) => e.msg).join(", ")
    } else if (data.message) {
      message = data.message
    }

    if (!code) {
      code = data.code || data.error_code
    }
  } catch (e) {
    // Response not JSON, use statusText
  }

  // Check for specific error types (but not if it's a tier restriction)
  if (!isTierRestriction) {
    if (response.status === 401 || response.status === 403) {
      isAuthError = true
      if (response.status === 401) {
        message = "Authentication required. Please log in."
      }
    } else if (response.status === 429) {
      isRateLimitError = true
      message = "Rate limit exceeded. Please try again later."
    }
  }

  return new APIError({
    message,
    status: response.status,
    code,
    isAuthError,
    isRateLimitError,
    isNetworkError: false,
    isTierRestriction,
    tierRestriction
  })
}

/**
 * Retry fetch with exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  initialDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Don't retry on client errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response
      }

      // Success
      if (response.ok) {
        return response
      }

      // Server error or rate limit - retry
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt)
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt)
        console.log(`Network error, retry ${attempt + 1}/${maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
    }
  }

  throw new APIError({
    message: lastError?.message || "Network request failed after retries",
    isAuthError: false,
    isRateLimitError: false,
    isNetworkError: true,
    isTierRestriction: false
  })
}

/**
 * Fetch with automatic token refresh on 401
 */
export async function fetchWithAuthRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Ensure valid token
  try {
    await AuthService.ensureValidToken()
  } catch (error) {
    throw new APIError({
      message: "Authentication required. Please log in.",
      status: 401,
      isAuthError: true,
      isRateLimitError: false,
      isNetworkError: false,
      isTierRestriction: false
    })
  }

  const accessToken = await AuthService.getAccessToken()

  // First attempt with current token
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`
    }
  })

  // If 401, try to refresh token once
  if (response.status === 401) {
    try {
      console.log("Token expired, attempting refresh...")
      await AuthService.refreshAccessToken()
      const newToken = await AuthService.getAccessToken()

      // Retry with new token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`
        }
      })
    } catch (refreshError) {
      // Refresh failed, clear tokens and require re-login
      await AuthService.clearTokens()
      throw new APIError({
        message: "Session expired. Please log in again.",
        status: 401,
        isAuthError: true,
        isRateLimitError: false,
        isNetworkError: false,
        isTierRestriction: false
      })
    }
  }

  return response
}

/**
 * Show user-friendly error notification
 */
export function showErrorNotification(error: Error | APIError) {
  let title = "Error"
  let message = error.message

  if (error instanceof APIError) {
    if (error.isAuthError) {
      title = "Authentication Error"
      message = "Please log in to continue."
    } else if (error.isRateLimitError) {
      title = "Rate Limit Exceeded"
      message = "You've made too many requests. Please wait a moment and try again."
    } else if (error.isNetworkError) {
      title = "Network Error"
      message = "Please check your internet connection and try again."
    }
  }

  // Use Chrome notifications API
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.png"),
    title,
    message
  })
}

/**
 * Format error for display in UI
 */
export function formatErrorMessage(error: Error | APIError): string {
  if (error instanceof APIError) {
    if (error.isAuthError) {
      return "Authentication required. Please log in."
    } else if (error.isRateLimitError) {
      return "Rate limit exceeded. Please try again later."
    } else if (error.isNetworkError) {
      return "Network error. Please check your connection."
    }
  }

  return error.message || "An unexpected error occurred."
}
