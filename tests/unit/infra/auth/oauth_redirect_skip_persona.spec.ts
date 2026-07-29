import { describe, expect, it } from 'vitest'

import { SITE_ROOT, type SafeDestination } from '@/infra/auth/oauth_sanitize'
import { getOnboardingRedirect, START_WIZARD_COMPLETED_COOKIE } from '@/infra/onboarding/redirect'

/** Stands in for a value that has already passed `sanitizeReturnTo`. */
const safe = (destination: string) => destination as SafeDestination

describe('getOnboardingRedirect', () => {
  it('wraps the sanitized returnTo in /onboarding/persona by default', () => {
    expect(getOnboardingRedirect(safe('/courses/algebra'))).toBe(
      '/onboarding/persona?returnTo=%2Fcourses%2Falgebra',
    )
  })

  it('returns the sanitized returnTo verbatim when skipPersona is true (start wizard completed)', () => {
    // Bug #783: the /start wizard already collected teacher / mood / course.
    // Wrapping in /onboarding/persona would bounce new users through a
    // redundant step whose server-side auth check (lines 15-19 of
    // /onboarding/persona/page.tsx) can fire `redirect('/signup')` if the
    // freshly-set auth cookie isn't readable on the immediate follow-up
    // request — producing the "second login popup" symptom.
    expect(getOnboardingRedirect(safe('/courses/algebra'), { skipPersona: true })).toBe(
      '/courses/algebra',
    )
  })

  it('still skips when the returnTo is /onboarding/persona itself (avoids infinite wrap)', () => {
    expect(
      getOnboardingRedirect(safe('/onboarding/persona?returnTo=/x'), { skipPersona: true }),
    ).toBe('/onboarding/persona?returnTo=/x')
  })

  it('does not honor skipPersona when it is false', () => {
    expect(getOnboardingRedirect(safe('/courses/algebra'), { skipPersona: false })).toBe(
      '/onboarding/persona?returnTo=%2Fcourses%2Falgebra',
    )
  })

  it('wraps the site root when there was no destination to return to', () => {
    expect(getOnboardingRedirect(SITE_ROOT)).toBe('/onboarding/persona?returnTo=%2F')
  })

  it('leaves an already-safe sibling destination intact', () => {
    // Regression: this used to be re-sanitized inside, under the browser's
    // empty policy, which reset it to the home page.
    expect(getOnboardingRedirect(safe('https://app2.a-guy.co.il/dashboard'))).toBe(
      '/onboarding/persona?returnTo=https%3A%2F%2Fapp2.a-guy.co.il%2Fdashboard',
    )
  })

  it('does not double-wrap an absolute sibling URL already pointing at onboarding', () => {
    expect(
      getOnboardingRedirect(safe('https://app2.a-guy.co.il/onboarding/persona?returnTo=/x')),
    ).toBe('https://app2.a-guy.co.il/onboarding/persona?returnTo=/x')
  })

  it('exposes the wizard completion cookie name', () => {
    expect(START_WIZARD_COMPLETED_COOKIE).toBe('start_wizard_completed')
  })
})
