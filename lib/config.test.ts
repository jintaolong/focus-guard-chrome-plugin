import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const OLD_API = process.env.PLASMO_PUBLIC_API_URL
const OLD_PORTAL = process.env.PLASMO_PUBLIC_WEB_PORTAL_URL

beforeEach(() => {
  // set values you expect for the test
  process.env.PLASMO_PUBLIC_API_URL = 'https://api.commentverdict.com/api/v1'
  process.env.PLASMO_PUBLIC_WEB_PORTAL_URL = 'https://app.commentverdict.com'
  // if module reads env at import time, reset modules to force re-import
  vi.resetModules()
})

afterEach(() => {
  // restore original environment
  process.env.PLASMO_PUBLIC_API_URL = OLD_API
  process.env.PLASMO_PUBLIC_WEB_PORTAL_URL = OLD_PORTAL
})

it('should use production config when not in development', async () => {
  const { ConfigService } = await import('./config') // dynamic import respects current env
  const config = await ConfigService.getConfig()
  expect(config.api_url).toBe('https://api.commentverdict.com/api/v1')
  expect(config.portal_url).toBe('https://app.commentverdict.com')
})

