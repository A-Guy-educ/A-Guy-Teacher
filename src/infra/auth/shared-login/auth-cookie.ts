/**
 * Auth cookie scoping
 *
 * @fileType model
 * @domain auth
 * @pattern shared-login
 * @ai-summary Builds the auth cookie's attributes from a policy and a request classification. Pure: what the cookie is called and how it is scoped, with no knowledge of sessions, tokens, or the environment.
 */

import type { SharedLoginPolicy } from './policy'

export const AUTH_COOKIE_NAME = 'payload-token'

/** Matches the session lifetime issued in `web-auth.ts`. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export type AuthCookieOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'none'
  path: string
  maxAge: number
  partitioned: boolean
  domain?: string
}

/** Identifies a cookie for deletion: name, path and domain must match the write. */
export type AuthCookieIdentity = {
  name: string
  path: string
  domain?: string
}

export type AuthCookieContext = {
  /** From `isEmbeddedRequest`. Unknown callers should pass `false`. */
  readonly embedded: boolean
  /** HTTPS-only deployment. `SameSite=None` is invalid without it. */
  readonly secure: boolean
}

/**
 * Cookie attributes for a single write.
 *
 * Two mutually exclusive shapes:
 *
 * - **Embedded** — `SameSite=None` + `Partitioned`, and deliberately *no*
 *   `Domain`. A partitioned cookie is keyed to the embedding top-level site,
 *   so it cannot be shared with a sibling app whatever `Domain` claims;
 *   setting one would only imply a sharing that does not happen.
 * - **Top-level** — `SameSite=Lax` plus the shared `Domain` when configured.
 *   This is the variant siblings can read.
 */
export function buildAuthCookieOptions(
  policy: SharedLoginPolicy,
  context: AuthCookieContext,
): AuthCookieOptions {
  const partitioned = context.embedded && context.secure
  const domain = partitioned ? undefined : policy.cookieDomain

  return {
    httpOnly: true,
    secure: context.secure,
    sameSite: partitioned ? 'none' : 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    partitioned,
    ...(domain ? { domain } : {}),
  }
}

/**
 * The cookie to delete on logout.
 *
 * A `Set-Cookie` that omits `Domain` cannot remove a cookie that has one, so
 * logout has to mirror the scope used when writing or the user stays signed in
 * on every sibling app.
 */
export function authCookieIdentity(policy: SharedLoginPolicy): AuthCookieIdentity {
  return {
    name: AUTH_COOKIE_NAME,
    path: '/',
    ...(policy.cookieDomain ? { domain: policy.cookieDomain } : {}),
  }
}

/**
 * Every `Set-Cookie` needed to be sure the session cookie is gone.
 *
 * More than one is required because the same name may exist under different
 * scopes at once: a host-only cookie from before shared login was enabled, a
 * partitioned one written inside the preview iframe, and the domain-scoped one.
 * Browsers treat them as distinct cookies, so each needs its own clear.
 */
export function authCookieClearHeaders(policy: SharedLoginPolicy, secure: boolean): string[] {
  const base = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
  ]
  const sameSite = `SameSite=${secure ? 'None' : 'Lax'}`

  const headers = [[...base, sameSite].join('; ')]

  if (secure) {
    headers.push([...base, 'SameSite=None', 'Partitioned'].join('; '))
  }

  if (policy.cookieDomain) {
    headers.push([...base, `Domain=${policy.cookieDomain}`, sameSite].join('; '))
  }

  return headers
}
