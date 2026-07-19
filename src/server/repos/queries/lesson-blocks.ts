import { cache } from 'react'

import type { ContentPage, Exercise, Lesson } from '@/infra/types/content'
import {
  findByIdSerialized,
  findManySerialized,
  objectIdFromString,
  relationId,
  publishedActiveFilter,
} from '../mongo'
import {
  findExercisesByIdsWithSections,
  findExercisesByLessonWithSections,
} from './exercises-with-sections'

export type ResolvedExerciseBlock = {
  type: 'exercise'
  data: Exercise
}

export type ResolvedContentPageBlock = {
  type: 'contentPage'
  data: ContentPage
}

export type ResolvedLessonBlock = ResolvedExerciseBlock | ResolvedContentPageBlock

function parseBlocks(rawBlocks: unknown): Array<{
  blockType?: string
  exercise?: string | { id: string }
  contentPage?: string | { id: string }
}> {
  if (Array.isArray(rawBlocks)) return rawBlocks as ReturnType<typeof parseBlocks>
  if (typeof rawBlocks !== 'string' || !rawBlocks.trim()) return []

  try {
    const parsed = JSON.parse(rawBlocks)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const queryLessonBlocks = cache(
  async ({ lessonId }: { lessonId: string }): Promise<ResolvedLessonBlock[]> => {
    const lesson = await findByIdSerialized<Lesson>('lessons', lessonId)
    const blocks = parseBlocks(lesson?.blocks)
    if (blocks.length === 0) {
      const exercises = await findExercisesByLessonWithSections(lessonId)
      const sorted = exercises.sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
        const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
        return ao - bo
      })
      return sorted.map((exercise) => ({ type: 'exercise', data: exercise }))
    }

    const exerciseIds = blocks
      .filter((block) => block.blockType === 'exerciseRef' && block.exercise)
      .map((block) => relationId(block.exercise))
      .filter(Boolean) as string[]
    const contentPageIds = blocks
      .filter((block) => block.blockType === 'contentPageRef' && block.contentPage)
      .map((block) => relationId(block.contentPage))
      .filter(Boolean) as string[]

    const [exercises, contentPages] = await Promise.all([
      exerciseIds.length
        ? findExercisesByIdsWithSections(exerciseIds)
        : Promise.resolve([] as Exercise[]),
      contentPageIds.length
        ? findManySerialized<ContentPage>(
            'content-pages',
            publishedActiveFilter({ _id: { $in: contentPageIds.map(objectIdFromString) } }),
            { limit: contentPageIds.length },
          )
        : Promise.resolve([]),
    ])

    const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]))
    const contentPageMap = new Map(contentPages.map((page) => [page.id, page]))
    const resolved: ResolvedLessonBlock[] = []

    for (const block of blocks) {
      if (block.blockType === 'exerciseRef') {
        const exercise = exerciseMap.get(relationId(block.exercise) || '')
        if (exercise) resolved.push({ type: 'exercise', data: exercise })
      }
      if (block.blockType === 'contentPageRef') {
        const page = contentPageMap.get(relationId(block.contentPage) || '')
        if (page) resolved.push({ type: 'contentPage', data: page })
      }
    }

    return resolved
  },
)
