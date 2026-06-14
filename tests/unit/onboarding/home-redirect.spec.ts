import { describe, expect, it } from 'vitest'

import { resolveHomeRedirect, resolveLandingRedirect } from '@/infra/onboarding/homeRedirect'

describe('resolveHomeRedirect', () => {
  it('sends logged-out users to login', () => {
    expect(resolveHomeRedirect({ isAuthenticated: false, selectedCourseId: 'course-1' })).toBe(
      '/login',
    )
  })

  it('sends logged-in users without a selected course to start', () => {
    expect(resolveHomeRedirect({ isAuthenticated: true })).toBe('/start')
    expect(resolveHomeRedirect({ isAuthenticated: true, selectedCourseId: '   ' })).toBe('/start')
  })

  it('sends logged-in users with a selected course to study', () => {
    expect(resolveHomeRedirect({ isAuthenticated: true, selectedCourseId: 'course-1' })).toBe(
      '/study',
    )
  })
})

describe('resolveLandingRedirect', () => {
  it('keeps logged-out users on the landing page', () => {
    expect(resolveLandingRedirect(false)).toBeNull()
  })

  it('sends logged-in users to home', () => {
    expect(resolveLandingRedirect(true)).toBe('/home')
  })
})
