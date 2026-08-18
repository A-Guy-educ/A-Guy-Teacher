/**
 * Best-effort sync of the user's current course + last-active timestamp to Admin.
 *
 * PATCH `{NEXT_PUBLIC_ADMIN_URL}/api/users/me/course-state` with an optional
 * `currentCourse` id. Admin stamps `lastLoginAt` server-side on every
 * successful call — clients cannot forge activity timestamps, so the body
 * carries no timestamp of its own.
 *
 * Fire-and-forget: never awaited on the UX path, never surfaces errors to
 * callers, browser-only (SSR skips silently). Admin being unreachable must
 * never break the user's flow.
 *
 * Lives under `infra/` (the leaf layer) so it can be called from client,
 * infra, and app layers alike — same reason `courseSelectionTracker` would
 * belong here too, historical placement aside.
 *
 * Called from three sites:
 *   - `selectCourse` (explicit pick) — with the picked courseId
 *   - `UserIdentificationTracker` (first authenticated mount per session).
 *     Fires on both the fresh-fetch path (cache miss / >24 h stale) and
 *     the cached-warm path so daily-returning users still refresh their
 *     lastLoginAt. The fresh-fetch path can compare against the server
 *     value and safely propagate the localStorage courseId when the
 *     server has none; the cached path lacks the fetched user object, so
 *     it sends an empty body (lastLoginAt-only) rather than risk
 *     clobbering server state with an unverifiable cookie value.
 *   - `LessonAnalytics` (lesson open) — with the lesson's courseId, always
 *     overwriting server state (a live lesson open is the freshest signal)
 */

/**
 * Read the client's known courseId from the mirror cookie set by
 * `setUserProfile` in the client layer. Lives here (not in client) so the
 * infra-layer session-start sync can pull the value without violating the
 * infra-cannot-import-client layer rule. Cookie name is a stable contract
 * (`a-guy:course-id`) already relied on by server components.
 */
export const readCourseIdFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)a-guy:course-id=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export const syncCurrentCourse = (courseId?: string | null): void => {
  if (typeof window === 'undefined') return
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL
  if (!adminUrl) return

  const body: Record<string, string> = {}
  if (courseId) body.currentCourse = courseId

  try {
    void fetch(`${adminUrl}/api/users/me/course-state`, {
      method: 'PATCH',
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
