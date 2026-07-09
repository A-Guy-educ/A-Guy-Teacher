/**
 * Onboarding Redirect Utility
 *
 * Constructs the onboarding redirect URL for new users,
 * with returnTo sanitization and loop prevention.
 */

import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'

const ONBOARDING_PERSONA_PATH = '/onboarding/persona'

/**
 * Cookie set by the `/start` wizard when the user completes the
 * teacher / mood / course flow. Its presence means the persona step
 * (which only collects a teacher profile) is redundant: the wizard
 * already collected teacher + mood + course and saved them locally.
 *
 * Server-side readers (OAuth callback) use this to skip the persona
 * wrap and land the new user directly on their selected course.
 */
export const START_WIZARD_COMPLETED_COOKIE = 'start_wizard_completed'

/**
 * Returns the appropriate redirect destination after user registration.
 *
 * - When `skipPersona` is true (set from the `/start` flow), returns the
 *   sanitized returnTo verbatim — the wizard already collected the
 *   persona data, so wrapping in `/onboarding/persona` would bounce the
 *   user into a redundant step and (on mobile) trigger the cookie-loss
 *   round-trip described in #783.
 * - Otherwise, wraps the original returnTo in an onboarding URL unless
 *   it already points to onboarding.
 */
export function getOnboardingRedirect(
  returnTo: string | undefined | null,
  options: { skipPersona?: boolean } = {},
): string {
  const sanitized = sanitizeReturnTo(returnTo)

  if (sanitized.startsWith(ONBOARDING_PERSONA_PATH)) {
    return sanitized
  }

  if (options.skipPersona) {
    return sanitized
  }

  return `${ONBOARDING_PERSONA_PATH}?returnTo=${encodeURIComponent(sanitized)}`
}
