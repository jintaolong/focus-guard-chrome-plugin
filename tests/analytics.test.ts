import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * GA4 Measurement Protocol sender (lib/analytics.ts). Pins what GA needs to show the
 * promo events at all: a stable random client_id, a session_id that rolls over after
 * 30 minutes, and engagement_time_msec (without the last two, Realtime ignores them).
 * Also: nothing is sent when unconfigured, the send cannot need a host permission,
 * and nothing identifying rides along.
 */

const NOW = 1_800_000_000_000

function installFakeLocalStorage() {
  const store: Record<string, unknown> = {}
  vi.mocked(chrome.storage.local.get).mockImplementation((keys: any) => {
    const list = Array.isArray(keys) ? keys : [keys]
    const out: Record<string, unknown> = {}
    for (const k of list) if (k in store) out[k] = store[k]
    return Promise.resolve(out) as any
  })
  vi.mocked(chrome.storage.local.set).mockImplementation((items: any) => {
    Object.assign(store, items)
    return Promise.resolve() as any
  })
  return store
}

async function load(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return import('~lib/analytics')
}

const KEYS = ['PLASMO_PUBLIC_GA_MEASUREMENT_ID', 'PLASMO_PUBLIC_GA_API_SECRET', 'PLASMO_PUBLIC_GA_DEBUG']
const saved: Record<string, string | undefined> = {}

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of KEYS) saved[k] = process.env[k]
    installFakeLocalStorage()
    global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ validationMessages: [] }) }) as any
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('sends nothing when GA is not configured', async () => {
    const a = await load({ PLASMO_PUBLIC_GA_MEASUREMENT_ID: undefined, PLASMO_PUBLIC_GA_API_SECRET: undefined })
    expect(a.isAnalyticsConfigured()).toBe(false)
    expect(await a.deliverEvent({ name: 'promo_shown' })).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('posts a no-cors event with session_id and engagement_time_msec', async () => {
    const a = await load({ PLASMO_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST', PLASMO_PUBLIC_GA_API_SECRET: 's3cret', PLASMO_PUBLIC_GA_DEBUG: undefined })
    expect(await a.deliverEvent({ name: 'promo_shown', params: { show_number: 1 } })).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(1) // no validation call outside debug mode
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.google-analytics.com/mp/collect?measurement_id=G-TEST&api_secret=s3cret')
    expect(init.mode).toBe('no-cors')
    expect(init.headers).toBeUndefined() // text/plain: no preflight, no host permission
    const body = JSON.parse(init.body as string)
    expect(typeof body.client_id).toBe('string')
    const params = body.events[0].params
    expect(body.events[0].name).toBe('promo_shown')
    expect(params).toMatchObject({ show_number: 1, surface: 'extension_popup', engagement_time_msec: 100 })
    expect(params.session_id).toMatch(/^\d+$/)
    expect(params.debug_mode).toBeUndefined()
    // Nothing identifying: only the protocol's random ids and our own params.
    expect(Object.keys(params).sort()).toEqual(['engagement_time_msec', 'session_id', 'show_number', 'surface'])
    expect(Object.keys(body).sort()).toEqual(['client_id', 'events'])
  })

  it('keeps the client id, and the session id until 30 minutes of silence', async () => {
    const a = await load({ PLASMO_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST', PLASMO_PUBLIC_GA_API_SECRET: 's3cret' })
    const first = await a.buildPayload({ name: 'promo_shown' }, NOW)
    const soon = await a.buildPayload({ name: 'promo_clicked' }, NOW + 5 * 60_000)
    const later = await a.buildPayload({ name: 'promo_dismissed' }, NOW + 5 * 60_000 + a.SESSION_TIMEOUT_MS + 1)
    expect(soon.client_id).toBe(first.client_id)
    expect(later.client_id).toBe(first.client_id)
    expect(soon.events[0].params.session_id).toBe(first.events[0].params.session_id)
    expect(later.events[0].params.session_id).not.toBe(first.events[0].params.session_id)
    expect(first.events[0].params.session_id).toBe(String(Math.floor(NOW / 1000)))
  })

  it('debug mode tags events for DebugView and asks the validation server', async () => {
    const a = await load({ PLASMO_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST', PLASMO_PUBLIC_GA_API_SECRET: 's3cret', PLASMO_PUBLIC_GA_DEBUG: '1' })
    const info = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await a.deliverEvent({ name: 'promo_clicked' })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    const [, sent] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(sent.body as string).events[0].params.debug_mode).toBe(true)
    const [debugUrl] = vi.mocked(global.fetch).mock.calls[1] as [string]
    expect(debugUrl).toContain('/debug/mp/collect')
    expect(info).toHaveBeenCalledWith('[GA debug] validation passed', 'promo_clicked', expect.any(Object))
    info.mockRestore()
  })

  it('a network failure is swallowed, never thrown into the popup', async () => {
    const a = await load({ PLASMO_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST', PLASMO_PUBLIC_GA_API_SECRET: 's3cret', PLASMO_PUBLIC_GA_DEBUG: undefined })
    global.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error('offline'))) as any
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await a.deliverEvent({ name: 'promo_dismissed' })).toBe(false)
    warn.mockRestore()
  })
})
