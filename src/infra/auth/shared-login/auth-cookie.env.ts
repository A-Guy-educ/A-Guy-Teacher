/**
 * Auth cookie scoping — environment binding
 *
 * @fileType utility
 * @domain auth
 * @pattern shared-login
 * @ai-summary Wires the pure cookie model to this deployment's policy and to an incoming request. The only auth-cookie module that reads the environment.
 */

import {
  authCookieClearHeaders,
  authCookieIdentity,
  buildAuthCookieOptions,
  type AuthCookieIdentity,
  type AuthCookieOptions,
} from './auth-cookie'
import { isEmbeddedRequest, type ReadableHeaders } from './embedded-request'
import { getSharedLoginPolicy } from './policy.env'

function isSecureDeployment(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Cookie attributes for writing the session cookie on this request.
 *
 * Callers without request headers — server actions invoked outside a request
 * scope, tests — get the top-level variant, which is the shareable one. That
 * default is deliberate: defaulting to the partitioned variant would silently
 * produce a cookie no sibling app can read.
 */
export function authCookieOptionsFor(headers?: ReadableHeaders): AuthCookieOptions {
  return buildAuthCookieOptions(getSharedLoginPolicy(), {
    embedded: headers ? isEmbeddedRequest(headers) : false,
    secure: isSecureDeployment(),
  })
}

/** Name, path and domain identifying the cookie to remove from a cookie store. */
export function authCookieDeleteOptions(): AuthCookieIdentity {
  return authCookieIdentity(getSharedLoginPolicy())
}

/** Append every `Set-Cookie` needed to clear the session cookie in all its scopes. */
export function appendAuthCookieClearHeaders(headers: Headers): void {
  for (const cookie of authCookieClearHeaders(getSharedLoginPolicy(), isSecureDeployment())) {
    headers.append('Set-Cookie', cookie)
  }
}
