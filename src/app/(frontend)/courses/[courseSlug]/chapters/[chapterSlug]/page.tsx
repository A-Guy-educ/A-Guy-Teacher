import '@/infra/config/server-init'

import { notFound } from 'next/navigation'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/infra/types/content'
import { queryCourseBySlugWithFallback } from '@/server/repos/queries/courses'
import { queryChapterBySlug } from '@/server/repos/queries/chapters'
import { queryLessonsByChapter } from '@/server/repos/queries/lessons'
import { queryPurchaseHrefForCourse } from '@/server/repos/queries/products'
import { SystemParams } from '@/infra/config/system-params'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { checkPaidAccess } from '@/server/utils/check-paid-access'
import { stripHtml } from '@/utils/strip-html'
import { ChapterPageBreadcrumb } from '../../../_components/ChapterPageBreadcrumb'
import { ChapterHeader } from '../../../_components/ChapterHeader'
import { LessonsSectionTitle } from '../../../_components/LessonsSectionTitle'
import { LessonCard } from '../../../_components/LessonCard'
import { EmptyState } from '../../../_components/EmptyState'
import { LocaleFallbackBanner } from '../../../_components/LocaleFallbackBanner'

interface ChapterPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
  }>
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { courseSlug, chapterSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [{ course, isLocaleFallback }, chapter] = await Promise.all([
    queryCourseBySlugWithFallback({ slug: courseSlug, locale: contentLocale }),
    queryChapterBySlug({ slug: chapterSlug }),
  ])

  if (!course || !chapter) {
    notFound()
  }

  // Verify chapter belongs to this course
  const chapterCourse = typeof chapter.course === 'string' ? null : chapter.course

  if (!chapterCourse || chapterCourse.id !== course.id) {
    notFound()
  }

  // Course page gate is now universal — all courses require registration.
  const courseAccessType = 'mandatory'
  const [gatedDelayMs, gatedWarningMs] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  const lessons = await queryLessonsByChapter({ chapterId: chapter.id })

  // Compute entitlement once for the whole chapter so every LessonCard can
  // decide its lock state without an extra round-trip.
  const { requiresEntitlement } = await checkPaidAccess(course.id)
  const hasPaidAccess = !requiresEntitlement

  // Resolve the cheapest active product that unlocks this course — drives the
  // locked-lesson paywall CTA. Falls back to /products when no product matches
  // or the query errors.
  const purchaseSlug = await queryPurchaseHrefForCourse({ courseId: course.id })
  const purchaseHref = purchaseSlug ? `/products/${purchaseSlug}` : undefined

  return (
    <AccessGateProvider
      accessType={courseAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <div className="container mx-auto px-4 py-section-md max-w-5xl">
        {/* Enhanced breadcrumb area */}
        <div className="mb-6 pb-4 border-b border-border/40">
          <ChapterPageBreadcrumb
            courseTitle={course.title}
            courseSlug={courseSlug}
            chapterTitle={chapter.title}
          />
        </div>

        {/* Locale fallback notice */}
        <div className="mb-6">
          <LocaleFallbackBanner isLocaleFallback={isLocaleFallback} />
        </div>

        {/* Chapter header with accent color bar */}
        <div className="relative pl-5 mb-10">
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-primary" />
          <ChapterHeader
            chapterLabel={chapter.chapterLabel}
            title={chapter.title}
            description={chapter.description}
          />
        </div>

        <section>
          <LessonsSectionTitle />

          {lessons.length === 0 ? (
            <EmptyState type="noLessons" />
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  courseSlug={courseSlug}
                  chapterSlug={chapterSlug}
                  courseAccessType={course.accessType}
                  hasPaidAccess={hasPaidAccess}
                  purchaseHref={purchaseHref}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AccessGateProvider>
  )
}

export async function generateMetadata({ params }: ChapterPageProps) {
  const { courseSlug, chapterSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [{ course }, chapter] = await Promise.all([
    queryCourseBySlugWithFallback({ slug: courseSlug, locale: contentLocale }),
    queryChapterBySlug({ slug: chapterSlug }),
  ])

  if (!course || !chapter) {
    return {
      title: 'Chapter Not Found',
    }
  }

  const chapterCourse = typeof chapter.course === 'string' ? null : chapter.course

  if (!chapterCourse || chapterCourse.id !== course.id) {
    return {
      title: 'Chapter Not Found',
    }
  }

  return {
    title: `${chapter.title} - ${course.title}`,
    description: chapter.description ? stripHtml(chapter.description) : `Chapter: ${chapter.title}`,
  }
}
