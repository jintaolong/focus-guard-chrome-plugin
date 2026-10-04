/**
 * Mendi promo card — state, eligibility and storage.
 *
 * One dismissible card in the POPUP (never injected into youtube.com) that tells the
 * legacy Comment Verdict audience about Mendi. Rules, from the build brief:
 *
 *   - shown only after a verdict has rendered on this device (not on install, not on a
 *     blank popup) — the acceptance test is "the card shows on the second verdict in a
 *     fresh profile", so the floor is MIN_VERDICTS = 2;
 *   - at most MAX_SHOWS times per device, at least MIN_GAP_MS apart, then never again;
 *   - "Not now" (or "Try Mendi") = never again.
 *
 * Storage: `chrome.storage.local`.
 *   mendiPromo         {shown, dismissed, lastShownAt}  — written by the popup only
 *   mendiPromoVerdicts number                           — written by the content script only
 *
 * The verdict counter is a SEPARATE key on purpose: the content script and the popup
 * run in different contexts, and a read-modify-write of one shared object from both
 * sides would race (a verdict completing while the popup is open could wipe `shown`).
 * Each key has exactly one writer.
 */

export const PROMO_STORAGE_KEY = "mendiPromo"
export const VERDICTS_STORAGE_KEY = "mendiPromoVerdicts"

export const MAX_SHOWS = 3
export const MIN_GAP_MS = 48 * 60 * 60 * 1000
export const MIN_VERDICTS = 2

/** Landing URL. The page reads `promo` and shows the code applied on /pricing. */
export const MENDI_PROMO_URL =
  "https://commentverdict.com/?utm_source=legacy_ext&utm_campaign=pilot1&promo=MENDI-PILOT"

export const PROMO_COPY = {
  headline: "The engine behind this verdict now drafts replies on X.",
  body:
    "Meet Mendi. He reads real comments before he writes, shows you the sources, and never posts for you. Six months of the Voice tier free for early users.",
  primary: "Try Mendi",
  secondary: "Not now"
} as const

export interface MendiPromoState {
  /** How many times the card has been shown on this device. */
  shown: number
  /** True once the user tapped Not now or Try Mendi. Never shown again. */
  dismissed: boolean
  /** Epoch ms of the last show, or null before the first. */
  lastShownAt: number | null
}

export const EMPTY_PROMO_STATE: MendiPromoState = { shown: 0, dismissed: false, lastShownAt: null }

/** Coerce whatever is in storage into a well-formed state; garbage reads as "never shown". */
export function normalizePromoState(raw: unknown): MendiPromoState {
  const r = (raw ?? {}) as Partial<Record<keyof MendiPromoState, unknown>>
  const shown = typeof r.shown === "number" && Number.isFinite(r.shown) ? Math.max(0, Math.floor(r.shown)) : 0
  const lastShownAt =
    typeof r.lastShownAt === "number" && Number.isFinite(r.lastShownAt) ? r.lastShownAt : null
  return { shown, dismissed: r.dismissed === true, lastShownAt }
}

/**
 * Pure eligibility check. `verdictsRendered` is the device's verdict count, `now` is
 * injected so the 48-hour gap can be tested without a clock.
 */
export function shouldShowPromo(
  state: MendiPromoState,
  verdictsRendered: number,
  now: number = Date.now()
): boolean {
  if (state.dismissed) return false
  if (state.shown >= MAX_SHOWS) return false
  if (verdictsRendered < MIN_VERDICTS) return false
  if (state.lastShownAt !== null && now - state.lastShownAt < MIN_GAP_MS) return false
  return true
}

export async function readPromoState(): Promise<MendiPromoState> {
  try {
    const result = await chrome.storage.local.get([PROMO_STORAGE_KEY])
    return normalizePromoState(result?.[PROMO_STORAGE_KEY])
  } catch {
    return EMPTY_PROMO_STATE
  }
}

export async function readVerdictsRendered(): Promise<number> {
  try {
    const result = await chrome.storage.local.get([VERDICTS_STORAGE_KEY])
    const n = result?.[VERDICTS_STORAGE_KEY]
    return typeof n === "number" && Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

async function writePromoState(state: MendiPromoState): Promise<void> {
  try {
    await chrome.storage.local.set({ [PROMO_STORAGE_KEY]: state })
  } catch (err) {
    console.warn("MendiPromo: failed to persist state", err)
  }
}

/** Record a show: bumps the counter and stamps the time. Returns the new state. */
export async function markPromoShown(now: number = Date.now()): Promise<MendiPromoState> {
  const current = await readPromoState()
  const next: MendiPromoState = { ...current, shown: current.shown + 1, lastShownAt: now }
  await writePromoState(next)
  return next
}

/** Never again, whichever button got them there. */
export async function markPromoDismissed(): Promise<MendiPromoState> {
  const current = await readPromoState()
  const next: MendiPromoState = { ...current, dismissed: true }
  await writePromoState(next)
  return next
}

// Video ids already counted in this page session. A verdict for the same video can
// reach "complete" more than once (cache hit, re-render, side panel open), and only
// the first one is a verdict the person actually saw for the first time.
const countedVideoIds = new Set<string>()

/**
 * Content-script side: a verdict has just rendered for `videoId`. Increments the
 * device counter once per video per page session. Never throws — this must not be
 * able to break the verdict flow it observes.
 */
export async function recordVerdictRendered(videoId: string | null | undefined): Promise<void> {
  if (!videoId || countedVideoIds.has(videoId)) return
  countedVideoIds.add(videoId)
  try {
    const current = await readVerdictsRendered()
    await chrome.storage.local.set({ [VERDICTS_STORAGE_KEY]: current + 1 })
  } catch (err) {
    console.warn("MendiPromo: failed to record verdict", err)
  }
}

/** Test seam: forget which videos were counted in this session. */
export function _resetCountedVideosForTests(): void {
  countedVideoIds.clear()
}
