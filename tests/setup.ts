// Test setup file
import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Mock Chrome API with proper callback and Promise handling
global.chrome = {
  storage: {
    sync: {
      get: vi.fn((keysOrCallback: any, callback?: any) => {
        const defaultData = {
          settings: {
            isEnabled: true,
            videoAnalysis: {
              showPreWatchPopover: true,
              autoAnalyze: false,
              botDetectionEnabled: true
            }
          }
        }
        
        // Support both signatures: get(callback), get(keys, callback), and get(keys) -> Promise
        if (typeof keysOrCallback === 'function') {
          keysOrCallback(defaultData)
          return Promise.resolve(defaultData)
        } else if (typeof callback === 'function') {
          callback(defaultData)
          return Promise.resolve(defaultData)
        } else {
          // Promise-based usage: await chrome.storage.sync.get(["settings"])
          return Promise.resolve(defaultData)
        }
      }),
      set: vi.fn((items: any, callback?: any) => {
        if (typeof callback === 'function') callback()
        return Promise.resolve()
      }),
      remove: vi.fn((keys: any, callback?: any) => {
        if (typeof callback === 'function') callback()
        return Promise.resolve()
      })
    },
    local: {
      get: vi.fn((keysOrCallback: any, callback?: any) => {
        const defaultData = {}
        if (typeof keysOrCallback === 'function') {
          keysOrCallback(defaultData)
          return Promise.resolve(defaultData)
        } else if (typeof callback === 'function') {
          callback(defaultData)
          return Promise.resolve(defaultData)
        } else {
          return Promise.resolve(defaultData)
        }
      }),
      set: vi.fn((items: any, callback?: any) => {
        if (typeof callback === 'function') callback()
        return Promise.resolve()
      }),
      remove: vi.fn((keys: any, callback?: any) => {
        if (typeof callback === 'function') callback()
        return Promise.resolve()
      })
    }
  },
  runtime: {
    id: 'test-extension-id',
    lastError: undefined,
    sendMessage: vi.fn(async (message: any) => {
      // Default test behavior: if global.fetch is mocked, forward the request
      try {
        if (typeof global.fetch === 'function' && message && message.endpoint) {
          const url = (process.env.PLASMO_PUBLIC_API_URL || 'https://api.commentverdict.com/api/v1') + message.endpoint
          const res = await (global.fetch as any)(url, message.options || {})
          const data = await (res && typeof res.json === 'function' ? res.json().catch(() => null) : Promise.resolve(null))
          return { success: true, data, ok: res?.ok, status: res?.status }
        }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
      }
      return { success: false, error: 'No handler for sendMessage in test' }
    }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  }
} as any

// Ensure storage.onChanged exists for tests that add listeners
global.chrome.storage.onChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
  hasListener: vi.fn(() => false),
  hasListeners: vi.fn(() => false),
  addRules: vi.fn(),
  getRules: vi.fn(),
  removeRules: vi.fn()
}

// Add runtime.getURL helper used by UI components
global.chrome.runtime.getURL = vi.fn((path: string) => `/${path}`)
