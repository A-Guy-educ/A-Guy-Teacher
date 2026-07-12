/**
 * Best-effort course-selection telemetry.
 *
 * When the user picks a course we notify the Admin app via
 * `POST {NEXT_PUBLIC_ADMIN_URL}/api/course-selections`. The call is:
 *   - fire-and-forget (never awaited on the UX path)
 *   - error-swallowing (Admin being down MUST NOT break selection)
 *   - browser-only (SSR skips it silently)
 *   - credentialed, so authenticated cookies flow through and Admin
 *     can attach `req.user.id` when the visitor is logged in
 *
 * Rate limiting is enforced server-side by Admin (per IP); the client
 * intentionally does no throttling of its own.
 */

import { getOrCreateGuestId } from './guestId'

export type CourseSelectionSource = 'start-page' | 'homepage-greeting' | 'course-card' | 'other'

interface ReportArgs {
  courseId: string
  source: CourseSelectionSource
  gradeLevel?: string
}

export const reportCourseSelection = ({ courseId, source, gradeLevel }: ReportArgs): void => {
  if (typeof window === 'undefined') return
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL
  if (!adminUrl) return

  try {
    const guestId = getOrCreateGuestId()
    const body: Record<string, string> = { course: courseId, source }
    if (guestId) body.guestId = guestId
    if (gradeLevel) body.gradeLevel = gradeLevel

    // Fire-and-forget: no await, no `.then` chain that could surface
    // rejections to the caller. `.catch(() => {})` neutralises unhandled
    // promise rejection warnings if Admin is unreachable.
    void fetch(`${adminUrl}/api/course-selections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      keepalive: true,
    }).catch(() => {
      /* intentional: telemetry must never break UX */
    })
  } catch {
    /* intentional: telemetry must never break UX */
  }
}
