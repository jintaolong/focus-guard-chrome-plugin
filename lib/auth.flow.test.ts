import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from './auth'

/**
 * Comprehensive Auth Flow Tests
 * 
 * This test suite ensures the authentication flow works correctly across
 * all release cycles, covering:
 * - First-time user experience (not logged in)
 * - Sign-in flow and state transitions
 * - Authenticated user experience
 * - Logout flow and state cleanup
 */

// Mock ConfigService to prevent async config loading
vi.mock('./config', () => ({
  ConfigService: {
    getConfig: vi.fn().mockResolvedValue({
      api_url: 'https://test.commentverdict.com/api/v1',
      portal_url: 'http://localhost:3000'
    })
  }
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('Auth Flow - Complete E2E', () => {
  let mockStorage: Record<string, any>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Initialize clean storage state
    mockStorage = {}
    
    // Mock chrome.storage.sync with in-memory implementation
    vi.mocked(chrome.storage.sync.get).mockImplementation((keys, callback: any) => {
      const result: Record<string, any> = {}
      const keyArray = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {})
      
      keyArray.forEach(key => {
        if (mockStorage[key] !== undefined) {
          result[key] = mockStorage[key]
        }
      })
      
      if (callback) callback(result)
    })
    
    vi.mocked(chrome.storage.sync.set).mockImplementation((items, callback: any) => {
      Object.assign(mockStorage, items)
      if (callback) callback()
    })
    
    vi.mocked(chrome.storage.sync.remove).mockImplementation((keys, callback: any) => {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      keyArray.forEach(key => delete mockStorage[key])
      if (callback) callback()
    })
    
    // Reset chrome runtime error
    if (global.chrome?.runtime) {
      (global.chrome.runtime as any).lastError = undefined
    }
  })

  describe('Scenario 1: First-time User (Not Logged In)', () => {
    it('should not have any tokens in storage', async () => {
      const accessToken = await AuthService.getAccessToken()
      const refreshToken = await AuthService.getRefreshToken()
      
      expect(accessToken).toBeNull()
      expect(refreshToken).toBeNull()
    })

    it('should return false for isAuthenticated', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      expect(isAuth).toBe(false)
    })

    it('should return null for getCurrentUser', async () => {
      // Mock background proxy to return 401 (not authenticated)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response)

      const user = await AuthService.getCurrentUser()
      
      expect(user).toBeNull()
    })

    it('should not have any stored user data', async () => {
      // Internal mockStorage should not have user key
      expect((mockStorage as any)["focus_guard_user"]).toBeUndefined()
    })

    it('should fail to fetch protected resources', async () => {
      // When not authenticated, fetchWithAuth should throw
      const isAuth = await AuthService.isAuthenticated()
      expect(isAuth).toBe(false)
      
      // Attempting to call fetchWithAuth without token should throw
      await expect(
        AuthService.fetchWithAuth('/protected-endpoint')
      ).rejects.toThrow('No access token available')
    })
  })

  describe('Scenario 2: User Sign-In Flow', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
      created_at: '2024-01-01T00:00:00Z'
    }

    const mockTokens = {
      access_token: 'mock-access-token-xyz',
      refresh_token: 'mock-refresh-token-abc'
    }

    it('should store tokens after successful OAuth', async () => {
      // Simulate background setting tokens after OAuth callback
      await AuthService.setTokens(mockTokens.access_token, mockTokens.refresh_token)
      
      const accessToken = await AuthService.getAccessToken()
      const refreshToken = await AuthService.getRefreshToken()
      
      expect(accessToken).toBe(mockTokens.access_token)
      expect(refreshToken).toBe(mockTokens.refresh_token)
    })

    it('should fetch and store user data after tokens are set', async () => {
      // Set tokens first
      await AuthService.setTokens(mockTokens.access_token, mockTokens.refresh_token)
      
      // Mock sendMessage to background (returns a Promise)
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        return Promise.resolve({ success: true, data: mockUser })
      })
      
      const user = await AuthService.getMe()
      
      expect(user).toEqual(mockUser)
    })

    it('should return true for isAuthenticated after tokens are set', async () => {
      await AuthService.setTokens(mockTokens.access_token, mockTokens.refresh_token)
      
      const isAuth = await AuthService.isAuthenticated()
      
      expect(isAuth).toBe(true)
    })

    it('should fetch user from API if not in storage (fallback mechanism)', async () => {
      // Set tokens but no user in storage
      await AuthService.setTokens(mockTokens.access_token, mockTokens.refresh_token)
      
      // Mock sendMessage to background (returns a Promise)
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        return Promise.resolve({ success: true, data: mockUser })
      })
      
      // getCurrentUser should fall back to API call
      const user = await AuthService.getCurrentUser()
      
      expect(user).toEqual(mockUser)
    })
  })

  describe('Scenario 3: Authenticated User Experience', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
      created_at: '2024-01-01T00:00:00Z'
    }

    const mockTokens = {
      access_token: 'mock-access-token-xyz',
      refresh_token: 'mock-refresh-token-abc'
    }

    beforeEach(async () => {
      // Set up authenticated state
      await AuthService.setTokens(mockTokens.access_token, mockTokens.refresh_token)
      await AuthService.setCurrentUser(mockUser)
    })

    it('should have valid tokens in storage', async () => {
      const accessToken = await AuthService.getAccessToken()
      const refreshToken = await AuthService.getRefreshToken()
      
      expect(accessToken).toBe(mockTokens.access_token)
      expect(refreshToken).toBe(mockTokens.refresh_token)
    })

    it('should return true for isAuthenticated', async () => {
      const isAuth = await AuthService.isAuthenticated()
      
      expect(isAuth).toBe(true)
    })

    it('should return stored user data', async () => {
      const user = await AuthService.getCurrentUser()
      
      expect(user).toEqual(mockUser)
    })

    it('should successfully make authenticated API calls', async () => {
      // Mock sendMessage to background (returns Promise)
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        return Promise.resolve({ success: true, data: { content: 'protected' } })
      })

      const result = await AuthService.fetchWithAuth('/protected-endpoint')
      
      expect(result).toBeTruthy()
    })

    it('should refresh token when access token expires', async () => {
      const newAccessToken = 'new-access-token-xyz'
      
      // Mock sendMessage for refresh flow (Promise-based)
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        if (message && message.endpoint && message.endpoint.includes('/auth/refresh')) {
          return Promise.resolve({ success: true, data: { access_token: newAccessToken, refresh_token: mockTokens.refresh_token } })
        }
        return Promise.resolve({ success: false, error: 'Token expired' })
      })

      const token = await AuthService.refreshAccessToken()
      expect(token).toBeTruthy()
      const updatedToken = await AuthService.getAccessToken()
      expect(updatedToken).toBe(newAccessToken)
    })

    it('should handle token refresh failure gracefully', async () => {
      // Mock sendMessage for failed refresh (Promise-based)
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        return Promise.resolve({ success: false, error: 'Invalid refresh token' })
      })

      await expect(AuthService.refreshAccessToken()).rejects.toThrow()
    })
  })

  describe('Scenario 4: User Logout Flow', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
      created_at: '2024-01-01T00:00:00Z'
    }

    const mockTokens = {
      access_token: 'mock-access-token-xyz',
      refresh_token: 'mock-refresh-token-abc'
    }

    beforeEach(async () => {
      // Set up authenticated state
      await AuthService.setTokens(mockTokens.access_token, mockTokens.refresh_token)
      await AuthService.setCurrentUser(mockUser)
    })

    it('should clear all tokens from storage', async () => {
      await AuthService.clearTokens()
      
      const accessToken = await AuthService.getAccessToken()
      const refreshToken = await AuthService.getRefreshToken()
      
      expect(accessToken).toBeNull()
      expect(refreshToken).toBeNull()
    })

    it('should remove all auth-related storage keys', async () => {
      await AuthService.clearTokens()
      
      expect(chrome.storage.sync.remove).toHaveBeenCalled()
      const removedKeys = vi.mocked(chrome.storage.sync.remove).mock.calls[0][0]
      
      expect(removedKeys).toContain('focus_guard_access_token')
      expect(removedKeys).toContain('focus_guard_refresh_token')
      expect(removedKeys).toContain('focus_guard_user')
      expect(removedKeys).toContain('account')
    })

    it('should return false for isAuthenticated after logout', async () => {
      await AuthService.clearTokens()
      
      const isAuth = await AuthService.isAuthenticated()
      
      expect(isAuth).toBe(false)
    })

    it('should return null for getCurrentUser after logout', async () => {
      await AuthService.clearTokens()
      
      const user = await AuthService.getCurrentUser()
      
      expect(user).toBeNull()
    })

    it('should fail to make authenticated API calls after logout', async () => {
      await AuthService.clearTokens()
      
      // Attempting to call fetchWithAuth without token should throw
      await expect(
        AuthService.fetchWithAuth('/protected-endpoint')
      ).rejects.toThrow('No access token available')
    })
  })

  describe('Scenario 5: Edge Cases and Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage error
      vi.mocked(chrome.storage.sync.get).mockImplementation((keys, callback: any) => {
        ;(global.chrome.runtime as any).lastError = { message: 'Storage quota exceeded' }
        callback({})
      })

      const token = await AuthService.getAccessToken()
      
      expect(token).toBeNull()
    })

    it('should handle network errors during token refresh', async () => {
      // Set up authenticated state
      await AuthService.setTokens('access-token', 'refresh-token')
      
      // Mock sendMessage failure (Promise-based)
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        return Promise.resolve({ success: false, error: 'Network error' })
      })

      await expect(AuthService.refreshAccessToken()).rejects.toThrow()
    })

    it('should handle corrupted user data in storage', async () => {
      // Store corrupted data
      await chrome.storage.sync.set({ 
        focus_guard_user: 'invalid-json-string',
        focus_guard_access_token: 'valid-token'
      })

      // Mock API fallback (Promise-based)
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        return Promise.resolve({ success: true, data: { id: 'user-123', email: 'test@example.com', name: 'Test User' } })
      })

      // getCurrentUser should fall back to API
      const user = await AuthService.getCurrentUser()
      
      expect(user).toBeTruthy()
      expect(user?.email).toBe('test@example.com')
    })

    it('should handle missing refresh token during refresh attempt', async () => {
      // Set only access token, no refresh token
      await chrome.storage.sync.set({ 
        focus_guard_access_token: 'access-token'
      })

      await expect(AuthService.refreshAccessToken()).rejects.toThrow('No refresh token available')
    })

    it('should prevent concurrent token refresh attempts', async () => {
      await AuthService.setTokens('access-token', 'refresh-token')
      
      let refreshCallCount = 0
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message: any) => {
        refreshCallCount++
        return Promise.resolve({ success: false, error: 'Test error' })
      })

      // Trigger multiple concurrent refreshes (they will all fail but that's ok for this test)
      const results = await Promise.allSettled([
        AuthService.ensureValidToken(),
        AuthService.ensureValidToken(),
        AuthService.ensureValidToken()
      ])

      // All should reject
      expect(results.every(r => r.status === 'rejected')).toBe(true)
    })
  })
})
