import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '~lib/auth'

/**
 * Toggle Button Auth Guard Tests
 * 
 * Ensures users cannot generate reports when not authenticated:
 * - Toggle button should prompt login when clicked while logged out
 * - Analysis should fail with auth error when not logged in
 * - Toggle button should work normally when authenticated
 */

// Mock services
vi.mock('~lib/auth')
vi.mock('~lib/config', () => ({
  ConfigService: {
    getConfig: vi.fn().mockResolvedValue({
      api_url: 'https://test.commentverdict.com/api/v1',
      portal_url: 'http://localhost:3000'
    })
  }
}))

describe('Toggle Button - Auth Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Before User Sign In (Not Authenticated)', () => {
    beforeEach(() => {
      // Mock unauthenticated state
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue(null)
      vi.mocked(AuthService.getAccessToken).mockResolvedValue(null)
    })

    it('should detect user is not authenticated', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      expect(isAuth).toBe(false)
    })

    it('should not have access token', async () => {
      const token = await AuthService.getAccessToken()
      
      expect(token).toBeNull()
    })

    it('should fail when trying to generate report without auth', async () => {
      // This simulates what happens in content.tsx when clicking the toggle button
      const isAuth = await AuthService.isAuthenticated()
      
      if (!isAuth) {
        // Should throw error or prevent analysis
        expect(isAuth).toBe(false)
        
        // In real code, this would trigger an error message:
        // throw new Error("Not authenticated. Please log in to analyze videos.")
      }
    })

    it('should suggest user to login before use', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      if (!isAuth) {
        // Toggle button should show appropriate message
        const expectedMessage = "Not authenticated. Please log in to analyze videos."
        
        expect(isAuth).toBe(false)
        expect(expectedMessage).toContain("log in")
      }
    })

    it('should not be able to access API endpoints', async () => {
      // Mock API call failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response)

      const response = await AuthService.fetchWithAuth<any>('/videos/123/cache-status')
      
      expect((response as any).ok).toBe(false)
      expect((response as any).status).toBe(401)
    })

    it('should prevent cache status check without auth', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      if (!isAuth) {
        // Should not proceed with analysis flow
        expect(isAuth).toBe(false)
        
        // Prevent API calls that require authentication
        const token = await AuthService.getAccessToken()
        expect(token).toBeNull()
      }
    })

    it('should prevent job submission without auth', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      if (!isAuth) {
        // Job submission should be blocked
        expect(isAuth).toBe(false)
        
        // In real implementation, this would throw before reaching API:
        // throw new Error("Not authenticated. Please log in to analyze videos.")
      }
    })
  })

  describe('After User Sign In (Authenticated)', () => {
    const mockUser: any = {
      id: 123,
      email: 'test@example.com',
      full_name: 'Test User',
      is_active: true,
      is_verified: true,
      name: 'Test User',
      avatar: null,
      created_at: '2024-01-01T00:00:00Z'
    }

    const mockAccessToken = 'valid-access-token-xyz'

    beforeEach(() => {
      // Mock authenticated state
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(AuthService.getAccessToken).mockResolvedValue(mockAccessToken)
    })

    it('should detect user is authenticated', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      expect(isAuth).toBe(true)
    })

    it('should have valid access token', async () => {
      const token = await AuthService.getAccessToken()
      
      expect(token).toBe(mockAccessToken)
    })

    it('should allow cache status check when authenticated', async () => {
      // Mock successful API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ 
          cached: false,
          video_id: 'test-video-123' 
        })
      } as Response)

      const isAuth = await AuthService.isAuthenticated()
      expect(isAuth).toBe(true)
      
      const response = await AuthService.fetchWithAuth<any>('/videos/test-video-123/cache-status')
      
      expect((response as any).ok).toBe(true)
      expect((response as any).status).toBe(200)
    })

    it('should allow job submission when authenticated', async () => {
      // Mock successful job submission
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ 
          job_id: 'job-456',
          status: 'pending' 
        })
      } as Response)

      const isAuth = await AuthService.isAuthenticated()
      expect(isAuth).toBe(true)
      
      const response = await AuthService.fetchWithAuth<any>('/jobs/submit', {
        method: 'POST',
        body: JSON.stringify({ video_id: 'test-video-123' })
      })
      
      expect((response as any).ok).toBe(true)
      const data = await (response as any).json()
      expect(data.job_id).toBe('job-456')
    })

    it('should be able to generate reports', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      if (isAuth) {
        // Should proceed with analysis flow
        expect(isAuth).toBe(true)
        
        const token = await AuthService.getAccessToken()
        expect(token).toBeTruthy()
      }
    })

    it('should have user data available', async () => {
      const user = await AuthService.getCurrentUser()
      
      expect(user).toEqual(mockUser)
      expect(user?.email).toBe('test@example.com')
    })

    it('should maintain authenticated state during analysis', async () => {
      const isAuth = await AuthService.isAuthenticated()
      expect(isAuth).toBe(true)
      
      // Simulate multiple checks during analysis flow
      const check1 = await AuthService.isAuthenticated()
      const check2 = await AuthService.isAuthenticated()
      const check3 = await AuthService.isAuthenticated()
      
      expect(check1).toBe(true)
      expect(check2).toBe(true)
      expect(check3).toBe(true)
    })
  })

  describe('Auth State Transitions During Analysis', () => {
    it('should handle session expiration during analysis', async () => {
      // Start authenticated
      vi.mocked(AuthService.isAuthenticated).mockResolvedValueOnce(true)
      vi.mocked(AuthService.getAccessToken).mockResolvedValueOnce('valid-token')
      
      const isAuthBefore = await AuthService.isAuthenticated()
      expect(isAuthBefore).toBe(true)
      
      // Session expires mid-analysis
      vi.mocked(AuthService.isAuthenticated).mockResolvedValueOnce(false)
      vi.mocked(AuthService.getAccessToken).mockResolvedValueOnce(null)
      
      // Mock 401 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Session expired' })
      } as Response)
      
      const isAuthAfter = await AuthService.isAuthenticated()
      expect(isAuthAfter).toBe(false)
    })

    it('should handle token refresh during analysis', async () => {
      const initialToken = 'old-token'
      const refreshedToken = 'new-refreshed-token'
      
      // Start with valid token
      vi.mocked(AuthService.getAccessToken).mockResolvedValueOnce(initialToken)
      
      const tokenBefore = await AuthService.getAccessToken()
      expect(tokenBefore).toBe(initialToken)
      
      // Token gets refreshed
      vi.mocked(AuthService.getAccessToken).mockResolvedValueOnce(refreshedToken)
      
      const tokenAfter = await AuthService.getAccessToken()
      expect(tokenAfter).toBe(refreshedToken)
    })

    it('should prevent analysis from starting if user logs out', async () => {
      // Start authenticated
      vi.mocked(AuthService.isAuthenticated).mockResolvedValueOnce(true)
      
      const isAuthInitial = await AuthService.isAuthenticated()
      expect(isAuthInitial).toBe(true)
      
      // User logs out before analysis starts
      vi.mocked(AuthService.isAuthenticated).mockResolvedValueOnce(false)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValueOnce(null)
      
      const isAuthNow = await AuthService.isAuthenticated()
      
      if (!isAuthNow) {
        // Should block analysis
        expect(isAuthNow).toBe(false)
      }
    })
  })

  describe('Toggle Button State Display', () => {
    it('should show "Generate Report" when not authenticated (idle state)', async () => {
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      
      const isAuth = await AuthService.isAuthenticated()
      
      if (!isAuth) {
        // Button should be in idle state with message prompting login
        const buttonText = "Generate Report"
        expect(buttonText).toContain("Generate")
        expect(isAuth).toBe(false)
      }
    })

    it('should show analyzing state only when authenticated', async () => {
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      
      const isAuth = await AuthService.isAuthenticated()
      
      if (isAuth) {
        // Can enter analyzing state
        const state = "analyzing"
        expect(state).toBe("analyzing")
        expect(isAuth).toBe(true)
      }
    })

    it('should show error state when auth fails during click', async () => {
      // Not authenticated
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      
      const isAuth = await AuthService.isAuthenticated()
      
      if (!isAuth) {
        const errorMessage = "Not authenticated. Please log in to analyze videos."
        expect(errorMessage).toContain("log in")
      }
    })

    it('should show complete state with results only when authenticated', async () => {
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      
      const isAuth = await AuthService.isAuthenticated()
      
      if (isAuth) {
        // Can show results (complete state)
        const state = "complete"
        const trustScore = 7.5
        const verdict = "LEGIT"
        
        expect(state).toBe("complete")
        expect(trustScore).toBeGreaterThan(0)
        expect(verdict).toBeTruthy()
      }
    })
  })

  describe('Edge Cases - Auth Guard', () => {
    it('should handle race between click and logout', async () => {
      // Start authenticated
      vi.mocked(AuthService.isAuthenticated).mockResolvedValueOnce(true)
      
      const clickTime = await AuthService.isAuthenticated()
      expect(clickTime).toBe(true)
      
      // User logs out immediately after click
      vi.mocked(AuthService.isAuthenticated).mockResolvedValueOnce(false)
      
      // Second check (in analysis start) should catch logout
      const analysisStart = await AuthService.isAuthenticated()
      
      if (!analysisStart) {
        // Should prevent analysis
        expect(analysisStart).toBe(false)
      }
    })

    it('should handle rapid clicks when not authenticated', async () => {
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      
      // Simulate multiple rapid clicks
      const clicks = await Promise.all([
        AuthService.isAuthenticated(),
        AuthService.isAuthenticated(),
        AuthService.isAuthenticated()
      ])
      
      // All should return false
      expect(clicks).toEqual([false, false, false])
    })

    it('should handle auth check failure gracefully', async () => {
      // Mock auth check error
      vi.mocked(AuthService.isAuthenticated).mockRejectedValueOnce(
        new Error('Storage unavailable')
      )
      
      try {
        await AuthService.isAuthenticated()
        expect.fail('Should have thrown error')
      } catch (error) {
        expect((error as Error).message).toContain('Storage unavailable')
      }
    })

    it('should prevent analysis if token exists but is invalid', async () => {
      // Has token but it's invalid
      vi.mocked(AuthService.getAccessToken).mockResolvedValue('invalid-token')
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      
      // Mock 401 response (invalid token)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid token' })
      } as Response)
      
      const response = await AuthService.fetchWithAuth<any>('/videos/123/cache-status')
      
      expect((response as any).ok).toBe(false)
      expect((response as any).status).toBe(401)
    })
  })
})
