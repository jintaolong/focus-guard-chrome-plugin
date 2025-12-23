import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConfigService } from './config'

// Mock fetch
global.fetch = vi.fn()

describe('ConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false
    } as Response)
  })

  it('should return config with fallback values when remote fetch fails', async () => {
    const config = await ConfigService.getConfig()
    
    expect(config).toBeDefined()
    expect(config.api_url).toBeDefined()
    expect(config.portal_url).toBeDefined()
  })

  it('should use remote config when available', async () => {
    const remoteConfig = {
      api_url: 'https://remote.api.com',
      portal_url: 'https://remote.portal.com'
    }
    
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => remoteConfig
    } as Response)
    
    const config = await ConfigService.getConfig()
    
    expect(config.api_url).toBe('https://remote.api.com')
    expect(config.portal_url).toBe('https://remote.portal.com')
  })
})
