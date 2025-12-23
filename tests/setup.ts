// Test setup file
import { vi } from 'vitest'

// Mock Chrome API with proper callback handling
global.chrome = {
  storage: {
    sync: {
      get: vi.fn((keys, callback) => {
        // Default implementation returns empty object
        if (callback) callback({})
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback()
      }),
      remove: vi.fn((keys, callback) => {
        if (callback) callback()
      })
    },
    local: {
      get: vi.fn((keys, callback) => {
        if (callback) callback({})
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback()
      }),
      remove: vi.fn((keys, callback) => {
        if (callback) callback()
      })
    }
  },
  runtime: {
    lastError: undefined,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    }
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  }
} as any
