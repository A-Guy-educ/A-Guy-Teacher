import { describe, expect, it, vi } from 'vitest'

import { resolveHomeRedirect, resolveLandingRedirect } from '@/infra/onboarding/homeRedirect'

describe('resolveHomeRedirect', () => {
  it('sends logged-out users to login', async () => {
    await expect(
      resolveHomeRedirect({
        isAuthenticated: false,
        selectedCourseId: 'any-id',
        resolveCourseSlug: vi.fn(),
      }),
    ).resolves.toBe('/login')

    expect(
      await resolveHomeRedirect({
        isAuthenticated: false,
        selectedCourseId: 'any-id',
      }),
    ).toBe('/login')
  })

  it('sends logged-in users without a selected course to start', async () => {
    await expect(resolveHomeRedirect({ isAuthenticated: true })).resolves.toBe('/start')

    await expect(
      resolveHomeRedirect({ isAuthenticated: true, selectedCourseId: undefined }),
    ).resolves.toBe('/start')

    await expect(
      resolveHomeRedirect({ isAuthenticated: true, selectedCourseId: '   ' }),
    ).resolves.toBe('/start')

    await expect(
      resolveHomeRedirect({ isAuthenticated: true, selectedCourseId: '' }),
    ).resolves.toBe('/start')

    // The resolver must NOT be called when there is no course cookie — empty
    // cookies are cheap and we don't want to add a Mongo round-trip per visit.
    const resolveCourseSlug = vi.fn().mockResolvedValue('algebra-9')
    await resolveHomeRedirect({ isAuthenticated: true, resolveCourseSlug })
    expect(resolveCourseSlug).not.toHaveBeenCalled()
  })

  it('sends logged-in users with a valid course id to /courses/{slug}', async () => {
    const resolveCourseSlug = vi.fn().mockResolvedValue('algebra-9')

    await expect(
      resolveHomeRedirect({
        isAuthenticated: true,
        selectedCourseId: '507f1f77bcf86cd799439011',
        resolveCourseSlug,
      }),
    ).resolves.toBe('/courses/algebra-9')

    expect(resolveCourseSlug).toHaveBeenCalledWith('507f1f77bcf86cd799439011')
  })

  it('sends logged-in users to /start when the resolver returns null (missing/invalid course)', async () => {
    const resolveCourseSlug = vi.fn().mockResolvedValue(null)

    await expect(
      resolveHomeRedirect({
        isAuthenticated: true,
        selectedCourseId: '507f1f77bcf86cd799439099',
        resolveCourseSlug,
      }),
    ).resolves.toBe('/start')

    expect(resolveCourseSlug).toHaveBeenCalledWith('507f1f77bcf86cd799439099')
  })

  it('falls back to /start when no resolver is supplied and a course id is present', async () => {
    await expect(
      resolveHomeRedirect({
        isAuthenticated: true,
        selectedCourseId: '507f1f77bcf86cd799439011',
      }),
    ).resolves.toBe('/start')
  })

  it('trims whitespace around the course id before resolving', async () => {
    const resolveCourseSlug = vi.fn().mockResolvedValue('algebra-9')

    await expect(
      resolveHomeRedirect({
        isAuthenticated: true,
        selectedCourseId: '  507f1f77bcf86cd799439011  ',
        resolveCourseSlug,
      }),
    ).resolves.toBe('/courses/algebra-9')

    expect(resolveCourseSlug).toHaveBeenCalledWith('507f1f77bcf86cd799439011')
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
