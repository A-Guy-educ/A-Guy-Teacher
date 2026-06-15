import '@/infra/config/server-init'

import { notFound } from 'next/navigation'

import { getSystemLocale } from '@/i18n/server-locale'
import { resolveAccessType } from '@/infra/auth/access-types'
import { SystemParams } from '@/infra/config/system-params'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryExercisesByLesson } from '@/server/repos/queries/exercises'
import { resolveFormulaSheet } from '@/server/repos/queries/formula-sheets'
import { queryLessonBySlug, queryLessonsByCourse } from '@/server/repos/queries/lessons'
import { queryMediaByIds } from '@/server/repos/queries/media'
import { relationId } from '@/server/repos/mongo'
import {
  getAuthenticatedUserServer,
  isAuthenticatedServer,
} from '@/server/utils/access-gate-server'
import { checkPaidAccess } from '@/server/utils/check-paid-access'
import type { Chapter, Course, Exercise, Media } from '@/infra/types/content'
import { isValidContentLocale } from '@/infra/types/content'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { extractAllMediaIds } from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { stripHtml } from '@/utils/strip-html'
import { findUserProgress } from '@/server/web-api/progress'

import { LessonAnalytics } from './_components/LessonAnalytics'
import { LessonIntroPage } from './_components/LessonIntroPage'
import { queryLessonBlocks } from '@/server/repos/queries/lesson-blocks'

export const dynamic = 'force-dynamic'

interface LessonPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

function hasBlocks(exercise: Exercise): boolean {
  if (Array.isArray(exercise.content)) {
    return exercise.content.length > 0
  }

  if (
    exercise.content &&
    typeof exercise.content === 'object' &&
    'blocks' in exercise.content &&
    Array.isArray(exercise.content.blocks)
  ) {
    return exercise.content.blocks.length > 0
  }

  return false
}

function getLessonChapter(lesson: Awaited<ReturnType<typeof queryLessonBySlug>>): Chapter | null {
  return lesson && typeof lesson.chapter === 'object' ? lesson.chapter : null
}

function getChapterCourse(chapter: Chapter | null): Course | null {
  return chapter && typeof chapter.course === 'object' ? chapter.course : null
}

function normalizeContentFiles(files: Array<string | Media> | null | undefined): Media[] {
  return (files ?? [])
    .filter((file): file is Media => typeof file === 'object' && Boolean(file))
    .filter((file) => Boolean(file.url || file.filename))
}

async function getMediaFiles(contentFiles: Array<string | Media> | null | undefined) {
  const inlineFiles = normalizeContentFiles(contentFiles)
  const ids = (contentFiles ?? [])
    .map((file) => relationId(file))
    .filter((id): id is string => Boolean(id))
  const mediaById = await queryMediaByIds(ids)
  const fetchedFiles = ids.map((id) => mediaById[id]).filter((file): file is Media => Boolean(file))

  return [...inlineFiles, ...fetchedFiles].filter(
    (file, index, files) => files.findIndex((item) => item.id === file.id) === index,
  )
}

async function getLessonProgress({
  lessonId,
  exercises,
  gradeLevel,
}: {
  lessonId: string
  exercises: Exercise[]
  gradeLevel: string
}) {
  const total = exercises.length
  const fallback = { completed: 0, total, percent: 0, status: 'not_started' }
  const { user } = await getAuthenticatedUserServer()

  if (!user?.id) return fallback

  const progress = await findUserProgress(user.id, gradeLevel || 'default')
  const records = progress?.progressRecords ?? []
  const completedExerciseIds = new Set(
    records
      .filter((record) => record.recordType === 'exercise' && record.status === 'completed')
      .map((record) => record.recordId),
  )
  const completed = exercises.filter((exercise) => completedExerciseIds.has(exercise.id)).length
  const lessonRecord = records.find(
    (record) => record.recordType === 'lesson' && record.recordId === lessonId,
  )
  const percent =
    total > 0
      ? Math.round((completed / total) * 100)
      : Math.round(lessonRecord?.completionPercentage ?? 0)

  return {
    completed,
    total,
    percent,
    status: lessonRecord?.status ?? fallback.status,
  }
}

