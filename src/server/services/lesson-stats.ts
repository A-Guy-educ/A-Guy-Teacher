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

import { getContentDb } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

const COLLECTION = 'lesson-stats'

// `ObjectId.isValid` returns true for any 12-byte string too, so a
// malicious client could POST short garbage and create bogus counter rows.
// The tighter regex accepts only the 24-hex form the browser actually gets
// from route params for a real lesson.
const HEX24 = /^[a-f0-9]{24}$/i

let indexPromise: Promise<void> | null = null

async function ensureIndex(): Promise<void> {
  // ??= guarantees a single in-flight index build across concurrent first
  // callers, so no upsert can race past `ensureIndex` before the unique
  // constraint lands (otherwise two concurrent first-time increments for
  // the same lesson could both create rows and permanently double-count).
  indexPromise ??= (async () => {
    const db = await getContentDb()
    try {
      await db
        .collection(COLLECTION)
        .createIndex({ lessonId: 1 }, { unique: true, name: 'lesson_stats_lesson_id_unique' })
      await db
        .collection(COLLECTION)
        .createIndex({ openCount: -1 }, { name: 'lesson_stats_open_count_desc' })
      // Supports the per-lesson-type aggregation's `sessionCount > 0`
      // match so it doesn't COLLSCAN as lesson-stats grows. The $lookup
      // after this match is still N+1 by design at current scale — if it
      // ever bites we denormalize lessonType onto lesson-stats at write.
      await db
        .collection(COLLECTION)
        .createIndex({ sessionCount: 1 }, { name: 'lesson_stats_session_count' })
    } catch (err) {
      // Reset so a later request can retry; log so we notice repeated
      // failures (permissions, primary unavailable, etc.).
      indexPromise = null
      logger.warn({ err }, 'Failed to ensure lesson-stats indexes')
    }
  })()
  return indexPromise
}

/**
 * Increment the open counter for a lesson. Fire-and-forget-safe — throws
 * are swallowed by callers so tracking failures never break the user flow.
 */
export async function incrementLessonOpen(lessonId: string): Promise<void> {
  if (!lessonId || !HEX24.test(lessonId)) return
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

/**
 * Record a completed lesson session (open → close cycle). Bumps both
 * `sessionCount` and `totalDurationSeconds` on the lesson-stats row so
 * `avgDurationSeconds = totalDurationSeconds / sessionCount` can be
 * computed at read time without keeping per-session detail.
 *
 * Sessions with non-positive duration are dropped — those are typically
 * React Strict Mode double-mount/unmount cycles in dev, not real reads.
 */
export async function incrementLessonSession(
  lessonId: string,
  durationSeconds: number,
): Promise<void> {
  if (!lessonId || !HEX24.test(lessonId)) return
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return
  // Clamp absurdly-long sessions (a tab left open for a week) to a
  // realistic cap so a single stale tab doesn't skew the per-lesson
  // average. 6 hours is generous for a single sitting.
  const clamped = Math.min(Math.floor(durationSeconds), 6 * 60 * 60)
  await ensureIndex()
  const db = await getContentDb()
  await db.collection(COLLECTION).updateOne(
    { lessonId },
    {
      $inc: { sessionCount: 1, totalDurationSeconds: clamped },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  )
}
