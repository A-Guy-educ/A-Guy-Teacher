import '@/infra/config/server-init'

import { notFound, redirect } from 'next/navigation'

import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { queryLessonBlocks } from '@/server/repos/queries/lesson-blocks'

interface ExercisePageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
    exerciseSlug: string
  }>
}

export default async function ExercisePage({ params }: ExercisePageProps) {
  const { courseSlug, chapterSlug, lessonSlug, exerciseSlug } = await params

  const lesson = await queryLessonBySlug({ slug: lessonSlug })

  if (!lesson) {
    notFound()
  }

  const chapter = typeof lesson.chapter === 'object' ? lesson.chapter : null
  const course = chapter && typeof chapter.course === 'object' ? chapter.course : null

  if (!chapter || !course || chapter.slug !== chapterSlug || course.slug !== courseSlug) {
    notFound()
  }

  const blocks = await queryLessonBlocks({ lessonId: lesson.id })
  const decodedSlug = decodeURIComponent(exerciseSlug)
  const blockIndex = blocks.findIndex((block) => {
    if (block.type !== 'exercise') return false
    const ex = block.data as { slug?: string | null; id: string }
    return (ex.slug || ex.id) === decodedSlug
  })

  if (blockIndex < 0) {
    notFound()
  }

  redirect(
    `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}?section=0&block=${blockIndex}`,
  )
}

export async function generateMetadata({ params }: ExercisePageProps) {
  const { exerciseSlug } = await params
  return {
    title: exerciseSlug,
  }
}
