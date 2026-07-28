/**
 * Return-URL Sanitizer
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Turns an untrusted returnTo parameter into a destination safe to redirect to. Pure — the trust boundary arrives as an argument, never from the environment.
 */

import { isTrustedOrigin, SINGLE_APP_POLICY, type SharedLoginPolicy } from './shared-login/policy'

/**
 * A safe redirect destination derived from an untrusted `returnTo`.
 *
 * Relative paths are always allowed. Absolute URLs are allowed only for apps
 * named by `policy`; anything else — other sites, `javascript:`, protocol-
 * relative `//evil.com` — collapses to the site root. Falling back rather than
 * throwing keeps a tampered link from breaking login.
 *
 * `policy` is a parameter, not an environment read, because this function also
 * runs in the browser: a client bundle cannot see server variables, so reading
 * one here would silently evaluate to "trust nothing" and drop legitimate
 * sibling redirects. Client callers pass `SINGLE_APP_POLICY` and get
 * relative-only behaviour, honestly — or better, receive an
 * already-sanitized destination from their server component.
 */
export function sanitizeReturnTo(
  returnTo: string | undefined | null,
  policy: SharedLoginPolicy = SINGLE_APP_POLICY,
): string {
  const siteRoot = '/'
  const trimmed = returnTo?.trim()
  if (!trimmed) return siteRoot

  if (trimmed.startsWith('//') || /^(data|javascript|mailto):/i.test(trimmed)) {
    return siteRoot
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return sanitizeAbsolute(trimmed, policy) ?? siteRoot
  }

  return trimmed.startsWith('/') ? trimmed : siteRoot
}

function sanitizeAbsolute(candidate: string, policy: SharedLoginPolicy): string | undefined {
  try {
    const url = new URL(candidate)
    return isTrustedOrigin(url, policy.returnOrigins, policy.cookieDomain)
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

/**
 * The path part of a sanitized destination, for comparisons that must hold
 * whether the destination is relative or absolute.
 *
 * A redirect-loop guard written as `startsWith('/onboarding')` silently stops
 * working once absolute sibling URLs are permitted; this keeps such checks
 * honest.
 */
export function returnToPath(returnTo: string): string {
  if (!/^https?:\/\//i.test(returnTo)) return returnTo

  try {
    const url = new URL(returnTo)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return returnTo
  }
}
