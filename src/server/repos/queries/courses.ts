import { ObjectId } from 'mongodb'
import { cache } from 'react'

import { getContentDb } from '@/infra/db/content-db'
import type { ContentLocale, Course } from '@/infra/types/content'
import {
  andFilter,
  defaultTenantFilter,
  findManySerialized,
  findOneSerialized,
  localeFilter,
  visibleContentFilter,
} from '../mongo'

export const queryCourseBySlug = cache(
  async ({ slug, locale }: { slug: string; locale?: ContentLocale }): Promise<Course | null> => {
    return findOneSerialized<Course>(
      'courses',
      andFilter(
        { slug },
        visibleContentFilter(),
        localeFilter(locale),
        await defaultTenantFilter(),
      ),
    )
  },
)

export interface CourseQueryResult {
  course: Course | null
  /** True when the requested locale returned no result and Hebrew was returned instead */
  isLocaleFallback: boolean
}

/**
 * Like queryCourseBySlug but falls back to the default locale (Hebrew) when
 * the requested locale is not found, and reports that fact via isLocaleFallback.
 */
export const queryCourseBySlugWithFallback = cache(
  async ({
    slug,
    locale,
  }: {
    slug: string
    locale?: ContentLocale
  }): Promise<CourseQueryResult> => {
    // Try with the requested locale first
    const course = await queryCourseBySlug({ slug, locale })

    if (course) {
      return { course, isLocaleFallback: false }
    }

    // If locale is already undefined or 'he', no fallback possible
    if (!locale || locale === 'he') {
      return { course: null, isLocaleFallback: false }
    }

    // Fall back to Hebrew (default locale)
    const fallbackCourse = await queryCourseBySlug({ slug, locale: undefined })
    return { course: fallbackCourse, isLocaleFallback: fallbackCourse !== null }
  },
)

export const queryPublishedCourses = cache(async (locale?: ContentLocale): Promise<Course[]> => {
  return findManySerialized<Course>(
    'courses',
    andFilter(visibleContentFilter(), localeFilter(locale), await defaultTenantFilter()),
    { sort: { order: 1 } },
  )
})

/**
 * Resolve a course Mongo `_id` (as stored in the `a-guy:course-id` cookie) to
 * its public slug. Used by the `/home` redirect to deep-link the user back to
 * `/courses/{slug}` instead of the deprecated `/study` route.
 *
 * Returns `null` when:
 * - the id isn't a valid ObjectId hex (the cookie is user-editable),
 * - the course has been deleted, or
 * - the course has no slug (malformed / mid-import).
 *
 * Pattern mirrors `src/server/repos/queries/transactions.ts:132-140`.
 */
export const queryCourseSlugById = cache(async (courseId: string): Promise<string | null> => {
  if (!ObjectId.isValid(courseId)) return null

  const db = await getContentDb()
  const doc = await db
    .collection('courses')
    .findOne({ _id: new ObjectId(courseId) }, { projection: { slug: 1 } })
  const slug = doc?.slug
  return typeof slug === 'string' && slug.length > 0 ? slug : null
})
