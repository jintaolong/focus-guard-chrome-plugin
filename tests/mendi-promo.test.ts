import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  EMPTY_PROMO_STATE,
  MAX_SHOWS,
  MIN_GAP_MS,
  MIN_VERDICTS,
  PROMO_STORAGE_KEY,
  VERDICTS_STORAGE_KEY,
  MENDI_PROMO_URL,
  _resetCountedVideosForTests,
  isVerdictVisible,
  markPromoDismissed,
  markPromoShown,
  normalizePromoState,
  readPromoState,
  recordVerdictRendered,
  shouldShowPromo,
} from '~lib/mendi-promo'

/**
 * Mendi promo card — the rules from the brief, pinned:
 *   shows at most 3 times per device, at least 48 hours apart, only after a verdict
 *   has rendered (second verdict in a fresh profile), dismiss = never again, state in
 *   chrome.storage.local under mendiPromo: {shown, dismissed, lastShownAt}.
 */

const NOW = 1_800_000_000_000

/** An in-memory chrome.storage.local so the write-through helpers can be checked. */
function installFakeLocalStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial }
  vi.mocked(chrome.storage.local.get).mockImplementation((keys: any) => {
    const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(store)
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

describe('shouldShowPromo — eligibility rules', () => {
  it('never shows before the second verdict on the device', () => {
    expect(shouldShowPromo(EMPTY_PROMO_STATE, 0, NOW)).toBe(false)
    expect(shouldShowPromo(EMPTY_PROMO_STATE, 1, NOW)).toBe(false)
    expect(MIN_VERDICTS).toBe(2)
  })

  it('shows on the second verdict in a fresh profile', () => {
    expect(shouldShowPromo(EMPTY_PROMO_STATE, 2, NOW)).toBe(true)
  })

  it('never shows again once dismissed', () => {
    expect(shouldShowPromo({ shown: 1, dismissed: true, lastShownAt: NOW - 10 * MIN_GAP_MS }, 50, NOW)).toBe(false)
  })

  it('waits at least 48 hours between shows', () => {
    const justShown = { shown: 1, dismissed: false, lastShownAt: NOW - 1000 }
    expect(shouldShowPromo(justShown, 5, NOW)).toBe(false)
    const almost = { shown: 1, dismissed: false, lastShownAt: NOW - MIN_GAP_MS + 1 }
    expect(shouldShowPromo(almost, 5, NOW)).toBe(false)
    const exactly = { shown: 1, dismissed: false, lastShownAt: NOW - MIN_GAP_MS }
    expect(shouldShowPromo(exactly, 5, NOW)).toBe(true)
    expect(MIN_GAP_MS).toBe(48 * 60 * 60 * 1000)
  })

  it('stops after three shows even without a dismiss', () => {
    const longAgo = NOW - 100 * MIN_GAP_MS
    expect(shouldShowPromo({ shown: 2, dismissed: false, lastShownAt: longAgo }, 5, NOW)).toBe(true)
    expect(shouldShowPromo({ shown: 3, dismissed: false, lastShownAt: longAgo }, 5, NOW)).toBe(false)
    expect(MAX_SHOWS).toBe(3)
  })
})

describe('normalizePromoState', () => {
  it('treats missing or corrupt storage as never shown', () => {
    expect(normalizePromoState(undefined)).toEqual(EMPTY_PROMO_STATE)
    expect(normalizePromoState({ shown: 'three', dismissed: 'yes', lastShownAt: 'never' })).toEqual(EMPTY_PROMO_STATE)
  })

  it('keeps well-formed state', () => {
    expect(normalizePromoState({ shown: 2, dismissed: true, lastShownAt: 5 })).toEqual({ shown: 2, dismissed: true, lastShownAt: 5 })
  })
})

describe('storage write-through', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetCountedVideosForTests()
  })

  it('markPromoShown bumps the counter and stamps the time under mendiPromo', async () => {
    const store = installFakeLocalStorage()
    const next = await markPromoShown(NOW)
    expect(next).toEqual({ shown: 1, dismissed: false, lastShownAt: NOW })
    expect(store[PROMO_STORAGE_KEY]).toEqual({ shown: 1, dismissed: false, lastShownAt: NOW })
    await markPromoShown(NOW + 1)
    expect(store[PROMO_STORAGE_KEY]).toEqual({ shown: 2, dismissed: false, lastShownAt: NOW + 1 })
  })

  it('markPromoDismissed sticks across a fresh read (survives restart)', async () => {
    const store = installFakeLocalStorage({ [PROMO_STORAGE_KEY]: { shown: 1, dismissed: false, lastShownAt: NOW } })
    await markPromoDismissed()
    expect(store[PROMO_STORAGE_KEY]).toEqual({ shown: 1, dismissed: true, lastShownAt: NOW })
    // A new popup session reads the same storage back.
    expect(await readPromoState()).toEqual({ shown: 1, dismissed: true, lastShownAt: NOW })
    expect(shouldShowPromo(await readPromoState(), 99, NOW + 10 * MIN_GAP_MS)).toBe(false)
  })

  it('recordVerdictRendered counts each video once per session, under its own key', async () => {
    const store = installFakeLocalStorage()
    await recordVerdictRendered('vid-a')
    await recordVerdictRendered('vid-a') // cache hit / re-render of the same video
    await recordVerdictRendered(null)
    await recordVerdictRendered('vid-b')
    expect(store[VERDICTS_STORAGE_KEY]).toBe(2)
    expect(store[PROMO_STORAGE_KEY]).toBeUndefined() // the content script never touches mendiPromo
  })
})

describe('landing link', () => {
  it('carries the campaign attribution and the promo code, on the marketing site', () => {
    const url = new URL(MENDI_PROMO_URL)
    expect(url.origin).toBe('https://commentverdict.com')
    expect(url.searchParams.get('utm_source')).toBe('legacy_ext')
    expect(url.searchParams.get('utm_campaign')).toBe('pilot1')
    expect(url.searchParams.get('promo')).toBe('MENDI-PILOT')
  })
})

describe('isVerdictVisible — only a verdict on screen counts toward the card', () => {
  const base = { analysisState: 'complete', isCached: false, showCachedVerdict: false, tooltipShown: false }

  it('a fresh completed verdict is visible', () => {
    expect(isVerdictVisible(base)).toBe(true)
  })

  it('a cached analysis stays hidden (toggle idle) unless "show cached verdict" is on', () => {
    expect(isVerdictVisible({ ...base, isCached: true })).toBe(false)
    expect(isVerdictVisible({ ...base, isCached: true, showCachedVerdict: true })).toBe(true)
  })

  it('nothing is visible before the analysis completes', () => {
    expect(isVerdictVisible({ ...base, analysisState: 'analyzing' })).toBe(false)
    expect(isVerdictVisible({ ...base, analysisState: 'idle' })).toBe(false)
  })

  it('the verdict tooltip always shows a verdict', () => {
    expect(isVerdictVisible({ ...base, analysisState: 'idle', isCached: true, tooltipShown: true })).toBe(true)
  })
})

