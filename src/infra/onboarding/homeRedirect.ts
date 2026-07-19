export interface HomeRedirectInput {
  isAuthenticated: boolean
  selectedCourseId?: string | null
  /**
   * Resolves a stored course `_id` (from the `a-guy:course-id` cookie) to the
   * course's public slug. Injected so this function stays a pure decision
   * module — the slug lookup itself happens in `queryCourseSlugById`. Only
   * invoked when `isAuthenticated` is true and `selectedCourseId` is non-empty.
   */
  resolveCourseSlug?: (courseId: string) => Promise<string | null>
}

/**
 * Decide where `/home` should bounce the visitor.
 *
 * - Not authenticated → `/login`
 * - Authenticated, no course cookie (or only whitespace) → `/start`
 * - Authenticated, course cookie resolves to a slug → `/courses/{slug}`
 * - Authenticated, course cookie present but the id is invalid, the course is
 *   gone, or it has no slug → `/start` (never `/courses/undefined`, never a
 *   crash). Surfacing `/start` here nudges the user through the picker again
 *   rather than dumping them on a 404.
 */
export async function resolveHomeRedirect({
  isAuthenticated,
  selectedCourseId,
  resolveCourseSlug,
}: HomeRedirectInput): Promise<string> {
  if (!isAuthenticated) return '/login'

  const trimmed = selectedCourseId?.trim()
  if (!trimmed) return '/start'

  if (!resolveCourseSlug) return '/start'

  const slug = await resolveCourseSlug(trimmed)
  if (!slug) return '/start'

  return `/courses/${slug}`
}

export function resolveLandingRedirect(isAuthenticated: boolean): '/home' | null {
  return isAuthenticated ? '/home' : null
}
