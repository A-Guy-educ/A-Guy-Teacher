import '@/infra/config/server-init'

import { notFound } from 'next/navigation'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/infra/types/content'
import { queryCourseBySlugWithFallback } from '@/server/repos/queries/courses'
import { queryChaptersByCourse } from '@/server/repos/queries/chapters'
import { queryLessonsByCourse } from '@/server/repos/queries/lessons'
import { queryPurchaseHrefForCourse } from '@/server/repos/queries/products'
import { SystemParams } from '@/infra/config/system-params'
import { getAuthenticatedUserServer } from '@/server/utils/access-gate-server'
import { checkPaidAccess } from '@/server/utils/check-paid-access'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { stripHtml } from '@/utils/strip-html'
import { getContentDb, objectIdFromString, relationId } from '@/infra/db/content-db'
import { findUserProgress } from '@/server/web-api/progress'
import { CoursePageContent } from './_components/CoursePageContent'

export const dynamic = 'force-dynamic'

interface CoursePageProps {
  params: Promise<{
    courseSlug: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined
  const { course, isLocaleFallback } = await queryCourseBySlugWithFallback({
    slug: courseSlug,
    locale: contentLocale,
  })

  if (!course) {
    notFound()
  }

  // Course page gate is now universal — all courses require registration.
  // `accessType` is the lesson-level default and applies inside lessons
  // via resolveAccessType(lesson.accessType, course.accessType).
  const courseAccessType = 'mandatory'
  const [gatedDelayMs, gatedWarningMs] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  // Server-side block: for paid courses, check entitlement
  if (course.accessType === 'paid') {
    const { requiresEntitlement, isAuthenticated } = await checkPaidAccess(course.id)

    if (requiresEntitlement) {
      return (
        <AccessGateProvider
          accessType={courseAccessType}
          courseSlug={courseSlug}
          gatedDelayMs={gatedDelayMs}
          gatedWarningMs={gatedWarningMs}
          requiresEntitlement={true}
          isAuthenticated={isAuthenticated}
        >
          <div className="min-h-screen" />
        </AccessGateProvider>
      )
    }
  }

  const [chapters, lessons] = await Promise.all([
    queryChaptersByCourse({ courseId: course.id }),
    queryLessonsByCourse({ courseId: course.id }),
  ])

  // Fetch lesson progress: exercises completed / total exercises per lesson.
  // Scoped to the course's grade label so users with progress under multiple
  // grade buckets (one user-progress doc per grade) read the right one.
  const lessonProgressMap = await buildLessonProgressMap(
    lessons.map((l) => l.id),
    course.courseLabel || '',
  )

  // Resolve the cheapest active product that unlocks this course — drives the
  // locked-lesson paywall CTA. Reverse-lookup because the course has no
  // back-ref to product. Falls back to /products when no product matches or
  // the query errors; never throws.
  const purchaseSlug = await queryPurchaseHrefForCourse({ courseId: course.id })
  const purchaseHref = purchaseSlug ? `/products/${purchaseSlug}` : undefined

  return (
    <AccessGateProvider
      accessType={courseAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <CoursePageContent
        course={course}
        chapters={chapters}
        lessons={lessons}
        courseSlug={courseSlug}
        lessonProgressMap={lessonProgressMap}
        isLocaleFallback={isLocaleFallback}
        purchaseHref={purchaseHref}
      />
    </AccessGateProvider>
  )
}

/**
 * Build a map of lessonId → { completed, total, percent } based on
 * exercise counts and user-progress records.
 */
async function buildLessonProgressMap(
  lessonIds: string[],
  gradeLevel: string,
): Promise<Record<string, { completed: number; total: number; percent: number }>> {
  const result: Record<string, { completed: number; total: number; percent: number }> = {}
  for (const lessonId of lessonIds) {
    result[lessonId] = { completed: 0, total: 0, percent: 0 }
  }

  const { user } = await getAuthenticatedUserServer()
  if (!user?.id || lessonIds.length === 0) return result

  const db = await getContentDb()
  const exercises = await db
    .collection('exercises')
    .find({ lesson: { $in: lessonIds.map(objectIdFromString) } }, { projection: { lesson: 1 } })
    .toArray()
  const lessonExerciseIds = new Map<string, string[]>()
  for (const exercise of exercises) {
    const lessonId = relationId(exercise.lesson)
    if (!lessonId) continue
    const ids = lessonExerciseIds.get(lessonId) ?? []
    ids.push(exercise._id.toString())
    lessonExerciseIds.set(lessonId, ids)
  }

  const progress = await findUserProgress(user.id, gradeLevel || 'default')
  const records = progress?.progressRecords ?? []
  const completedExerciseIds = new Set(
    records
      .filter((record) => record.recordType === 'exercise' && record.status === 'completed')
      .map((record) => record.recordId),
  )

  for (const lessonId of lessonIds) {
    const exerciseIds = lessonExerciseIds.get(lessonId) ?? []
    const completed = exerciseIds.filter((id) => completedExerciseIds.has(id)).length
    const total = exerciseIds.length
    result[lessonId] = {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }

  return result
}

export async function generateMetadata({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined
  const { course } = await queryCourseBySlugWithFallback({
    slug: courseSlug,
    locale: contentLocale,
  })

  if (!course) {
    return { title: 'Course Not Found' }
  }

  return {
    title: course.meta?.title || course.title,
    description:
      course.meta?.description || (course.description ? stripHtml(course.description) : undefined),
  }
}
