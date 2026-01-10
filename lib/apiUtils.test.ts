import { describe, it, expect } from 'vitest'
import { APIError } from './apiUtils'

describe('API Utils', () => {
  describe('APIError', () => {
    it('should create an APIError with all properties', () => {
      const error = new APIError({
        message: 'Test error',
        status: 400,
        code: 'TEST_ERROR',
        isAuthError: true,
        isRateLimitError: false,
        isNetworkError: false,
        isTierRestriction: false
      })

      expect(error.message).toBe('Test error')
      expect(error.status).toBe(400)
      expect(error.code).toBe('TEST_ERROR')
      expect(error.isAuthError).toBe(true)
      expect(error.isRateLimitError).toBe(false)
      expect(error.isNetworkError).toBe(false)
      expect(error.isTierRestriction).toBe(false)
    })

    it('should create a tier restriction error', () => {
      const tierRestriction: any = {
        code: 'TIER_RESTRICTION',
        required_tier: 'starter',
        current_tier: 'free',
        message: 'Upgrade required',
        upgrade_url: 'https://example.com/upgrade'
      }

      const error = new APIError({
        message: 'Tier restriction',
        isAuthError: false,
        isRateLimitError: false,
        isNetworkError: false,
        isTierRestriction: true,
        tierRestriction
      })

      expect(error.isTierRestriction).toBe(true)
      expect(error.tierRestriction).toEqual(tierRestriction)
    })

    it('should handle rate limit errors', () => {
      const error = new APIError({
        message: 'Too many requests',
        status: 429,
        isAuthError: false,
        isRateLimitError: true,
        isNetworkError: false,
        isTierRestriction: false
      })

      expect(error.isRateLimitError).toBe(true)
      expect(error.status).toBe(429)
    })
  })
})
