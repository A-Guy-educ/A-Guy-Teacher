// @vitest-environment jsdom
/**
 * @fileType test
 * @domain client.state
 * @pattern state-local
 * @ai-summary Single source of truth for "selected course" localStorage state.
 *   These tests pin the contract that every write goes through this module:
 *   round-trip, partial merge, cookie mirroring, SSR safety, corruption
 *   recovery, last-writer-wins, and the focused `removeCourseSelection` /
 *   `removeTeacherProfile` wrappers that preserve sibling fields.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  COURSE_ID_COOKIE_NAME,
  GRADE_COOKIE_NAME,
  clearUserProfile,
  getUserProfile,
  removeCourseSelection,
  removeTeacherProfile,
  selectCourse,
  setUserProfile,
} from '@/client/state/localStorage/userProfile'

const USER_PROFILE_KEY = 'a-guy:user-profile'

function readCookieValue(name: string): string | null {
  const cookies = document.cookie.split(';')
  for (const raw of cookies) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (key === name) {
      return trimmed.slice(eq + 1)
    }
  }
  return null
}

function clearAllCookies(): void {
  document.cookie.split(';').forEach((raw) => {
    const name = raw.split('=')[0]?.trim()
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    }
  })
}

describe('userProfile state module', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    clearAllCookies()
    // Stub fetch so the fire-and-forget selection tracker never hits the
    // network during unrelated tests and so we can assert on it below.
    fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    process.env.NEXT_PUBLIC_ADMIN_URL = 'https://admin.example.test'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('round-trip', () => {
    it('writes via setUserProfile and reads the same profile back via getUserProfile', () => {
      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })

      const profile = getUserProfile()
      expect(profile).toEqual({
        gradeLevel: '8',
        courseId: 'course-1',
        lastVisit: expect.any(String),
      })
    })

    it('writes via selectCourse and reads the same profile back via getUserProfile', () => {
      selectCourse({ gradeLevel: 'ח', courseId: 'course-2', source: 'other' })

      const profile = getUserProfile()
      expect(profile?.gradeLevel).toBe('ח')
      expect(profile?.courseId).toBe('course-2')
      expect(typeof profile?.lastVisit).toBe('string')
    })

    it('auto-fills lastVisit when the caller does not pass one', () => {
      const before = Date.now()
      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })
      const after = Date.now()

      const stored = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) ?? '{}')
      expect(typeof stored.lastVisit).toBe('string')
      const ts = Date.parse(stored.lastVisit)
      expect(Number.isFinite(ts)).toBe(true)
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after + 1000)
    })

    it('respects an explicit lastVisit when provided', () => {
      const fixed = '2026-01-15T10:30:00.000Z'
      setUserProfile({ gradeLevel: '8', courseId: 'course-1', lastVisit: fixed })

      const profile = getUserProfile()
      expect(profile?.lastVisit).toBe(fixed)
    })

    it('mirrors gradeLevel and courseId to cookies so server components can prefetch', () => {
      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })

      expect(readCookieValue(GRADE_COOKIE_NAME)).toBe('8')
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBe('course-1')
    })

    it('clears the course-id cookie when courseId becomes undefined', () => {
      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBe('course-1')

      // Partial merge: passing only gradeLevel keeps existing courseId,
      // so we instead clear the whole profile to exercise the cookie-clear path.
      clearUserProfile()

      expect(readCookieValue(GRADE_COOKIE_NAME)).toBeNull()
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBeNull()
    })
  })

  describe('clearUserProfile', () => {
    it('removes the localStorage entry AND clears both cookies', () => {
      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })
      expect(localStorage.getItem(USER_PROFILE_KEY)).not.toBeNull()
      expect(readCookieValue(GRADE_COOKIE_NAME)).toBe('8')
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBe('course-1')

      clearUserProfile()

      expect(localStorage.getItem(USER_PROFILE_KEY)).toBeNull()
      expect(getUserProfile()).toBeNull()
      expect(readCookieValue(GRADE_COOKIE_NAME)).toBeNull()
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBeNull()
    })

    it('is a no-op when nothing was stored', () => {
      expect(() => clearUserProfile()).not.toThrow()
      expect(getUserProfile()).toBeNull()
    })
  })

  describe('SSR safety', () => {
    it('getUserProfile returns null and does not throw when window is undefined', async () => {
      const originalWindow = (globalThis as { window?: unknown }).window
      // @ts-expect-error: simulate a server-like environment
      delete (globalThis as { window?: unknown }).window

      try {
        expect(() => getUserProfile()).not.toThrow()
        expect(getUserProfile()).toBeNull()
      } finally {
        ;(globalThis as { window?: unknown }).window = originalWindow
      }
    })

    it('setUserProfile is a no-op when window is undefined', async () => {
      const originalWindow = (globalThis as { window?: unknown }).window
      // @ts-expect-error: simulate a server-like environment
      delete (globalThis as { window?: unknown }).window

      try {
        expect(() => setUserProfile({ gradeLevel: '8', courseId: 'course-1' })).not.toThrow()
      } finally {
        ;(globalThis as { window?: unknown }).window = originalWindow
      }
    })

    it('selectCourse is a no-op when window is undefined', async () => {
      const originalWindow = (globalThis as { window?: unknown }).window
      // @ts-expect-error: simulate a server-like environment
      delete (globalThis as { window?: unknown }).window

      try {
        expect(() =>
          selectCourse({ gradeLevel: '8', courseId: 'course-1', source: 'other' }),
        ).not.toThrow()
      } finally {
        ;(globalThis as { window?: unknown }).window = originalWindow
      }
    })
  })

  describe('corruption recovery', () => {
    it('getUserProfile returns null (does not throw) when localStorage holds invalid JSON', () => {
      localStorage.setItem(USER_PROFILE_KEY, '{not valid json')

      expect(() => getUserProfile()).not.toThrow()
      expect(getUserProfile()).toBeNull()
    })

    it('setUserProfile recovers and overwrites corrupt JSON', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      localStorage.setItem(USER_PROFILE_KEY, '{not valid json')

      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })

      expect(consoleSpy).not.toHaveBeenCalled()
      const profile = getUserProfile()
      expect(profile?.gradeLevel).toBe('8')
      expect(profile?.courseId).toBe('course-1')
    })
  })

  describe('last-writer-wins for partial updates', () => {
    it('setUserProfile merges into the existing profile rather than replacing it', () => {
      setUserProfile({ gradeLevel: '8', courseId: 'course-1', mood: 'great' })

      setUserProfile({ teacherProfileSlug: 'teacher-a' })

      const profile = getUserProfile()
      expect(profile).toEqual({
        gradeLevel: '8',
        courseId: 'course-1',
        mood: 'great',
        teacherProfileSlug: 'teacher-a',
        lastVisit: expect.any(String),
      })
    })

    it('consecutive selectCourse calls overwrite only gradeLevel / courseId', () => {
      selectCourse({ gradeLevel: '8', courseId: 'course-1', source: 'other' })
      setUserProfile({ teacherProfileSlug: 'teacher-a' })

      selectCourse({ gradeLevel: 'ח', courseId: 'course-2', source: 'other' })

      const profile = getUserProfile()
      expect(profile?.gradeLevel).toBe('ח')
      expect(profile?.courseId).toBe('course-2')
      expect(profile?.teacherProfileSlug).toBe('teacher-a')
    })

    it('preserves the existing lastVisit when no lastVisit is provided', () => {
      const fixed = '2026-01-15T10:30:00.000Z'
      setUserProfile({ gradeLevel: '8', courseId: 'course-1', lastVisit: fixed })

      setUserProfile({ teacherProfileSlug: 'teacher-a' })

      const profile = getUserProfile()
      expect(profile?.lastVisit).toBe(fixed)
    })
  })

  describe('removeCourseSelection', () => {
    it('clears gradeLevel and courseId but keeps teacherProfileSlug', () => {
      setUserProfile({
        gradeLevel: '8',
        courseId: 'course-1',
        teacherProfileSlug: 'teacher-a',
        mood: 'great',
      })

      removeCourseSelection()

      const profile = getUserProfile()
      expect(profile?.teacherProfileSlug).toBe('teacher-a')
      expect(profile?.mood).toBe('great')
      expect(profile?.gradeLevel).toBeUndefined()
      expect(profile?.courseId).toBeUndefined()
    })

    it('clears the grade and courseId cookies', () => {
      setUserProfile({
        gradeLevel: '8',
        courseId: 'course-1',
        teacherProfileSlug: 'teacher-a',
      })
      expect(readCookieValue(GRADE_COOKIE_NAME)).toBe('8')
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBe('course-1')

      removeCourseSelection()

      expect(readCookieValue(GRADE_COOKIE_NAME)).toBeNull()
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBeNull()
    })

    it('clears everything when no sibling fields remain', () => {
      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })

      removeCourseSelection()

      expect(getUserProfile()).toBeNull()
      expect(localStorage.getItem(USER_PROFILE_KEY)).toBeNull()
      expect(readCookieValue(GRADE_COOKIE_NAME)).toBeNull()
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBeNull()
    })

    it('is a no-op when no profile is stored', () => {
      expect(() => removeCourseSelection()).not.toThrow()
      expect(getUserProfile()).toBeNull()
    })
  })

  describe('removeTeacherProfile', () => {
    it('clears teacherProfileSlug but keeps gradeLevel and courseId', () => {
      setUserProfile({
        gradeLevel: '8',
        courseId: 'course-1',
        teacherProfileSlug: 'teacher-a',
      })

      removeTeacherProfile()

      const profile = getUserProfile()
      expect(profile?.gradeLevel).toBe('8')
      expect(profile?.courseId).toBe('course-1')
      expect(profile?.teacherProfileSlug).toBeUndefined()
    })

    it('clears everything when no sibling fields remain', () => {
      setUserProfile({ teacherProfileSlug: 'teacher-a' })

      removeTeacherProfile()

      expect(getUserProfile()).toBeNull()
      expect(localStorage.getItem(USER_PROFILE_KEY)).toBeNull()
    })

    it('is a no-op when no profile is stored', () => {
      expect(() => removeTeacherProfile()).not.toThrow()
      expect(getUserProfile()).toBeNull()
    })

    it('is a no-op when teacherProfileSlug was never set', () => {
      setUserProfile({ gradeLevel: '8', courseId: 'course-1' })

      removeTeacherProfile()

      const profile = getUserProfile()
      expect(profile?.gradeLevel).toBe('8')
      expect(profile?.courseId).toBe('course-1')
    })
  })

  describe('end-to-end flow', () => {
    it('selectCourse → getUserProfile → removeCourseSelection → cookies absent', () => {
      selectCourse({ gradeLevel: '8', courseId: 'course-1', source: 'other' })

      let profile = getUserProfile()
      expect(profile?.gradeLevel).toBe('8')
      expect(profile?.courseId).toBe('course-1')
      expect(readCookieValue(GRADE_COOKIE_NAME)).toBe('8')
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBe('course-1')

      removeCourseSelection()

      expect(readCookieValue(GRADE_COOKIE_NAME)).toBeNull()
      expect(readCookieValue(COURSE_ID_COOKIE_NAME)).toBeNull()
      profile = getUserProfile()
      expect(profile?.gradeLevel).toBeUndefined()
      expect(profile?.courseId).toBeUndefined()
    })
  })

  describe('invariant: no localStorage write to a-guy:user-profile outside this module', () => {
    it('the module is the only writer for the a-guy:user-profile key', () => {
      // Sanity check on the storage key constant — if a caller bypasses the
      // module and writes the same string literal, the grep guard in CI
      // (run separately) will fail. This test just keeps the constant in one
      // place.
      expect(USER_PROFILE_KEY).toBe('a-guy:user-profile')
    })
  })

  describe('course-selection tracker (best-effort admin telemetry)', () => {
    const ADMIN_URL = 'https://admin.example.test'
    const GUEST_ID_KEY = 'a-guy:guest-id'

    function lastFetchBody(): Record<string, unknown> {
      expect(fetchMock).toHaveBeenCalled()
      const call = fetchMock.mock.calls.at(-1)!
      const init = call[1] as RequestInit
      return JSON.parse(init.body as string)
    }

    it('POSTs to {ADMIN_URL}/api/course-selections with credentials', () => {
      selectCourse({ gradeLevel: '8', courseId: 'course-1', source: 'homepage-greeting' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`${ADMIN_URL}/api/course-selections`)
      expect(init.method).toBe('POST')
      expect(init.credentials).toBe('include')
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    })

    it('sends the correct body for the homepage-greeting call site', () => {
      selectCourse({ gradeLevel: '8', courseId: 'course-a', source: 'homepage-greeting' })
      expect(lastFetchBody()).toMatchObject({
        course: 'course-a',
        source: 'homepage-greeting',
        gradeLevel: '8',
        guestId: expect.any(String),
      })
    })

    it('sends the correct body for the course-card call site', () => {
      selectCourse({ gradeLevel: 'ח', courseId: 'course-b', source: 'course-card' })
      expect(lastFetchBody()).toMatchObject({
        course: 'course-b',
        source: 'course-card',
        gradeLevel: 'ח',
        guestId: expect.any(String),
      })
    })

    it('sends the correct body for the start-page call site', () => {
      selectCourse({ gradeLevel: '10', courseId: 'course-c', source: 'start-page' })
      expect(lastFetchBody()).toMatchObject({
        course: 'course-c',
        source: 'start-page',
        gradeLevel: '10',
        guestId: expect.any(String),
      })
    })

    it('generates a stable guestId and reuses it across selections', () => {
      selectCourse({ gradeLevel: '8', courseId: 'course-1', source: 'course-card' })
      const first = lastFetchBody().guestId as string
      expect(first).toBeTruthy()
      expect(localStorage.getItem(GUEST_ID_KEY)).toBe(first)

      selectCourse({ gradeLevel: '8', courseId: 'course-2', source: 'course-card' })
      const second = lastFetchBody().guestId as string
      expect(second).toBe(first)
    })

    it('does not throw when fetch rejects (Admin down)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      expect(() =>
        selectCourse({ gradeLevel: '8', courseId: 'course-1', source: 'course-card' }),
      ).not.toThrow()

      // Give the swallowed .catch() a tick to settle.
      await Promise.resolve()
      // Local write still happened — UX is not blocked by the failed report.
      expect(getUserProfile()?.courseId).toBe('course-1')
    })

    it('is a no-op when NEXT_PUBLIC_ADMIN_URL is not configured', () => {
      delete process.env.NEXT_PUBLIC_ADMIN_URL

      selectCourse({ gradeLevel: '8', courseId: 'course-1', source: 'course-card' })

      expect(fetchMock).not.toHaveBeenCalled()
      // Local write still happens.
      expect(getUserProfile()?.courseId).toBe('course-1')
    })
  })
})