async function getLessonData({
  courseSlug,
  chapterSlug,
  lessonSlug,
}: {
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
}) {
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined
  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  const chapter = getLessonChapter(lesson)
  const chapterCourse = getChapterCourse(chapter)

  if (
    !course ||
    !lesson ||
    !chapter ||
    !chapterCourse ||
    chapter.slug !== chapterSlug ||
    chapterCourse.id !== course.id
  ) {
    return null
  }

  const blocks = await queryLessonBlocks({ lessonId: lesson.id })

  return { contentLocale, course, chapter, lesson, blocks }
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const lessonData = await getLessonData({ courseSlug, chapterSlug, lessonSlug })

  if (!lessonData) {
    notFound()
  }

  const { contentLocale, course, lesson, blocks } = lessonData
  const accessType = resolveAccessType(lesson.accessType, course.accessType)
  const [gatedDelayMs, gatedWarningMs] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  if (accessType === 'mandatory' && !(await isAuthenticatedServer())) {
    return (
      <AccessGateProvider
        accessType={accessType}
        courseSlug={courseSlug}
        gatedDelayMs={gatedDelayMs}
        gatedWarningMs={gatedWarningMs}
      >
        <div className="min-h-screen" />
      </AccessGateProvider>
    )
  }

  if (accessType === 'paid') {
    const { requiresEntitlement, isAuthenticated } = await checkPaidAccess(course.id)

    if (requiresEntitlement) {
      return (
        <AccessGateProvider
          accessType={accessType}
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

  const [exercises, mediaFiles, formulaSheetResult] = await Promise.all([
    queryExercisesByLesson({ lessonId: lesson.id }),
    getMediaFiles(lesson.contentFiles),
    resolveFormulaSheet({
      lessonId: lesson.id,
      courseId: course.id,
      locale: contentLocale ?? 'he',
    }),
  ])

  const mediaMap = await queryMediaByIds(
    extractAllMediaIds(exercises.map((exercise) => ({ content: exercise.content ?? null }))),
  )
  const [courseLessons, progress] = await Promise.all([
    queryLessonsByCourse({ courseId: course.id }),
    getLessonProgress({
      lessonId: lesson.id,
      exercises,
      gradeLevel: course.courseLabel || '',
    }),
  ])
  const lessonIndex = courseLessons.findIndex((courseLesson) => courseLesson.id === lesson.id)
  const nextLesson = lessonIndex >= 0 ? courseLessons[lessonIndex + 1] : null
  const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`
  const formulaSheet = formulaSheetResult?.sheet ?? null
  const showChat = exercises.length > 0 || Boolean(lesson.lessonContextText?.trim())
  const hasExerciseBlocks = exercises.some(hasBlocks)
  const contentType = hasExerciseBlocks ? 'exercises' : mediaFiles.length > 0 ? 'pdf' : 'blocks'

  return (
    <AccessGateProvider
      accessType={accessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <LessonAnalytics
        lessonId={lesson.id}
        courseId={course.id}
        lessonTitle={lesson.title}
        contentType={contentType}
      />
      <LessonIntroPage
        lesson={lesson}
        blocks={blocks}
        backUrl={backUrl}
        showChat={showChat}
        formulaSheet={formulaSheet}
        exercises={exercises}
        mediaFiles={mediaFiles}
        mediaMap={mediaMap}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        lessonSlug={lessonSlug}
        lessonId={lesson.id}
        gradeLevel={course.courseLabel || ''}
        progress={progress}
        nextLesson={nextLesson}
      />
    </AccessGateProvider>
  )
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const lessonData = await getLessonData({ courseSlug, chapterSlug, lessonSlug })

  if (!lessonData) {
    return {
      title: 'Lesson Not Found',
    }
  }

  const { course, lesson } = lessonData

  return {
    title: `${lesson.meta?.title || lesson.title} - ${course.title}`,
    description:
      lesson.meta?.description ||
      (lesson.description ? stripHtml(lesson.description) : `Lesson: ${lesson.title}`),
  }
}
