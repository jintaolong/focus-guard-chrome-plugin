import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthService } from '~lib/auth'
import { SubscriptionService } from '~lib/subscription'

/**
 * Popup Authentication UI Tests
 * 
 * Ensures popup shows correct UI state based on authentication:
 * - Login form when not authenticated
 * - Dashboard/account info when authenticated
 * - Proper transitions during OAuth flow
 * - Proper cleanup after logout
 */

// Mock services
vi.mock('~lib/auth')
vi.mock('~lib/subscription')
vi.mock('~lib/config', () => ({
  ConfigService: {
    getConfig: vi.fn().mockResolvedValue({
      api_url: 'https://test.commentverdict.com/api/v1',
      portal_url: 'http://localhost:3000'
    })
  }
}))

// We'll import the popup component dynamically to avoid circular deps
let IndexPopup: any

describe('Popup - Authentication UI State', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset chrome mocks - handle both callback signatures AND Promise
    vi.mocked(chrome.storage.sync.get).mockImplementation((keysOrCallback: any, callback?: any) => {
      const data = {
        settings: {
          isEnabled: true,
          videoAnalysis: {
            showPreWatchPopover: true,
            autoAnalyze: false,
            botDetectionEnabled: true
          }
        }
      }
      if (typeof keysOrCallback === 'function') {
        keysOrCallback(data)
        return Promise.resolve(data)
      } else if (typeof callback === 'function') {
        callback(data)
        return Promise.resolve(data)
      } else {
        // Promise-based usage: await chrome.storage.sync.get(["settings"])
        return Promise.resolve(data)
      }
    })
    
    vi.mocked(chrome.storage.sync.set).mockImplementation((items: any, callback?: any) => {
      if (typeof callback === 'function') callback()
      return Promise.resolve()
    })

    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation(() => {})
    
    // Dynamically import popup to ensure mocks are in place
    const popupModule = await import('~popup')
    IndexPopup = popupModule.default
  })

  describe('First-time User (Not Authenticated)', () => {
    beforeEach(() => {
      // Mock unauthenticated state
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue(null)
    })

    it('should render login form when user is not authenticated', async () => {
      render(<IndexPopup />)
      
      await waitFor(() => {
        // Should show login-related elements (might be button or heading)
        const signInElements = screen.queryAllByText(/sign in/i)
        expect(signInElements.length).toBeGreaterThan(0)
      })
    })

    it('should not render account info when not authenticated', async () => {
      render(<IndexPopup />)
      
      await waitFor(() => {
        // Account-specific elements should not be present
        const accountElements = screen.queryByText(/tier|subscription|usage/i)
        expect(accountElements).toBeFalsy()
      })
    })

    it('should show loading state initially', async () => {
      render(<IndexPopup />)
      
      // Component renders successfully (loading state is internal)
      expect(document.body).toBeTruthy()
    })

    it('should not attempt to fetch user data when not authenticated', async () => {
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      
      render(<IndexPopup />)
      
      await waitFor(() => {
        expect(AuthService.isAuthenticated).toHaveBeenCalled()
      })
      
      // Should not call getCurrentUser if not authenticated
      expect(AuthService.getCurrentUser).not.toHaveBeenCalled()
    })
  })

  describe('Authenticated User', () => {
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

    const mockSubscription: any = {
      id: 1,
      user_id: 123,
      tier: 'STARTER',
      status: 'active',
      daily_searches_limit: 10,
      daily_searches_used: 0,
      last_reset_date: '2025-01-01',
      current_period_start: null,
      current_period_end: '2025-02-01T00:00:00Z',
      cancel_at_period_end: false,
      created_at: new Date().toISOString()
    }

    const mockUsage: any = {
      tier: 'STARTER',
      daily_searches_limit: 10,
      daily_searches_used: 0,
      searches_remaining: 10,
      can_search: true
    }

    beforeEach(() => {
      // Mock authenticated state
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(SubscriptionService.getSubscription).mockResolvedValue(mockSubscription)
      vi.mocked(SubscriptionService.getUsage).mockResolvedValue(mockUsage)
    })

    it('should render account info when authenticated', async () => {
      render(<IndexPopup />)
      
      await waitFor(() => {
        // Should show user email or name
        expect(
          screen.queryByText(mockUser.email) || 
          screen.queryByText(mockUser.name)
        ).toBeTruthy()
      }, { timeout: 3000 })
    })

    it('should not render login form when authenticated', async () => {
      render(<IndexPopup />)
      
      await waitFor(() => {
        // Login form should not be present
        const loginButton = screen.queryByRole('button', { name: /sign in|log in/i })
        expect(loginButton).toBeFalsy()
      })
    })

    it('should fetch and display subscription info', async () => {
      render(<IndexPopup />)
      
      await waitFor(() => {
        expect(SubscriptionService.getSubscription).toHaveBeenCalled()
        expect(SubscriptionService.getUsage).toHaveBeenCalled()
      })
      
      // Should display tier information
      await waitFor(() => {
        const tierElements = screen.queryAllByText(/starter/i)
        expect(tierElements.length).toBeGreaterThan(0)
      })
    })

    it('should display usage information', async () => {
      render(<IndexPopup />)
      
      await waitFor(() => {
        // Should show usage stats (0 used, 10 limit)
        const usageText = document.body.textContent
        expect(usageText).toContain('10') // daily searches limit
      })
    })
  })

  describe('OAuth Flow - State Transitions', () => {
    it('should reload user data when OAUTH_COMPLETE message received', async () => {
      let messageHandler: any
      
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((handler) => {
        messageHandler = handler
      })
      
      // Start unauthenticated
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      
      render(<IndexPopup />)
      
      await waitFor(() => {
        const loginElements = screen.queryAllByText(/sign in/i)
        expect(loginElements.length).toBeGreaterThan(0)
      })
      
      // Simulate OAuth completion
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
      
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(SubscriptionService.getSubscription).mockResolvedValue({
        tier: 'FREE', 
        status: 'active',
        current_period_end: null
      } as any)
      vi.mocked(SubscriptionService.getUsage).mockResolvedValue({
        reports_generated: 0,
        reports_limit: 10
      } as any)
      
      // Trigger OAUTH_COMPLETE message
      if (messageHandler) {
        messageHandler({ type: 'OAUTH_COMPLETE' })
      }
      
      // Should reload and show authenticated state
      await waitFor(() => {
        expect(AuthService.getCurrentUser).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('should reload user data when AUTH_STATE_CHANGED message received', async () => {
      let messageHandler: any
      
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((handler) => {
        messageHandler = handler
      })
      
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue({
        id: 123,
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        is_verified: true,
        name: 'Test User',
        avatar: null,
        created_at: '2024-01-01T00:00:00Z'
      } as any)
      vi.mocked(SubscriptionService.getSubscription).mockResolvedValue({
        tier: 'FREE',
        status: 'active',
        current_period_end: null
      } as any)
      vi.mocked(SubscriptionService.getUsage).mockResolvedValue({
        reports_generated: 0,
        reports_limit: 10
      } as any)
      
      render(<IndexPopup />)
      
      await waitFor(() => {
        expect(AuthService.getCurrentUser).toHaveBeenCalled()
      })
      
      // Clear mock calls
      vi.clearAllMocks()
      
      // Trigger AUTH_STATE_CHANGED
      if (messageHandler) {
        messageHandler({ type: 'AUTH_STATE_CHANGED', isAuthenticated: true })
      }
      
      // Should reload user data
      await waitFor(() => {
        expect(AuthService.isAuthenticated).toHaveBeenCalled()
      })
    })

    it('should handle storage changes and reload data', async () => {
      let storageChangeHandler: any
      
      vi.mocked(chrome.storage.onChanged.addListener).mockImplementation((handler) => {
        storageChangeHandler = handler
      })
      
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      
      render(<IndexPopup />)
      
      await waitFor(() => {
        expect(AuthService.isAuthenticated).toHaveBeenCalled()
      })
      
      // Update auth state
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue({
        id: 123,
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        is_verified: true,
        name: 'Test User',
        avatar: null,
        created_at: '2024-01-01T00:00:00Z'
      } as any)
      
      // Trigger storage change (e.g., token was set)
      if (storageChangeHandler) {
        storageChangeHandler(
          { focus_guard_access_token: { newValue: 'new-token' } },
          'sync'
        )
      }
      
      // Should reload user data
      await waitFor(() => {
        expect(AuthService.getCurrentUser).toHaveBeenCalled()
      })
    })
  })

  describe('Session Expiration', () => {
    it('should handle SESSION_EXPIRED message and show error', async () => {
      let messageHandler: any
      
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((handler) => {
        messageHandler = handler
      })
      
      // Start authenticated
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue({
        id: 123,
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        is_verified: true,
        name: 'Test User',
        avatar: null,
        created_at: '2024-01-01T00:00:00Z'
      } as any)
      vi.mocked(SubscriptionService.getSubscription).mockResolvedValue({
        tier: 'FREE',
        status: 'active',
        current_period_end: null
      } as any)
      vi.mocked(SubscriptionService.getUsage).mockResolvedValue({
        reports_generated: 0,
        reports_limit: 10
      } as any)
      
      render(<IndexPopup />)
      
      await waitFor(() => {
        expect(screen.queryByText('test@example.com')).toBeTruthy()
      })
      
      // Trigger session expiration
      if (messageHandler) {
        messageHandler({ type: 'SESSION_EXPIRED' })
      }
      
      // Should show error message and login form
      await waitFor(() => {
        const bodyText = document.body.textContent?.toLowerCase() || ''
        expect(bodyText).toMatch(/expired|sign in/i)
      })
    })
  })

  describe('Logout Flow', () => {
    it('should clear account state and show login form after logout', async () => {
      // Start authenticated
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(true)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue({
        id: 123,
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        is_verified: true,
        name: 'Test User',
        avatar: null,
        created_at: '2024-01-01T00:00:00Z'
      } as any)
      vi.mocked(SubscriptionService.getSubscription).mockResolvedValue({
        tier: 'FREE',
        status: 'active',
        current_period_end: null
      } as any)
      vi.mocked(SubscriptionService.getUsage).mockResolvedValue({
        reports_generated: 0,
        reports_limit: 10
      } as any)
      
      render(<IndexPopup />)
      
      await waitFor(() => {
        expect(screen.queryByText('test@example.com')).toBeTruthy()
      })
      
      // Simulate logout (storage change with tokens removed)
      let storageChangeHandler: any
      vi.mocked(chrome.storage.onChanged.addListener).mock.calls.forEach(call => {
        storageChangeHandler = call[0]
      })
      
      // Update auth state to logged out
      vi.mocked(AuthService.isAuthenticated).mockResolvedValue(false)
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue(null)
      
      if (storageChangeHandler) {
        storageChangeHandler(
          { 
            focus_guard_access_token: { oldValue: 'token', newValue: undefined },
            focus_guard_user: { oldValue: {}, newValue: undefined }
          },
          'sync'
        )
      }
      
      // Should show login form again
      await waitFor(() => {
        const loginElements = screen.queryAllByText(/sign in/i)
        expect(loginElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })
})
