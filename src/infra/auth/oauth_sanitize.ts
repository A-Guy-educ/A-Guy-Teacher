/**
 * Return-URL Sanitizer
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Turns an untrusted returnTo parameter into a destination safe to redirect to. Pure — the trust boundary arrives as an argument, never from the environment.
 */

import { isTrustedOrigin, type SharedLoginPolicy } from './shared-login/policy'

declare const safeDestinationBrand: unique symbol

/**
 * A destination that has passed `sanitizeReturnTo`.
 *
 * A plain `string` cannot be assigned to it, so a value can only reach a
 * redirect by going through sanitization once — and code that already holds a
 * `SafeDestination` cannot accidentally re-sanitize it under a weaker policy.
 * That second mistake is not hypothetical: it silently reset every sibling
 * redirect to the home page on the signup path.
 *
 * At runtime this is just the string; the brand exists only for the compiler.
 */
export type SafeDestination = string & { readonly [safeDestinationBrand]: true }

export const SITE_ROOT = '/' as SafeDestination

/**
 * A safe redirect destination derived from an untrusted `returnTo`.
 *
 * Relative paths are always allowed. Absolute URLs are allowed only for apps
 * named by `policy`; anything else — other sites, `javascript:`, protocol-
 * relative `//evil.com` — collapses to the site root. Falling back rather than
 * throwing keeps a tampered link from breaking login.
 *
 * `policy` is a required parameter, never an environment read. This function
 * also runs in the browser, where server variables are invisible: reading one
 * here would quietly evaluate to "trust nothing" and drop legitimate sibling
 * redirects. Requiring it means the compiler asks every caller which trust
 * boundary applies, instead of a default answering wrongly on their behalf.
 */
export function sanitizeReturnTo(
  returnTo: string | undefined | null,
  policy: SharedLoginPolicy,
): SafeDestination {
  const siteRoot = SITE_ROOT
  const trimmed = returnTo?.trim()
  if (!trimmed) return siteRoot

  if (trimmed.startsWith('//') || /^(data|javascript|mailto):/i.test(trimmed)) {
    return siteRoot
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return sanitizeAbsolute(trimmed, policy) ?? siteRoot
  }

  return trimmed.startsWith('/') ? (trimmed as SafeDestination) : siteRoot
}

function sanitizeAbsolute(
  candidate: string,
  policy: SharedLoginPolicy,
): SafeDestination | undefined {
  try {
    const url = new URL(candidate)
    return isTrustedOrigin(url, policy.returnOrigins, policy.cookieDomain)
      ? (url.toString() as SafeDestination)
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
export function returnToPath(returnTo: SafeDestination): string {
  if (!/^https?:\/\//i.test(returnTo)) return returnTo

  try {
    const url = new URL(returnTo)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return returnTo
  }
}
