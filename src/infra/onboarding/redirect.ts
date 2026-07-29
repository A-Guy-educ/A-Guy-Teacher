/**
 * Onboarding Redirect Utility
 *
 * Decides where a newly registered user lands, wrapping their destination in
 * the persona step unless it is redundant. Sanitization happens at the trust
 * boundary, not here — this takes a destination that has already passed it.
 */

import { returnToPath, type SafeDestination } from '@/infra/auth/oauth_sanitize'

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
 * Where to send a user straight after registration.
 *
 * - When `skipPersona` is true (set from the `/start` flow), returns the
 *   destination verbatim — the wizard already collected the persona data, so
 *   wrapping in `/onboarding/persona` would bounce the user into a redundant
 *   step and (on mobile) trigger the cookie-loss round-trip described in #783.
 * - Otherwise, wraps it in the onboarding URL unless it already points there.
 *
 * Takes a `SafeDestination` rather than a raw string on purpose. It used to
 * sanitize internally, which meant the signup form — running in the browser,
 * with no view of the trust policy — re-checked an already-safe sibling URL,
 * rejected it, and silently sent every such user to the home page.
 */
export function getOnboardingRedirect(
  destination: SafeDestination,
  options: { skipPersona?: boolean } = {},
): SafeDestination {
  // Compared by path: a sibling destination is an absolute URL, which a prefix
  // check against the raw value would silently never match.
  if (returnToPath(destination).startsWith(ONBOARDING_PERSONA_PATH)) {
    return destination
  }

  if (options.skipPersona) {
    return destination
  }

  return `${ONBOARDING_PERSONA_PATH}?returnTo=${encodeURIComponent(destination)}` as SafeDestination
}
