/**
 * Course Search Service
 *
 * Provides course-wide and per-course content search (courses, lessons, exercises).
 *
 * @fileType service
 * @domain courses
 * @pattern search-aggregation
 * @ai-summary Aggregates search results across courses, lessons, and exercises with enrollment filtering
 *
 * Gotcha: Without courseSlug, searches all content. With courseSlug, narrows to that course's hierarchy.
 */
import type { Exercise, Lesson } from '@/infra/types/content'
import { buildExerciseUrl, buildLessonUrl } from '@/server/utils/course-url-builder'
import { queryChaptersByCourse } from '@/server/repos/queries/chapters'
import { searchCourseContent } from '@/server/repos/queries/course-search'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import {
  findManySerialized,
  objectIdFromString,
  relationId,
  visibleContentFilter,
} from '@/server/repos/mongo'

interface SearchResult {
  id: string
  title: string
  type?: string | null
  lessonTitle?: string | null
  url: string
}

export interface CourseSearchResponse {
  enrolled: true
  results: {
    courses?: SearchResult[]
    lessons: SearchResult[]
    exercises: SearchResult[]
    questions: []
  }
  total: number
}

function toSearchRegex(query: string) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

export async function getCourseSearchResults({
  query,
  courseSlug,
}: {
  query: string
  courseSlug?: string
}): Promise<CourseSearchResponse | null> {
  if (!courseSlug) {
    const results = await searchCourseContent({ query, limit: 20 })
    const courses = results
      .filter((result) => result.type === 'course')
      .map((result) => ({ id: result.id, title: result.title, url: result.url }))
    const lessons = results
      .filter((result) => result.type === 'lesson')
      .map((result) => ({ id: result.id, title: result.title, type: 'learning', url: result.url }))
    const exercises = results
      .filter((result) => result.type === 'exercise')
      .map((result) => ({
        id: result.id,
        title: result.title,
        lessonTitle: result.subtitle,
        url: result.url,
      }))

    return {
      enrolled: true,
      results: { courses, lessons, exercises, questions: [] },
      total: courses.length + lessons.length + exercises.length,
    }
  }

  const course = await queryCourseBySlug({ slug: courseSlug })
  if (!course) return null

  const regex = toSearchRegex(query)
  const chapters = await queryChaptersByCourse({ courseId: course.id })
  const chapterIds = chapters.map((chapter) => chapter.id)
  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]))

  const lessons =
    chapterIds.length > 0
      ? await findManySerialized<Lesson>(
          'lessons',
          visibleContentFilter({
            chapter: { $in: chapterIds.map(objectIdFromString) },
            title: regex,
          }),
          { limit: 20 },
        )
      : []

  const allLessons =
    chapterIds.length > 0
      ? await findManySerialized<Lesson>(
          'lessons',
          visibleContentFilter({ chapter: { $in: chapterIds.map(objectIdFromString) } }),
          { limit: 1000 },
        )
      : []

  const lessonMap = new Map(allLessons.map((lesson) => [lesson.id, lesson]))
  const lessonIds = allLessons.map((lesson) => lesson.id)

  const exercises =
    lessonIds.length > 0
      ? await findManySerialized<Exercise>(
          'exercises',
          { lesson: { $in: lessonIds.map(objectIdFromString) }, title: regex },
          { limit: 20 },
        )
      : []

  const lessonResults = lessons.map((lesson) => {
    const chapter = chapterMap.get(relationId(lesson.chapter) || '')
    return {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type || 'learning',
      url: buildLessonUrl(courseSlug, chapter?.slug ?? '', lesson.slug ?? ''),
    }
  })

  const exerciseResults = exercises.map((exercise) => {
    const lesson = lessonMap.get(relationId(exercise.lesson) || '')
    const chapter = lesson ? chapterMap.get(relationId(lesson.chapter) || '') : null
    return {
      id: exercise.id,
      title: exercise.title || 'Untitled Exercise',
      lessonTitle: lesson?.title ?? '',
      url: buildExerciseUrl(
        courseSlug,
        chapter?.slug ?? '',
        lesson?.slug ?? '',
        exercise.slug ?? '',
      ),
    }
  })

  return {
    enrolled: true,
    results: { lessons: lessonResults, exercises: exerciseResults, questions: [] },
    total: lessonResults.length + exerciseResults.length,
  }
}
