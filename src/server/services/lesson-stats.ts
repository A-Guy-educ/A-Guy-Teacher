/**
 * Per-lesson statistics counters (open count, later session-time totals).
 *
 * One doc per lesson in the `lesson-stats` collection, upserted with `$inc`
 * on each open. Loose-coupled with the `lessons` collection — we key by
 * lesson id but never require the lesson doc to exist; a delete on
 * `lessons` leaves an orphan counter that the dashboard aggregation
 * filters out via `$lookup`.
 *
 * `activityLog` on `user-stats` is capped at 100 entries per user, so it
 * cannot serve as the source of aggregate "top lessons opened" counts —
 * hence this dedicated counter collection.
 *
 * @fileType service
 * @domain dashboard
 * @pattern counter-collection
 * @ai-summary Per-lesson $inc counters for open count + future duration totals
 */

import { ObjectId } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

const COLLECTION = 'lesson-stats'

let indexEnsured: Promise<void> | null = null

async function ensureIndex(): Promise<void> {
  if (indexEnsured) return indexEnsured
  const db = await getContentDb()
  indexEnsured = db
    .collection(COLLECTION)
    .createIndex({ lessonId: 1 }, { unique: true, name: 'lesson_stats_lesson_id_unique' })
    .then(() =>
      db
        .collection(COLLECTION)
        .createIndex({ openCount: -1 }, { name: 'lesson_stats_open_count_desc' }),
    )
    .then(() => undefined)
    .catch((err: unknown) => {
      indexEnsured = null
      logger.warn({ err }, 'Failed to ensure lesson-stats indexes')
    })
  return indexEnsured
}

/**
 * Increment the open counter for a lesson. Fire-and-forget-safe — throws
 * are swallowed by callers so tracking failures never break the user flow.
 */
export async function incrementLessonOpen(lessonId: string): Promise<void> {
  if (!lessonId || !ObjectId.isValid(lessonId)) return
  await ensureIndex()
  const db = await getContentDb()
  await db
    .collection(COLLECTION)
    .updateOne(
      { lessonId },
      { $inc: { openCount: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true },
    )
}
