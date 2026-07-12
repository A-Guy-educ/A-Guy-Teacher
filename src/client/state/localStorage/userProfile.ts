/**
 * localStorage utilities for anonymous user profile
 * SSR-safe implementations that check for window availability
 *
 * This module is the single source of truth for "selected course" state:
 * the grade + courseId + teacherProfileSlug bundle that lives in
 * localStorage and is mirrored to two cookies (grade / course-id) for
 * server components. Every write goes through one of the functions below;
 * no other code should touch `localStorage.setItem('a-guy:user-profile', ...)`
 * or `document.cookie = 'a-guy:grade=...'` directly.
 */

import { reportCourseSelection, type CourseSelectionSource } from './courseSelectionTracker'

export interface LocalUserProfile {
  gradeLevel: string // "8", "ח", etc.
  courseId?: string
  mood?: string
  teacherProfileSlug?: string
  lastVisit: string // ISO date
}

const STORAGE_KEYS = {
  USER_PROFILE: 'a-guy:user-profile',
} as const

/**
 * Get user profile from localStorage (SSR-safe)
 */
export const getUserProfile = (): LocalUserProfile | null => {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

/**
 * Cookie name for server-side grade access.
 * Mirrors gradeLevel from localStorage so server components can prefetch data.
 */
export const GRADE_COOKIE_NAME = 'a-guy:grade'
export const COURSE_ID_COOKIE_NAME = 'a-guy:course-id'

/**
 * Set user profile fields in localStorage (SSR-safe).
 *
 * Accepts a `Partial<LocalUserProfile>` and merges it into the existing
 * stored profile — "last writer wins" per field, never a full replace —
 * so callers can update a single attribute (e.g. `teacherProfileSlug`)
 * without trampling siblings. `lastVisit` is auto-filled when not provided.
 *
 * Also mirrors `gradeLevel` and `courseId` to the corresponding cookies
 * so server components can prefetch data.
 */
export const setUserProfile = (partial: Partial<LocalUserProfile>): void => {
  if (typeof window === 'undefined') return
  try {
    const existing = getUserProfile() ?? ({} as LocalUserProfile)
    const merged: LocalUserProfile = {
      ...existing,
      ...partial,
      lastVisit: partial.lastVisit ?? existing.lastVisit ?? new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(merged))

    // Mirror grade to cookie for server-side access
    if (merged.gradeLevel) {
      document.cookie = `${GRADE_COOKIE_NAME}=${encodeURIComponent(merged.gradeLevel)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }

    if (merged.courseId) {
      document.cookie = `${COURSE_ID_COOKIE_NAME}=${encodeURIComponent(merged.courseId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    } else {
      document.cookie = `${COURSE_ID_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
    }
  } catch (error) {
    console.error('Failed to save user profile to localStorage:', error)
  }
}

/**
 * Clear user profile from localStorage (SSR-safe).
 * Removes both the profile entry and the grade / courseId cookies.
 */
export const clearUserProfile = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE)
    document.cookie = `${GRADE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
    document.cookie = `${COURSE_ID_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
  } catch (error) {
    console.error('Failed to clear user profile from localStorage:', error)
  }
}

/**
 * Business-level wrapper: the user picked a course.
 * Sets `gradeLevel` and `courseId` and preserves any sibling fields
 * (mood, teacherProfileSlug, lastVisit).
 *
 * Also fires a best-effort telemetry POST to the Admin app so we can
 * count selections. The tracker is fire-and-forget and swallows all
 * errors — Admin outages must never break the UX. `source` identifies
 * which call site the pick came from.
 */
export const selectCourse = ({
  gradeLevel,
  courseId,
  source,
}: {
  gradeLevel: string
  courseId: string
  source: CourseSelectionSource
}): void => {
  setUserProfile({ gradeLevel, courseId })
  reportCourseSelection({ courseId, source, gradeLevel })
}

/**
 * Business-level wrapper: drop the course selection only.
 * Clears `gradeLevel` and `courseId` and the two corresponding cookies;
 * keeps `teacherProfileSlug` if it was set, so a returning user does not
 * lose their teacher preference when they remove the course.
 */
export const removeCourseSelection = (): void => {
  if (typeof window === 'undefined') return
  try {
    const existing = getUserProfile()
    if (!existing) return
    const { gradeLevel: _gradeLevel, courseId: _courseId, ...rest } = existing
    void _gradeLevel
    void _courseId
    if (Object.keys(rest).filter((k) => k !== 'lastVisit').length === 0) {
      clearUserProfile()
      return
    }
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(rest))
    document.cookie = `${GRADE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
    document.cookie = `${COURSE_ID_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
  } catch (error) {
    console.error('Failed to remove course selection from user profile:', error)
  }
}

/**
 * Business-level wrapper: drop the teacher profile preference only.
 * Clears `teacherProfileSlug`; keeps `gradeLevel` / `courseId` so the
 * course selection survives.
 */
export const removeTeacherProfile = (): void => {
  if (typeof window === 'undefined') return
  try {
    const existing = getUserProfile()
    if (!existing || existing.teacherProfileSlug === undefined) return
    const { teacherProfileSlug: _slug, ...rest } = existing
    void _slug
    if (Object.keys(rest).filter((k) => k !== 'lastVisit').length === 0) {
      clearUserProfile()
      return
    }
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(rest))
  } catch (error) {
    console.error('Failed to remove teacher profile from user profile:', error)
  }
}
