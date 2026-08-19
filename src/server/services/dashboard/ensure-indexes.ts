/**
 * Ensures the indexes the dashboard aggregations rely on. Called once on
 * first hit; subsequent calls short-circuit via the module-level Promise
 * cache so we don't hit `createIndex` per request. Same pattern as the
 * durable rate-limiter's `ensureIndexes`.
 *
 * These indexes are cheap read-heavy indexes and safe to create in place —
 * `createIndex` is idempotent, no-op when the index already exists.
 */

import type { Db } from 'mongodb'

import { logger } from '@/infra/utils/logger/logger'

let indexesEnsured: Promise<void> | null = null

async function createIndexes(db: Db): Promise<void> {
  await Promise.all([
    db
      .collection('user-stats')
      .createIndex({ lastActiveDate: 1 }, { name: 'user_stats_last_active_date' }),
    db
      .collection('user-stats')
      .createIndex({ totalTimeSpentSeconds: 1 }, { name: 'user_stats_total_time_spent_seconds' }),
    db.collection('users').createIndex({ createdAt: 1 }, { name: 'users_created_at' }),
    db
      .collection('transactions')
      .createIndex({ createdAt: 1, status: 1 }, { name: 'transactions_created_at_status' }),
    db
      .collection('enrollments')
      .createIndex({ status: 1, course: 1 }, { name: 'enrollments_status_course' }),
    db
      .collection('guest-sessions')
      .createIndex({ createdAt: 1 }, { name: 'guest_sessions_created_at' }),
    db
      .collection('guest-sessions')
      .createIndex({ claimedByUser: 1 }, { name: 'guest_sessions_claimed_by_user' }),
    // Backs aggregateUsersPerCurrentCourse — partial so it only indexes
    // users who have picked a course, matching the pipeline's $match
    // predicate exactly. Keeps the index small while `currentCourse`
    // populates over time via the admin sync path.
    db.collection('users').createIndex(
      { currentCourse: 1 },
      {
        name: 'users_current_course',
        partialFilterExpression: { currentCourse: { $exists: true, $ne: null } },
      },
    ),
  ])
}

export function ensureDashboardIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return indexesEnsured
  indexesEnsured = createIndexes(db).catch((err: unknown) => {
    // Reset so a later request can retry; log so we notice if it keeps
    // failing (e.g. permissions or a Mongo primary-unavailable window).
    indexesEnsured = null
    logger.warn({ err }, 'Failed to ensure dashboard indexes — will retry on next request')
  })
  return indexesEnsured
}
