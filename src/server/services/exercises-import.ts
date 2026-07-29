/**
 * Exercise Import Service
 *
 * @fileType service
 * @domain exercises
 * @pattern repository
 * @ai-summary Lookups behind the exercise-import compatibility probe. The web-only build performs no conversion, so this only reports what already exists.
 */

import { ObjectId } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

/**
 * Identifiers are stored inconsistently — some as ObjectIds, some as the
 * string form — so a lookup has to try both.
 */
function idCandidates(id: string) {
  return ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id]
}

/** True when a lesson with this id exists. */
export async function lessonExists(lessonId: string): Promise<boolean> {
  const db = await getContentDb()
  const lesson = await db.collection('lessons').findOne({
    _id: ObjectId.isValid(lessonId) ? new ObjectId(lessonId) : lessonId,
  } as never)

  return Boolean(lesson)
}

/** How many exercises are already attached to a lesson. */
export async function countExercisesForLesson(lessonId: string): Promise<number> {
  const db = await getContentDb()
  return db.collection('exercises').countDocuments({ lesson: { $in: idCandidates(lessonId) } })
}
