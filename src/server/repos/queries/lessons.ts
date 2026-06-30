import { cache } from 'react'

import type { Chapter, Course, Lesson, LessonPrerequisite } from '@/infra/types/content'
import {
  findByIdSerialized,
  findManySerialized,
  findOneSerialized,
  objectIdFromString,
  relationId,
  visibleContentFilter,
} from '../mongo'
import { queryChaptersByCourse } from './chapters'

async function populateLessonPrerequisite(
  prerequisiteId: string,
): Promise<LessonPrerequisite | null> {
  const lesson = await findByIdSerialized<Lesson>('lessons', prerequisiteId)
  if (!lesson || lesson.status !== 'published' || !lesson.isActive) return null

  const chapterId = relationId(lesson.chapter)
  if (!chapterId) return null

  const chapter = await findByIdSerialized<Chapter>('chapters', chapterId)
  if (!chapter || chapter.status !== 'published' || !chapter.isActive) return null

  const courseId = relationId(chapter.course)
  if (!courseId) return null

  const course = await findByIdSerialized<Course>('courses', courseId)
  if (!course || course.status !== 'published' || !course.isActive) return null

  return {
    id: lesson.id,
    title: lesson.title,
    slug: lesson.slug ?? '',
    chapterSlug: chapter.slug ?? '',
    courseSlug: course.slug ?? '',
  }
}

async function populateLesson(lesson: Lesson): Promise<Lesson | null> {
  const chapterId = relationId(lesson.chapter)
  if (!chapterId) return null

  const chapter = await findByIdSerialized<Chapter>('chapters', chapterId)
  if (!chapter || chapter.status !== 'published' || !chapter.isActive) return null

  const courseId = relationId(chapter.course)
  if (!courseId) return null

  const course = await findByIdSerialized<Course>('courses', courseId)
  if (!course || course.status !== 'published' || !course.isActive) return null

  // Populate prerequisites
  const prerequisiteIds = (lesson.prerequisites ?? [])
    .map((p) => (typeof p === 'string' ? p : relationId(p)))
    .filter((id): id is string => Boolean(id))

  const populatedPrerequisites = await Promise.all(
    prerequisiteIds.map((id) => populateLessonPrerequisite(id)),
  )
  const prerequisites = populatedPrerequisites.filter((p): p is LessonPrerequisite => p !== null)

  return { ...lesson, chapter: { ...chapter, course }, prerequisites }
}

export const queryLessonsByChapter = cache(async ({ chapterId }: { chapterId: string }) => {
  const chapter = await findByIdSerialized<Chapter>('chapters', chapterId)
  if (!chapter || chapter.status !== 'published' || !chapter.isActive) return []

  const course = await findByIdSerialized<Course>('courses', relationId(chapter.course) || '')
  if (!course || course.status !== 'published' || !course.isActive) return []

  const lessons = await findManySerialized<Lesson>(
    'lessons',
    visibleContentFilter({ chapter: objectIdFromString(chapterId) }),
    { sort: { order: 1 } },
  )

  return lessons.map((lesson) => ({ ...lesson, chapter: { ...chapter, course } }))
})

export const queryLessonBySlug = cache(async ({ slug }: { slug: string }) => {
  // Decode URL-encoded characters (e.g., %20 → space) before querying MongoDB
  // so that encoded URLs like /lessons/item-mmq4tz7a-059190%20-%20Copy
  // correctly match the stored slug item-mmq4tz7a-059190 - Copy
  const decodedSlug = decodeURIComponent(slug)
  const lesson = await findOneSerialized<Lesson>(
    'lessons',
    visibleContentFilter({ slug: decodedSlug }),
  )
  return lesson ? populateLesson(lesson) : null
})

export const queryLessonsByCourse = cache(async ({ courseId }: { courseId: string }) => {
  const course = await findByIdSerialized<Course>('courses', courseId)
  if (!course || course.status !== 'published' || !course.isActive) return []

  const chapters = await queryChaptersByCourse({ courseId })
  const chapterIds = chapters.map((chapter) => chapter.id)
  if (chapterIds.length === 0) return []

  const lessons = await findManySerialized<Lesson>(
    'lessons',
    visibleContentFilter({ chapter: { $in: chapterIds.map(objectIdFromString) } }),
    { sort: { order: 1 } },
  )

  const chapterMap = new Map(chapters.map((chapter, index) => [chapter.id, { chapter, index }]))

  return lessons
    .map((lesson) => {
      const chapterId = relationId(lesson.chapter)
      const item = chapterId ? chapterMap.get(chapterId) : null
      return item ? { ...lesson, chapter: item.chapter } : lesson
    })
    .sort((a, b) => {
      const chapterA = chapterMap.get(relationId(a.chapter) || '')?.index ?? Infinity
      const chapterB = chapterMap.get(relationId(b.chapter) || '')?.index ?? Infinity
      if (chapterA !== chapterB) return chapterA - chapterB
      return (a.order ?? Infinity) - (b.order ?? Infinity)
    })
})
