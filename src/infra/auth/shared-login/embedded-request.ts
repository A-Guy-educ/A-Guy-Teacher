/**
 * Embedded request detection
 *
 * @fileType utility
 * @domain auth
 * @pattern shared-login
 * @ai-summary Decides whether a request comes from inside a cross-origin iframe, which determines whether the auth cookie can be shared or must be partitioned.
 */

export type ReadableHeaders = { get(name: string): string | null }

/**
 * True when the request originates inside a cross-origin iframe — in practice,
 * the Kody dashboard's preview pane.
 *
 * This single bit decides the cookie's fate. Embedded requests need
 * `SameSite=None` + `Partitioned` or modern browsers drop the cookie entirely;
 * but a partitioned cookie is keyed to the embedding site, so it can never be
 * shared with a sibling app. Getting this wrong in either direction breaks a
 * login flow, which is why it lives in its own tested unit.
 *
 * Three signals, in order of reliability:
 *
 * 1. `Sec-Fetch-Dest: iframe` — an iframe document load. Unambiguous.
 * 2. `Sec-Fetch-Dest: document` — a top-level navigation, so never embedded
 *    even when it arrives cross-site. This is the Google OAuth redirect, which
 *    must stay `SameSite=Lax` (issue #783).
 * 3. Otherwise a subresource request (a server action post, a fetch). It is
 *    embedded when it came from another site.
 *
 * Cross-site is read from `Sec-Fetch-Site` when present, and otherwise by
 * comparing `Origin` to `Host`. That fallback matters: browsers without the
 * Sec-Fetch headers (Safari before 16.4) would otherwise be classed as
 * top-level and lose their cookie inside the preview pane.
 */
export function isEmbeddedRequest(headers: ReadableHeaders): boolean {
  const destination = headers.get('sec-fetch-dest')?.toLowerCase()
  if (destination === 'iframe') return true
  if (destination === 'document') return false

  return isCrossSite(headers)
}

function isCrossSite(headers: ReadableHeaders): boolean {
  const site = headers.get('sec-fetch-site')?.toLowerCase()
  if (site) return site === 'cross-site'

  const originHost = hostOf(headers.get('origin'))
  if (!originHost) return false

  const host = headers.get('host')?.toLowerCase()
  return Boolean(host) && originHost !== host
}

function hostOf(origin: string | null): string | undefined {
  if (!origin) return undefined
  try {
    return new URL(origin).host.toLowerCase()
  } catch {
    return undefined
  }
}
