/**
 * @fileType utility
 * @domain exercises
 * @pattern section-population
 * @ai-summary Aggregation helpers that populate the `sections` field on exercise docs by joining the `sections` collection via Mongo `$lookup`. This is the web app's analogue of bumping Payload `depth: 0 → depth: 1` for exercises — exercises now arrive with their child `Section` docs (including `content.blocks`) instead of bare section IDs. `getExerciseBlocks()` resolves Path 1/Path 2 against these populated sections.
 */

import type { Document } from 'mongodb'

import type { Exercise } from '@/infra/types/content'
import { aggregateManySerialized, aggregateOneSerialized, objectIdFromString } from '../mongo'

/**
 * Build a `$lookup` stage that joins child `sections` onto an exercise via the
 * reverse relationship: each `section.exercise` points at `exercises._id`.
 * The join writes the populated section docs into `exercise.sections`, which
 * `getExerciseBlockGroups()` orders using the `exercise.blocks` playlist
 * (falling back to `section.order`).
 *
 * The exercises collection has no `sections` field of its own — the playlist
 * is stored in `exercise.blocks` (a JSON textarea of `sectionRef` entries),
 * and sections back-point to their parent via `section.exercise`. Joining the
 * other way (`localField: 'sections'`) matches nothing.
 */
export function sectionsLookupStage(): Document {
  return {
    $lookup: {
      from: 'sections',
      localField: '_id',
      foreignField: 'exercise',
      as: 'sections',
    },
  }
}

/**
 * Match exercises by `_id` with sections populated. Mirrors `findByIdSerialized`
 * for exercises but returns the populated shape.
 */
export async function findExerciseByIdWithSections(id: string): Promise<Exercise | null> {
  return aggregateOneSerialized<Exercise>('exercises', [
    { $match: { _id: objectIdFromString(id) as unknown as Document['_id'] } },
    sectionsLookupStage(),
  ])
}

/**
 * Match exercises by `lesson` foreign key with sections populated.
 */
export async function findExercisesByLessonWithSections(lessonId: string): Promise<Exercise[]> {
  return aggregateManySerialized<Exercise>('exercises', [
    { $match: { lesson: objectIdFromString(lessonId) as unknown as Document['lesson'] } },
    sectionsLookupStage(),
  ])
}

/**
 * Match exercises by `(lesson, slug)` with sections populated.
 */
export async function findExerciseByLessonSlugWithSections(
  lessonId: string,
  slug: string,
): Promise<Exercise | null> {
  return aggregateOneSerialized<Exercise>('exercises', [
    {
      $match: {
        lesson: objectIdFromString(lessonId) as unknown as Document['lesson'],
        slug,
      },
    },
    sectionsLookupStage(),
  ])
}

/**
 * Match exercises by `_id` (within a list) with sections populated. Used by
 * `queryLessonBlocks` to resolve exercises referenced from `lesson.blocks`
 * while still surfacing their child sections for `getExerciseBlocks()`.
 */
export async function findExercisesByIdsWithSections(ids: string[]): Promise<Exercise[]> {
  if (ids.length === 0) return []
  return aggregateManySerialized<Exercise>('exercises', [
    { $match: { _id: { $in: ids.map(objectIdFromString) } as unknown as Document['_id'] } },
    sectionsLookupStage(),
  ])
}
