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

export type AuthCookieOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'none'
  path: string
  maxAge: number
  partitioned: boolean
  domain?: string
}

/**
 * Hosts whose apex sits on the Public Suffix List (or is otherwise shared
 * between unrelated tenants). Browsers reject `Domain=` cookies there, and we
 * would not want to share a session with a stranger's deployment anyway.
 */
const UNSHAREABLE_SUFFIXES = ['vercel.app', 'fly.dev', 'netlify.app', 'pages.dev']

/**
 * Parent domain the auth cookie is scoped to, e.g. `.a-guy.co.il`, enabling
 * one login across every `*.a-guy.co.il` app.
 *
 * Configure with `AUTH_COOKIE_DOMAIN` (falls back to `ROOT_DOMAIN`, which the
 * locale cookie in `middleware.ts` already uses). Leave it unset — previews,
 * local HTTP dev, single-app deployments — and the cookie stays host-only,
 * exactly as it behaved before subdomain SSO existed.
 *
 * `Domain=.localhost` is rejected by Chromium, so single-label hosts return
 * `undefined`; use a wildcard dev domain such as `.lvh.me` instead.
 */
export function resolveAuthCookieDomain(): string | undefined {
  const raw = (process.env.AUTH_COOKIE_DOMAIN ?? process.env.ROOT_DOMAIN)?.trim()
  if (!raw) return undefined

  const domain = raw.replace(/^\.+/, '').toLowerCase()
  if (!domain.includes('.')) return undefined
  if (UNSHAREABLE_SUFFIXES.some((s) => domain === s || domain.endsWith(`.${s}`))) return undefined

  return `.${domain}`
}

export const AUTH_COOKIE_OPTIONS: AuthCookieOptions = {
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
  const dest = headers.get('sec-fetch-dest')?.toLowerCase()
  if (dest === 'iframe') return true

  // A top-level navigation is never embedded, even when it arrives cross-site —
  // that is exactly the OAuth redirect back from Google, which must stay
  // `SameSite=Lax` (issue #783).
  if (dest === 'document') return false

  // Server actions (login / signup / language change) posted from inside the
  // Kody preview iframe arrive as `sec-fetch-dest: empty` with a cross-site
  // initiator. Without this branch they would be written as a plain Lax cookie
  // and dropped by the browser.
  return headers.get('sec-fetch-site')?.toLowerCase() === 'cross-site'
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
 * `Domain` is attached only to the non-embedded variant: a `Partitioned`
 * cookie is keyed to the embedding top-level site, so it cannot be shared
 * across sibling apps no matter what `Domain` says. Preview-iframe sessions
 * therefore stay app-local by design.
 *
 * Computed at call time so test envs that toggle `NODE_ENV` see the
 * correct production-mode values without a module reset.
 */
export function getAuthCookieOptionsForRequest(headers: {
  get(name: string): string | null
}): AuthCookieOptions {
  const isProd = process.env.NODE_ENV === 'production'
  const iframe = isEmbeddedOAuthContext(headers)
  const embedded = isProd && iframe
  const domain = embedded ? undefined : resolveAuthCookieDomain()

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: embedded ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    partitioned: embedded,
    ...(domain ? { domain } : {}),
  }
}

export const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 10, // 10 minutes - CSRF state expiry
}
