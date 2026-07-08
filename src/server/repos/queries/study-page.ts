import { cache } from 'react'

import type { Chapter, ContentLocale, Lesson } from '@/infra/types/content'
import { DEFAULT_ACCESS_TYPE } from '@/server/constants/access-types'
import { SystemParams } from '@/infra/config/system-params'
import {
  findManySerialized,
  localeFilter,
  objectIdFromString,
  relationId,
  visibleContentFilter,
  andFilter,
} from '../mongo'
import { queryChaptersByCourse, queryChaptersByGrade } from './chapters'
import { queryPublishedCourses } from './courses'
import { queryPurchaseHrefForCourse } from './products'
import { orderLearningFallbackCourses } from '@/app/(frontend)/study/learningPageSelection'

export interface PrefetchedStudyData {
  chapters: Array<Chapter & { lessons: Lesson[] }>
  courseSlug: string
  courseId: string
  courseTitle: string
  courseLabel: string
  coursePageAccessType: string
  courseAccessType: string
  /**
   * Resolved buy URL for the locked-lesson paywall CTA. Format: `/products/<slug>`
   * when an active product unlocks this course; `undefined` when the
   * container should fall back to the generic `/products` route. See #770.
   */
  purchaseHref?: string
  gatedDelayMs?: number
  gatedWarningMs?: number
}

export const prefetchStudyData = cache(
  async (
    gradeLevel: string,
    locale?: ContentLocale,
    lessonType: 'learning' | 'practice' | 'exam' = 'practice',
    courseId?: string,
  ): Promise<PrefetchedStudyData | null> => {
    const [chapters, [gatedDelayMs, gatedWarningMs]] = await Promise.all([
      courseId ? queryChaptersByCourse({ courseId }) : queryChaptersByGrade({ gradeLevel, locale }),
      Promise.all([SystemParams.getGatedDelayMs(), SystemParams.getGatedWarningMs()]),
    ])

    const course = typeof chapters[0]?.course === 'object' ? chapters[0].course : null
    if (!course) return null

    const chapterIds = chapters.map((chapter) => chapter.id)
    const lessons =
      chapterIds.length > 0
        ? await findManySerialized<Lesson>(
            'lessons',
            andFilter(
              visibleContentFilter({
                chapter: { $in: chapterIds.map(objectIdFromString) },
                type: lessonType,
              }),
              localeFilter(locale),
            ),
            { sort: { order: 1 }, limit: 1000 },
          )
        : []

    const lessonsByChapter: Record<string, Lesson[]> = {}
    for (const lesson of lessons) {
      const chapterId = relationId(lesson.chapter)
      if (!chapterId) continue
      lessonsByChapter[chapterId] ||= []
      lessonsByChapter[chapterId].push(lesson)
    }

    // Resolve the cheapest active product that unlocks this course once —
    // forwarded into PrefetchedStudyData so the locked-lesson paywall CTA
    // routes to /products/<slug> instead of the generic /products index.
    // Returns null (caller falls back to /products) when no product matches
    // or the query errors.
    const purchaseSlug = await queryPurchaseHrefForCourse({ courseId: course.id })
    const purchaseHref = purchaseSlug ? `/products/${purchaseSlug}` : undefined

    return {
      chapters: chapters.map((chapter) => ({
        ...chapter,
        lessons: lessonsByChapter[chapter.id] || [],
      })),
      courseSlug: course.slug || '',
      courseId: course.id,
      courseTitle: course.title || '',
      courseLabel: course.courseLabel || '',
      coursePageAccessType: 'mandatory',
      courseAccessType: course.accessType || DEFAULT_ACCESS_TYPE,
      purchaseHref,
      gatedDelayMs,
      gatedWarningMs,
    }
  },
)

export const prefetchEmbeddedLearningFallback = cache(
  async (
    locale?: ContentLocale,
    lessonType: 'learning' | 'practice' | 'exam' = 'learning',
  ): Promise<PrefetchedStudyData | null> => {
    const courses = orderLearningFallbackCourses(await queryPublishedCourses(locale))

    for (const course of courses) {
      const gradeLevel = course.courseLabel?.trim()
      if (!gradeLevel) continue

      const data = await prefetchStudyData(gradeLevel, locale, lessonType, course.id)
      if (data?.chapters.some((chapter) => chapter.lessons.length > 0)) {
        return data
      }
    }

    return null
  },
)
