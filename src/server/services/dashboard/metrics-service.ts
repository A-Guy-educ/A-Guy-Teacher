/**
 * Dashboard metrics orchestrator.
 *
 * Runs all aggregations in parallel and assembles the DashboardMetricsResponse
 * that the ported widgets consume. Ensures required indexes on first hit;
 * the per-collection $facet pipelines then rely on them for the perf target
 * (<500ms warm, <2s cold on Vercel Node runtime).
 */

import { getContentDb } from '@/infra/db/content-db'

import {
  aggregateCourseEnrollments,
  aggregateGuestSessions,
  aggregateLessonTypes,
  aggregateMonthlySignups,
  aggregateSessionTimeByLessonType,
  aggregateTokenMetrics,
  aggregateTopLessonsByOpens,
  aggregateTransactions,
  aggregateUserStats,
  aggregateUsers,
  aggregateUsersPerCurrentCourse,
  buildUserMetrics,
  countSimpleContent,
} from './aggregations'
import { computeDateBuckets } from './date-buckets'
import { ensureDashboardIndexes } from './ensure-indexes'
import type { DashboardMetricsResponse, Period } from './metrics-types'

export async function computeDashboardMetrics(period: Period): Promise<DashboardMetricsResponse> {
  const db = await getContentDb()
  await ensureDashboardIndexes(db)

  const buckets = computeDateBuckets(period)

  const [
    userStats,
    users,
    guests,
    revenueMetrics,
    courseEnrollments,
    lessons,
    simpleCounts,
    monthlySignups,
    topLessons,
    sessionTimeByLessonType,
    tokenMetrics,
    usersPerCourse,
  ] = await Promise.all([
    aggregateUserStats(db, buckets),
    aggregateUsers(db, buckets),
    aggregateGuestSessions(db, buckets),
    aggregateTransactions(db, buckets),
    aggregateCourseEnrollments(db),
    aggregateLessonTypes(db),
    countSimpleContent(db),
    aggregateMonthlySignups(db),
    aggregateTopLessonsByOpens(db),
    aggregateSessionTimeByLessonType(db),
    aggregateTokenMetrics(db),
    aggregateUsersPerCurrentCourse(db),
  ])

  return {
    period,
    userMetrics: buildUserMetrics({ userStats, users, guests }),
    monthlySignups,
    contentCounts: {
      courses: simpleCounts.courses,
      lessons: lessons.total,
      exercises: simpleCounts.exercises,
      formulaSheets: simpleCounts.formulaSheets,
      prompts: simpleCounts.prompts,
    },
    engagement: {
      avgTimeSpentMinutes: userStats.avgTimeSpentMinutes,
      medianTimeSpentMinutes: userStats.medianTimeSpentMinutes,
      stdDevTimeSpentMinutes: userStats.stdDevTimeSpentMinutes,
      courseEnrollments,
      usersPerCourse,
      topLessons,
      sessionTimeByLessonType,
      featureUsage: userStats.featureUsage,
      lessonTypeUsage: {
        learning: lessons.learning,
        practice: lessons.practice,
        exam: lessons.exam,
      },
    },
    revenueMetrics,
    tokenMetrics,
  }
}
