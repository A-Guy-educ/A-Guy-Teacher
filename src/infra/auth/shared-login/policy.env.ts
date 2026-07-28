/**
 * Shared Login Policy — environment binding
 *
 * @fileType config
 * @domain auth
 * @pattern shared-login
 * @ai-summary The single place the shared-login environment variables are read. Everything else takes a SharedLoginPolicy as an argument.
 */

import { SINGLE_APP_POLICY, toCookieDomain, type SharedLoginPolicy } from './policy'

function originList(raw: string | undefined): readonly string[] {
  if (!raw) return SINGLE_APP_POLICY.returnOrigins

  return Object.freeze(
    raw
      .split(',')
      .map((origin) => origin.trim().toLowerCase())
      .filter(Boolean),
  )
}

/**
 * Build the policy from the environment.
 *
 * Keeping every `process.env` read here means the rest of the feature is pure
 * and isomorphic, and that turning shared login on or off is one decision made
 * in one place. Deliberately not memoised: tests stub the environment per case,
 * and the cost is three string reads.
 *
 * `ROOT_DOMAIN` is reused rather than introducing a variable of our own — it
 * already scoped the locale cookie in `middleware.ts`, so enabling shared login
 * is one existing switch instead of a new concept.
 *
 * Server-only. Client code must receive the values it needs as props; in the
 * browser these variables do not exist and would silently read as `undefined`.
 */
export function getSharedLoginPolicy(): SharedLoginPolicy {
  const cookieDomain = toCookieDomain(process.env.ROOT_DOMAIN)

  return {
    ...(cookieDomain ? { cookieDomain } : {}),
    returnOrigins: originList(process.env.AUTH_ALLOWED_RETURN_ORIGINS),
    apiOrigins: originList(process.env.API_ALLOWED_ORIGINS),
  }
}
