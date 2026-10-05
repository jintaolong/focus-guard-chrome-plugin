/**
 * Product analytics for the extension — Google Analytics 4 Measurement Protocol.
 *
 * The marketing site already reports to a GA4 property (web-portal
 * components/analytics/GoogleAnalytics.tsx, NEXT_PUBLIC_GA_ID). Extension pages cannot
 * load gtag.js (MV3 content security policy), so events go to the same property over
 * the Measurement Protocol instead — the route Google documents for extensions. Point
 * PLASMO_PUBLIC_GA_MEASUREMENT_ID at that property and PLASMO_PUBLIC_GA_API_SECRET at
 * a Measurement Protocol secret created under its data stream. With either unset,
 * every call is a no-op, so dev and test builds never write into the live property.
 *
 * Nothing identifying is sent: no email, no account id, no video id, no URL. The only
 * per-device value is `client_id`, which the protocol requires. It is a random string
 * generated on first use and kept in chrome.storage.local; it is never derived from
 * or stored next to the account.
 *
 * Transport: the popup sends the event to the background service worker, which does
 * the fetch. Opening a tab closes the popup and would abort an in-flight request from
 * it; the worker outlives the click.
 */

export type AnalyticsEventName = "promo_shown" | "promo_clicked" | "promo_dismissed"

export interface AnalyticsEvent {
  name: AnalyticsEventName
  params?: Record<string, string | number | boolean>
}

export const TRACK_EVENT_MESSAGE = "TRACK_EVENT"
const CLIENT_ID_KEY = "analyticsClientId"
const SESSION_KEY = "analyticsSession"
const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect"
const MP_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect"
/** GA's own session timeout: a gap longer than this starts a new session. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000

const MEASUREMENT_ID = process.env.PLASMO_PUBLIC_GA_MEASUREMENT_ID || ""
const API_SECRET = process.env.PLASMO_PUBLIC_GA_API_SECRET || ""
/**
 * Testing aid, never set in the release workflow. When "1": every event carries
 * debug_mode (so it shows in GA4 → Admin → DebugView) and is also sent to the
 * validation server, whose verdict is logged in the service worker console. The
 * real endpoint answers 2xx to anything, malformed or not, so this is the only way
 * to see a payload problem.
 */
const DEBUG = process.env.PLASMO_PUBLIC_GA_DEBUG === "1"

export function isAnalyticsConfigured(): boolean {
  return Boolean(MEASUREMENT_ID && API_SECRET)
}

/** Popup / UI side: hand the event to the background worker. Never throws. */
export function trackEvent(name: AnalyticsEventName, params?: AnalyticsEvent["params"]): void {
  try {
    const event: AnalyticsEvent = { name, params }
    const maybePromise = chrome.runtime.sendMessage({ type: TRACK_EVENT_MESSAGE, event })
    if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === "function") {
      ;(maybePromise as Promise<unknown>).catch(() => {})
    }
  } catch {
    // Analytics must never break the UI.
  }
}

async function getClientId(): Promise<string> {
  const stored = await chrome.storage.local.get([CLIENT_ID_KEY])
  const existing = stored?.[CLIENT_ID_KEY]
  if (typeof existing === "string" && existing.length > 0) return existing
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}.${Math.floor(Math.random() * 1e9)}`
  await chrome.storage.local.set({ [CLIENT_ID_KEY]: fresh })
  return fresh
}

/**
 * GA4 only shows Measurement Protocol activity in Realtime (and attributes it to a
 * session at all) when each event carries `session_id` and `engagement_time_msec`.
 * The session id is GA's usual shape, the start time in seconds, and rolls over after
 * SESSION_TIMEOUT_MS without an event. Kept in chrome.storage.local next to the
 * client id; neither is tied to the account.
 */
async function getSessionId(now: number = Date.now()): Promise<string> {
  const stored = await chrome.storage.local.get([SESSION_KEY])
  const s = stored?.[SESSION_KEY] as { id?: string; lastAt?: number } | undefined
  const id =
    s && typeof s.id === "string" && typeof s.lastAt === "number" && now - s.lastAt < SESSION_TIMEOUT_MS
      ? s.id
      : String(Math.floor(now / 1000))
  await chrome.storage.local.set({ [SESSION_KEY]: { id, lastAt: now } })
  return id
}

/** The request body for one event. Exported for tests. */
export async function buildPayload(event: AnalyticsEvent, now: number = Date.now()) {
  const [clientId, sessionId] = await Promise.all([getClientId(), getSessionId(now)])
  return {
    client_id: clientId,
    events: [
      {
        name: event.name,
        params: {
          ...(event.params ?? {}),
          surface: "extension_popup",
          session_id: sessionId,
          // The popup has no engagement timer; a nominal value is what Google's own
          // examples use, and it is what makes the event count as user activity.
          engagement_time_msec: 100,
          ...(DEBUG ? { debug_mode: true } : {})
        }
      }
    ]
  }
}

/**
 * Debug mode only: ask GA's validation server about this payload and log the answer.
 * Uses console.warn on purpose: initConsole() mutes log/info/debug in every
 * `plasmo build` (NODE_ENV is always production there), and warn is the level it keeps.
 */
async function logValidation(name: string, body: string): Promise<void> {
  try {
    const res = await fetch(endpoint(MP_DEBUG_ENDPOINT), { method: "POST", body })
    const verdict = await res.json()
    const messages = verdict?.validationMessages ?? []
    if (messages.length) console.warn("[GA debug] validation FAILED", name, messages)
    else console.warn("[GA debug] validation passed", name, JSON.parse(body))
  } catch {
    // The validation response may be unreadable without a host permission. Print the
    // payload so it can be checked by hand against /debug/mp/collect with curl.
    console.warn("[GA debug] sent", name, "- validate by hand:", body)
  }
}

function endpoint(base: string): string {
  return `${base}?measurement_id=${encodeURIComponent(MEASUREMENT_ID)}&api_secret=${encodeURIComponent(API_SECRET)}`
}

/**
 * Background side: deliver one event. Returns true when a request was sent. A
 * missing configuration is a silent no-op, a network failure is logged and swallowed.
 */
export async function deliverEvent(event: AnalyticsEvent): Promise<boolean> {
  if (!isAnalyticsConfigured()) {
    // Silent in release builds by design; in debug mode say why nothing was sent.
    if (DEBUG) console.warn("[GA debug] not sent", event.name, "- set PLASMO_PUBLIC_GA_MEASUREMENT_ID and PLASMO_PUBLIC_GA_API_SECRET")
    return false
  }
  try {
    const body = JSON.stringify(await buildPayload(event))
    // The extension has no host permission for google-analytics.com (the brief forbids
    // permission changes), so CORS applies. A no-cors text/plain POST is still
    // delivered; its response is opaque, which is fine for fire-and-forget.
    await fetch(endpoint(MP_ENDPOINT), { method: "POST", body, keepalive: true, mode: "no-cors" })
    if (DEBUG) await logValidation(event.name, body)
    return true
  } catch (err) {
    console.warn("Analytics: failed to deliver event", event.name, err)
    return false
  }
}
