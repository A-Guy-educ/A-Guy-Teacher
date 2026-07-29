/**
 * CORS for credentialed sibling apps
 *
 * @fileType utility
 * @domain security
 * @pattern shared-login
 * @ai-summary Decides which cross-origin callers may read /api responses with the session cookie attached, and what headers to answer with. Pure — the trust boundary is passed in.
 */

import {
  isTrustedOrigin,
  parseOrigin,
  type SharedLoginPolicy,
} from '@/infra/auth/shared-login/policy'

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization'
const PREFLIGHT_MAX_AGE_SECONDS = '600'

/**
 * The origin to echo back, or `undefined` to answer with no CORS headers at
 * all — which is what makes the browser discard the response.
 *
 * The exact origin is echoed rather than `*` because `*` is invalid alongside
 * `Access-Control-Allow-Credentials`, and credentials are the entire point:
 * these callers are sibling apps forwarding the shared session cookie.
 */
export function resolveAllowedApiOrigin(
  originHeader: string | null,
  policy: SharedLoginPolicy,
): string | undefined {
  const url = parseOrigin(originHeader)
  if (!url) return undefined

  return isTrustedOrigin(url, policy.apiOrigins, policy.cookieDomain) ? originHeader! : undefined
}

/** Headers every allowed cross-origin response carries. */
export function applyCorsHeaders(headers: Headers, allowedOrigin: string): void {
  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.append('Vary', 'Origin')
}

/** Additional headers for the preflight answer. */
export function applyPreflightHeaders(headers: Headers, requestedHeaders: string | null): void {
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS)
  headers.set('Access-Control-Allow-Headers', requestedHeaders ?? DEFAULT_ALLOWED_HEADERS)
  headers.set('Access-Control-Max-Age', PREFLIGHT_MAX_AGE_SECONDS)
}
