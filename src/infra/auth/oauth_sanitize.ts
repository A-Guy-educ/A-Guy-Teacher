/**
 * OAuth URL Sanitizer
 *
 * @fileType utility
 * @domain oauth
 * @pattern oauth
 * @ai-summary Sanitize returnTo URLs to prevent open redirect vulnerabilities. Relative paths are always allowed; absolute URLs only for sibling apps on the shared-login domain.
 */

import { resolveAuthCookieDomain } from './oauth_constants'

/**
 * Origins allowed as absolute `returnTo` targets, on top of the sibling
 * subdomains implied by `ROOT_DOMAIN`.
 *
 * Comma-separated, exact origins including scheme and any port, e.g.
 * `AUTH_ALLOWED_RETURN_ORIGINS=https://labs.a-guy.co.il,http://app2.lvh.me:3001`.
 * Needed for local development, where the sibling rule requires HTTPS.
 */
function explicitAllowedOrigins(): string[] {
  return (process.env.AUTH_ALLOWED_RETURN_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * True when `url` points at an app that already shares our login cookie.
 *
 * Sibling apps are matched against the configured cookie domain rather than a
 * hardcoded list, so a new subdomain inherits the permission automatically —
 * it can read the session cookie anyway, so redirecting to it grants nothing
 * extra. HTTPS is required because the shared cookie is `Secure`.
 */
function isAllowedReturnOrigin(url: URL): boolean {
  const origin = url.origin.toLowerCase()
  if (explicitAllowedOrigins().includes(origin)) return true

  if (url.protocol !== 'https:') return false

  const cookieDomain = resolveAuthCookieDomain()
  if (!cookieDomain) return false

  const host = url.hostname.toLowerCase()
  return host === cookieDomain.slice(1) || host.endsWith(cookieDomain)
}

export function sanitizeReturnTo(returnTo: string | undefined | null): string {
  const defaultRedirect = '/'
  if (!returnTo) return defaultRedirect

  const trimmed = returnTo.trim()

  if (trimmed.startsWith('//') || trimmed.match(/^(data|javascript|mailto):/i)) {
    return defaultRedirect
  }

  // Absolute URL: only sibling apps on the shared-login domain. Anything else
  // is an open redirect, so it falls back to our own root.
  if (trimmed.match(/^https?:\/\//i)) {
    try {
      const url = new URL(trimmed)
      return isAllowedReturnOrigin(url) ? url.toString() : defaultRedirect
    } catch {
      return defaultRedirect
    }
  }

  if (!trimmed.startsWith('/')) return defaultRedirect

  return trimmed
}
