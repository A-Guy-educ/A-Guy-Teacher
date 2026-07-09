import { describe, expect, it } from 'vitest'

import { getOnboardingRedirect, START_WIZARD_COMPLETED_COOKIE } from '@/infra/onboarding/redirect'

describe('getOnboardingRedirect', () => {
  it('wraps the sanitized returnTo in /onboarding/persona by default', () => {
    expect(getOnboardingRedirect('/courses/algebra')).toBe(
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
    expect(getOnboardingRedirect('/courses/algebra', { skipPersona: true })).toBe(
      '/courses/algebra',
    )
  })

  it('still skips when the returnTo is /onboarding/persona itself (avoids infinite wrap)', () => {
    expect(getOnboardingRedirect('/onboarding/persona?returnTo=/x', { skipPersona: true })).toBe(
      '/onboarding/persona?returnTo=/x',
    )
  })

  it('does not honor skipPersona when it is false', () => {
    expect(getOnboardingRedirect('/courses/algebra', { skipPersona: false })).toBe(
      '/onboarding/persona?returnTo=%2Fcourses%2Falgebra',
    )
  })

  it('uses the default redirect when returnTo is undefined', () => {
    expect(getOnboardingRedirect(undefined)).toBe('/onboarding/persona?returnTo=%2F')
  })

  it('exposes the wizard completion cookie name', () => {
    expect(START_WIZARD_COMPLETED_COOKIE).toBe('start_wizard_completed')
  })
})
