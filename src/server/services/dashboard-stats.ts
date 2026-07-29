/**
 * Dashboard Stats Service
 *
 * @fileType service
 * @domain stats
 * @pattern repository
 * @ai-summary Lookups behind the learner dashboard — lesson titles and the user's conversations. The counting itself stays in the route, since it is presentation arithmetic rather than data access.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

/**
 * Titles for the given lesson ids, keyed by id.
 *
 * Ids that are not valid ObjectIds are skipped rather than throwing: progress
 * records are user data and have carried junk before. Callers fall back to a
 * generic title for anything missing.
 */
export async function findLessonTitles(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()

  const queryIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id))
  if (!queryIds.length) return new Map()

  const db = await getContentDb()
  const docs = await db
    .collection('lessons')
    .find({ _id: { $in: queryIds } }, { projection: { title: 1 } })
    .toArray()

  return new Map(docs.map((doc) => [doc._id.toString(), String(doc.title || 'Lesson')]))
}

/**
 * A user's conversations, excluding archived ones.
 *
 * The user reference is stored both as an ObjectId and as its string form
 * depending on when the record was written, so both are matched.
 */
export async function findActiveConversations(userId: string): Promise<Document[]> {
  const db = await getContentDb()

  return db
    .collection('conversations')
    .find({
      user: ObjectId.isValid(userId) ? { $in: [userId, new ObjectId(userId)] } : userId,
      archivedAt: { $exists: false },
    })
    .toArray()
}

/** Record a day's streak position on the user's stats document. */
export async function saveStreak(
  statsId: unknown,
  streak: { currentStreak: number; longestStreak: number; lastActiveDate: string },
): Promise<void> {
  const db = await getContentDb()

  await db
    .collection('user-stats')
    .updateOne({ _id: statsId } as Document, { $set: { ...streak, updatedAt: new Date() } })
}

/** Add to a user's accumulated study time and stamp the heartbeat. */
export async function recordStudyTime(
  statsId: unknown,
  totalTimeSpentSeconds: number,
): Promise<void> {
  const db = await getContentDb()
  const now = new Date()

  await db.collection('user-stats').updateOne({ _id: statsId } as Document, {
    $set: { totalTimeSpentSeconds, lastHeartbeatAt: now, updatedAt: now },
  })
}

/**
 * Put an activity at the head of the user's log.
 *
 * The log is capped at 100 entries — it feeds a "recent activity" list, so
 * older entries are of no use and would grow the document without limit.
 */
export async function pushActivity(statsId: unknown, activity: Document): Promise<void> {
  const db = await getContentDb()

  await db.collection('user-stats').updateOne(
    { _id: statsId } as Document,
    {
      $push: { activityLog: { $each: [activity], $position: 0, $slice: 100 } },
      $set: { updatedAt: new Date() },
    } as never,
  )
}
