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
const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect"

const MEASUREMENT_ID = process.env.PLASMO_PUBLIC_GA_MEASUREMENT_ID || ""
const API_SECRET = process.env.PLASMO_PUBLIC_GA_API_SECRET || ""

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
 * Background side: deliver one event. Returns true when a request was sent. A
 * missing configuration is a silent no-op, a network failure is logged and swallowed.
 */
export async function deliverEvent(event: AnalyticsEvent): Promise<boolean> {
  if (!isAnalyticsConfigured()) return false
  try {
    const clientId = await getClientId()
    const url = `${MP_ENDPOINT}?measurement_id=${encodeURIComponent(MEASUREMENT_ID)}&api_secret=${encodeURIComponent(API_SECRET)}`
    const body = JSON.stringify({
      client_id: clientId,
      events: [{ name: event.name, params: { ...(event.params ?? {}), surface: "extension_popup" } }]
    })
    // No content-type header on purpose: a text/plain POST needs no CORS preflight, so
    // no new host permission is required (the brief forbids permission changes).
    await fetch(url, { method: "POST", body, keepalive: true })
    return true
  } catch (err) {
    console.warn("Analytics: failed to deliver event", event.name, err)
    return false
  }
}
