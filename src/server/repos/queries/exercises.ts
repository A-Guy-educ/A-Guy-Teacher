import { cache } from 'react'

import {
  findExercisesByLessonWithSections,
  findExerciseByIdWithSections,
  findExerciseByLessonSlugWithSections,
} from './exercises-with-sections'

export const queryExercisesByLesson = cache(async ({ lessonId }: { lessonId: string }) => {
  const exercises = await findExercisesByLessonWithSections(lessonId)
  return exercises.sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
    const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
    return ao - bo
  })
})

export const queryExerciseById = cache(async ({ id }: { id: string }) => {
  return findExerciseByIdWithSections(id)
})

export const queryExerciseBySlug = cache(
  async ({ lessonId, slug }: { lessonId: string; slug: string }) => {
    return findExerciseByLessonSlugWithSections(lessonId, slug)
  },
)
