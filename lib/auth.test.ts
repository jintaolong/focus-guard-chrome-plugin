import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from './auth'

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

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chrome runtime error
    if (global.chrome?.runtime) {
      (global.chrome.runtime as any).lastError = undefined
    }
  })

  describe('getAccessToken', () => {
    it('should return null when no token stored', async () => {
      vi.mocked(chrome.storage.sync.get).mockImplementation((keys, callback: any) => {
        callback({})
      })
      
      const token = await AuthService.getAccessToken()
      
      expect(token).toBeNull()
    })

    it('should return stored access token', async () => {
      const mockToken = 'test-access-token'
      vi.mocked(chrome.storage.sync.get).mockImplementation((keys, callback: any) => {
        callback({ focus_guard_access_token: mockToken })
      })
      
      const token = await AuthService.getAccessToken()
      
      expect(token).toBe(mockToken)
    })
  })

  describe('getRefreshToken', () => {
    it('should return null when no refresh token stored', async () => {
      vi.mocked(chrome.storage.sync.get).mockImplementation((keys, callback: any) => {
        callback({})
      })
      
      const token = await AuthService.getRefreshToken()
      
      expect(token).toBeNull()
    })

    it('should return stored refresh token', async () => {
      const mockToken = 'test-refresh-token'
      vi.mocked(chrome.storage.sync.get).mockImplementation((keys, callback: any) => {
        callback({ focus_guard_refresh_token: mockToken })
      })
      
      const token = await AuthService.getRefreshToken()
      
      expect(token).toBe(mockToken)
    })
  })

  describe('clearTokens', () => {
    it('should remove all auth-related items from storage', async () => {
      vi.mocked(chrome.storage.sync.remove).mockImplementation((keys, callback: any) => {
        if (callback) callback()
      })
      
      await AuthService.clearTokens()
      
      expect(chrome.storage.sync.remove).toHaveBeenCalled()
      const callArgs = vi.mocked(chrome.storage.sync.remove).mock.calls[0][0]
      expect(callArgs).toContain('focus_guard_access_token')
      expect(callArgs).toContain('focus_guard_refresh_token')
    })
  })
})
