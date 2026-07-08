/**
 * OAuth Authentication Constants
 *
 * @fileType constants
 * @domain auth
 * @pattern oauth
 * @ai-summary Cookie configuration and constants for OAuth authentication
 */

import type { Payload } from '@/infra/types/backend'

export function getCookieName(payload: Payload): string {
  return `${payload.config.cookiePrefix}-token`
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Secure only in production (HTTPS required)
  sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const), // 'none' requires secure
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days - match Payload's default token expiration
  // CHIPS — partition the cookie per top-level site when SameSite=None.
  // Without this, modern Chromium browsers (3PC deprecation) block the
  // cookie entirely in cross-origin iframes, which is how the Kody
  // dashboard renders previews. Result: logout / language change in
  // the preview iframe silently no-op'd because we couldn't write
  // back to our own cookie. Partitioned restores the write/read path
  // (the cookie jar is isolated per embedder, which is fine — each
  // embedder logs in once).
  partitioned: process.env.NODE_ENV === 'production',
}

/**
 * True when the request is being made from inside a cross-origin iframe
 * (the Kody dashboard preview iframe use case). Detected via the
 * `Sec-Fetch-Dest` header, which Chromium / Firefox / Safari all send.
 *
 * Top-level OAuth redirects do NOT carry this header value, so this
 * correctly differentiates the iframe case from mobile/desktop browsers
 * that complete OAuth in a top-level window.
 */
export function isEmbeddedOAuthContext(headers: { get(name: string): string | null }): boolean {
  return headers.get('sec-fetch-dest')?.toLowerCase() === 'iframe'
}

/**
 * Returns cookie options suited to the request context.
 *
 * - Production iframe (Kody preview): `SameSite=None` + `Partitioned` so the
 *   cookie survives 3PC deprecation in cross-origin iframes.
 * - Production top-level (mobile OAuth, desktop OAuth): `SameSite=Lax`,
 *   no Partitioned. `Lax` lets the cookie ride the OAuth redirect back to
 *   our origin without the partition-key quirks that drop Partitioned
 *   cookies on iOS Safari and Chrome mobile (issue #783).
 * - Dev: `SameSite=Lax`, no Partitioned.
 *
 * Computed at call time so test envs that toggle `NODE_ENV` see the
 * correct production-mode values without a module reset.
 */
export function getAuthCookieOptionsForRequest(headers: {
  get(name: string): string | null
}): typeof AUTH_COOKIE_OPTIONS {
  const isProd = process.env.NODE_ENV === 'production'
  const iframe = isEmbeddedOAuthContext(headers)

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd && iframe ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    partitioned: isProd && iframe,
  }
}

export const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 10, // 10 minutes - CSRF state expiry
}
