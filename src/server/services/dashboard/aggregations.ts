/**
 * MongoDB aggregation pipelines that feed the dashboard metrics endpoint.
 *
 * Each function encapsulates one $facet pipeline against one collection and
 * returns a strongly-typed slice of the response. The route runs all of
 * them in parallel (Promise.all) — replacing the admin route's 40+ serial
 * Payload.find calls with ~9 parallel Mongo round-trips.
 *
 * Design notes:
 * - We use $facet so each collection is scanned once with an index, and the
 *   sub-buckets share that scan.
 * - Date-only fields like `lastActiveDate` are stored as "YYYY-MM-DD"
 *   strings (that's the shape the admin's Payload writes); string
 *   comparison is lexicographically date-safe for that format.
 * - `createdAt` is stored as a BSON Date (Payload convention). We compare
 *   with Date objects for range predicates.
 */

import type { Db } from 'mongodb'

import type {
  ContentCounts,
  CourseEnrollment,
  CurrencyRevenue,
  EngagementMetrics,
  RevenueMetrics,
  TopProduct,
  UserMetrics,
} from './metrics-types'
import type { DateBuckets } from './date-buckets'

function firstCount(bucket: Array<{ n?: number }> | undefined): number {
  return bucket?.[0]?.n ?? 0
}

function safePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  const raw = (numerator / denominator) * 100
  const clamped = Math.min(100, Math.max(0, raw))
  return Math.round(clamped * 10) / 10
}

// ---------------------------------------------------------------------------
// user-stats — active / avg-time / returning / feature-usage
// ---------------------------------------------------------------------------

interface UserStatsFacetResult {
  activeToday: Array<{ n: number }>
  activeYesterday: Array<{ n: number }>
  activeLastWeek: Array<{ n: number }>
  activeLastMonth: Array<{ n: number }>
  returningInPeriod: Array<{ n: number }>
  avgTime: Array<{ avgSeconds: number }>
  returnedOnce: Array<{ n: number }>
  returnedMultiple: Array<{ n: number }>
  featureUsage: Array<{ _id: string | null; count: number }>
}

export async function aggregateUserStats(
  db: Db,
  buckets: DateBuckets,
): Promise<{
  active: {
    today: number
    yesterday: number
    lastWeek: number
    lastMonth: number
  }
  returningInPeriod: number
  avgTimeSpentMinutes: number
  returnedOnceCount: number
  returnedMultipleCount: number
  featureUsage: EngagementMetrics['featureUsage']
}> {
  const [result] = (await db
    .collection('user-stats')
    .aggregate<UserStatsFacetResult>([
      {
        $facet: {
          activeToday: [{ $match: { lastActiveDate: buckets.todayStr } }, { $count: 'n' }],
          activeYesterday: [{ $match: { lastActiveDate: buckets.yesterdayStr } }, { $count: 'n' }],
          activeLastWeek: [
            {
              $match: {
                lastActiveDate: {
                  $gte: buckets.lastWeekStartStr,
                  $lt: buckets.thisWeekStartStr,
                },
              },
            },
            { $count: 'n' },
          ],
          activeLastMonth: [
            {
              $match: {
                lastActiveDate: {
                  $gte: buckets.lastMonthStartStr,
                  $lt: buckets.lastWeekStartStr,
                },
              },
            },
            { $count: 'n' },
          ],
          returningInPeriod: [
            { $match: { lastActiveDate: { $gte: buckets.periodStartStr } } },
            { $count: 'n' },
          ],
          avgTime: [
            { $match: { totalTimeSpentSeconds: { $gt: 0 } } },
            {
              $group: {
                _id: null,
                avgSeconds: { $avg: '$totalTimeSpentSeconds' },
              },
            },
          ],
          // Mirror admin's returned-once semantic: createdAt (Date) predates
          // lastActiveDate (YYYY-MM-DD string). Convert createdAt to the
          // same string format for a safe $lt comparison.
          returnedOnce: [
            {
              $match: {
                $expr: {
                  $lt: [
                    { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    '$lastActiveDate',
                  ],
                },
              },
            },
            { $count: 'n' },
          ],
          returnedMultiple: [{ $match: { returnCount: { $gt: 2 } } }, { $count: 'n' }],
          featureUsage: [
            { $match: { totalTimeSpentSeconds: { $gt: 0 }, activityLog: { $type: 'array' } } },
            // Cap per-user unwinds so a handful of heavy long-lived accounts
            // can't inflate the intermediate document count enough to blow
            // the perf target. -50000 keeps the most-recent slice, which is
            // what usage counters care about anyway. Precompute counters
            // on the user-stats document if this ever needs to drop lower.
            { $addFields: { activityLog: { $slice: ['$activityLog', -50000] } } },
            { $unwind: '$activityLog' },
            {
              $group: {
                _id: '$activityLog.actionType',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ])
    .toArray()) as [UserStatsFacetResult]

  const featureUsage: EngagementMetrics['featureUsage'] = {
    questionsAsked: 0,
    conversationsStarted: 0,
    lessonsCompleted: 0,
    exercisesAttempted: 0,
    exercisesCompleted: 0,
  }
  const featureUsageMap: Record<string, keyof EngagementMetrics['featureUsage']> = {
    question_asked: 'questionsAsked',
    conversation_started: 'conversationsStarted',
    lesson_completed: 'lessonsCompleted',
    exercise_attempted: 'exercisesAttempted',
    exercise_completed: 'exercisesCompleted',
  }
  for (const row of result.featureUsage) {
    if (!row._id) continue
    const key = featureUsageMap[row._id]
    if (key) featureUsage[key] = row.count
  }

  const avgSeconds = result.avgTime[0]?.avgSeconds ?? 0

  return {
    active: {
      today: firstCount(result.activeToday),
      yesterday: firstCount(result.activeYesterday),
      lastWeek: firstCount(result.activeLastWeek),
      lastMonth: firstCount(result.activeLastMonth),
    },
    returningInPeriod: firstCount(result.returningInPeriod),
    avgTimeSpentMinutes: Math.round(avgSeconds / 60),
    returnedOnceCount: firstCount(result.returnedOnce),
    returnedMultipleCount: firstCount(result.returnedMultiple),
    featureUsage,
  }
}

// ---------------------------------------------------------------------------
// users — registration buckets + totals
// ---------------------------------------------------------------------------

interface UsersFacetResult {
  total: Array<{ n: number }>
  registeredYesterday: Array<{ n: number }>
  registeredThisWeek: Array<{ n: number }>
  registeredLastWeek: Array<{ n: number }>
  registeredThisMonth: Array<{ n: number }>
  registeredLastMonth: Array<{ n: number }>
  totalUsersBeforePeriod: Array<{ n: number }>
}

export async function aggregateUsers(
  db: Db,
  buckets: DateBuckets,
): Promise<{
  total: number
  registeredYesterday: number
  registeredThisWeek: number
  registeredLastWeek: number
  registeredThisMonth: number
  registeredLastMonth: number
  totalUsersBeforePeriod: number
}> {
  const [result] = (await db
    .collection('users')
    .aggregate<UsersFacetResult>([
      {
        $facet: {
          total: [{ $count: 'n' }],
          registeredYesterday: [
            {
              $match: {
                createdAt: { $gte: buckets.yesterdayStart, $lt: buckets.todayStart },
              },
            },
            { $count: 'n' },
          ],
          registeredThisWeek: [
            { $match: { createdAt: { $gte: buckets.thisWeekStart } } },
            { $count: 'n' },
          ],
          registeredLastWeek: [
            {
              $match: {
                createdAt: { $gte: buckets.lastWeekStart, $lt: buckets.thisWeekStart },
              },
            },
            { $count: 'n' },
          ],
          registeredThisMonth: [
            { $match: { createdAt: { $gte: buckets.thisMonthStart } } },
            { $count: 'n' },
          ],
          registeredLastMonth: [
            {
              $match: {
                createdAt: { $gte: buckets.lastMonthStart, $lt: buckets.thisMonthStart },
              },
            },
            { $count: 'n' },
          ],
          totalUsersBeforePeriod: [
            { $match: { createdAt: { $lt: buckets.periodStart } } },
            { $count: 'n' },
          ],
        },
      },
    ])
    .toArray()) as [UsersFacetResult]

  return {
    total: firstCount(result.total),
    registeredYesterday: firstCount(result.registeredYesterday),
    registeredThisWeek: firstCount(result.registeredThisWeek),
    registeredLastWeek: firstCount(result.registeredLastWeek),
    registeredThisMonth: firstCount(result.registeredThisMonth),
    registeredLastMonth: firstCount(result.registeredLastMonth),
    totalUsersBeforePeriod: firstCount(result.totalUsersBeforePeriod),
  }
}

// ---------------------------------------------------------------------------
// guest-sessions — totals + buckets + converted
// ---------------------------------------------------------------------------

interface GuestsFacetResult {
  total: Array<{ n: number }>
  today: Array<{ n: number }>
  lastWeek: Array<{ n: number }>
  lastMonth: Array<{ n: number }>
  converted: Array<{ n: number }>
}

export async function aggregateGuestSessions(
  db: Db,
  buckets: DateBuckets,
): Promise<{
  total: number
  today: number
  lastWeek: number
  lastMonth: number
  converted: number
}> {
  const [result] = (await db
    .collection('guest-sessions')
    .aggregate<GuestsFacetResult>([
      {
        $facet: {
          total: [{ $count: 'n' }],
          today: [{ $match: { createdAt: { $gte: buckets.todayStart } } }, { $count: 'n' }],
          lastWeek: [
            {
              $match: {
                createdAt: { $gte: buckets.lastWeekStart, $lt: buckets.thisWeekStart },
              },
            },
            { $count: 'n' },
          ],
          lastMonth: [
            {
              $match: {
                createdAt: { $gte: buckets.lastMonthStart, $lt: buckets.lastWeekStart },
              },
            },
            { $count: 'n' },
          ],
          converted: [{ $match: { claimedByUser: { $exists: true } } }, { $count: 'n' }],
        },
      },
    ])
    .toArray()) as [GuestsFacetResult]

  return {
    total: firstCount(result.total),
    today: firstCount(result.today),
    lastWeek: firstCount(result.lastWeek),
    lastMonth: firstCount(result.lastMonth),
    converted: firstCount(result.converted),
  }
}

// ---------------------------------------------------------------------------
// transactions — revenue by currency + refunded/failed + top products
// ---------------------------------------------------------------------------

interface TransactionsFacetResult {
  revenueByCurrency: Array<{ _id: string; total: number; count: number }>
  refundedTotal: Array<{ total: number }>
  failedTotal: Array<{ total: number }>
  statusCounts: Array<{ _id: string; count: number }>
  topProducts: Array<{
    _id: unknown
    agorot: number
    product: Array<{ name?: string; slug?: string }>
  }>
}

const DEFAULT_CURRENCIES = ['ILS', 'USD', 'EUR']

export async function aggregateTransactions(db: Db, buckets: DateBuckets): Promise<RevenueMetrics> {
  const [result] = (await db
    .collection('transactions')
    .aggregate<TransactionsFacetResult>([
      { $match: { createdAt: { $gte: buckets.periodStart } } },
      {
        $facet: {
          revenueByCurrency: [
            { $match: { status: 'succeeded' } },
            {
              $group: {
                _id: { $ifNull: ['$currency', 'ILS'] },
                total: { $sum: { $ifNull: ['$amount', 0] } },
                count: { $sum: 1 },
              },
            },
          ],
          refundedTotal: [
            { $match: { status: 'refunded' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
          ],
          failedTotal: [
            { $match: { status: 'failed' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
          ],
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          topProducts: [
            { $match: { status: 'succeeded' } },
            {
              $group: {
                _id: '$product',
                agorot: { $sum: { $ifNull: ['$amount', 0] } },
              },
            },
            { $sort: { agorot: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'product',
              },
            },
          ],
        },
      },
    ])
    .toArray()) as [TransactionsFacetResult]

  const totalRevenueAgorot: CurrencyRevenue = {}
  for (const currency of DEFAULT_CURRENCIES) totalRevenueAgorot[currency] = 0
  for (const row of result.revenueByCurrency) {
    // $ifNull only substitutes null/missing, not the empty string, so an
    // "" currency bucket slips past the pipeline default. Coerce here so
    // those rows still contribute to ILS instead of being silently dropped.
    const currency = row._id && row._id.length > 0 ? row._id : 'ILS'
    totalRevenueAgorot[currency] = (totalRevenueAgorot[currency] || 0) + row.total
  }

  const refundedAgorot = result.refundedTotal[0]?.total ?? 0
  const failedAgorot = result.failedTotal[0]?.total ?? 0

  let succeededCount = 0
  let nonPendingCount = 0
  let transactionCount = 0
  for (const row of result.statusCounts) {
    transactionCount += row.count
    if (row._id === 'succeeded') {
      succeededCount = row.count
      nonPendingCount += row.count
    } else if (row._id === 'refunded' || row._id === 'failed') {
      nonPendingCount += row.count
    }
  }

  const successRate =
    nonPendingCount > 0 ? Math.round((succeededCount / nonPendingCount) * 1000) / 10 : 0

  const topProducts: TopProduct[] = result.topProducts.map((row) => {
    const productDoc = row.product?.[0]
    const idFragment = String(row._id ?? '').slice(-6)
    const productName = productDoc?.name || productDoc?.slug || `__DELETED__:${idFragment}`
    return { productName, agorot: row.agorot }
  })

  return {
    totalRevenueAgorot,
    refundedAgorot,
    failedAgorot,
    transactionCount,
    successRate,
    topProducts,
  }
}

// ---------------------------------------------------------------------------
// courses + enrollments — per-course counts including zero-enrollment courses
// ---------------------------------------------------------------------------

interface CourseWithCountResult {
  _id: unknown
  title?: string
  courseLabel?: string
  slug?: string
  activeEnrollmentCount: number
}

export async function aggregateCourseEnrollments(db: Db): Promise<CourseEnrollment[]> {
  const rows = await db
    .collection('courses')
    .aggregate<CourseWithCountResult>([
      {
        $lookup: {
          from: 'enrollments',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$course', '$$courseId'] },
                status: 'active',
              },
            },
            { $count: 'n' },
          ],
          as: 'enrollments',
        },
      },
      {
        $project: {
          title: 1,
          courseLabel: 1,
          slug: 1,
          activeEnrollmentCount: {
            $ifNull: [{ $arrayElemAt: ['$enrollments.n', 0] }, 0],
          },
        },
      },
      { $sort: { activeEnrollmentCount: -1 } },
      // Safety cap — leaves plenty of headroom for the "top N + expand"
      // widget (Batch A) while preventing the long tail from bloating the
      // response as the catalog grows.
      { $limit: 100 },
    ])
    .toArray()

  return rows.map((row) => {
    const idFragment = String(row._id ?? '').slice(-6)
    const courseTitle = row.title || row.courseLabel || row.slug || `__DELETED__:${idFragment}`
    return { courseTitle, count: row.activeEnrollmentCount }
  })
}

// ---------------------------------------------------------------------------
// lessons — type buckets (also feeds the ContentCounts.lessons total)
// ---------------------------------------------------------------------------

interface LessonsFacetResult {
  total: Array<{ n: number }>
  learning: Array<{ n: number }>
  practice: Array<{ n: number }>
  exam: Array<{ n: number }>
}

export async function aggregateLessonTypes(
  db: Db,
): Promise<{ total: number; learning: number; practice: number; exam: number }> {
  const [result] = (await db
    .collection('lessons')
    .aggregate<LessonsFacetResult>([
      {
        $facet: {
          total: [{ $count: 'n' }],
          learning: [{ $match: { type: 'learning' } }, { $count: 'n' }],
          practice: [{ $match: { type: 'practice' } }, { $count: 'n' }],
          exam: [{ $match: { type: 'exam' } }, { $count: 'n' }],
        },
      },
    ])
    .toArray()) as [LessonsFacetResult]

  return {
    total: firstCount(result.total),
    learning: firstCount(result.learning),
    practice: firstCount(result.practice),
    exam: firstCount(result.exam),
  }
}

// ---------------------------------------------------------------------------
// content counts — three cheap countDocuments in parallel
// ---------------------------------------------------------------------------

export async function countSimpleContent(
  db: Db,
): Promise<Pick<ContentCounts, 'exercises' | 'formulaSheets' | 'prompts'>> {
  const [exercises, formulaSheets, prompts] = await Promise.all([
    db.collection('exercises').countDocuments({}),
    db.collection('formula-sheets').countDocuments({}),
    db.collection('prompts').countDocuments({}),
  ])
  return { exercises, formulaSheets, prompts }
}

// ---------------------------------------------------------------------------
// UserMetrics assembly helper — combines aggregations into the response slice
// ---------------------------------------------------------------------------

export function buildUserMetrics(input: {
  userStats: Awaited<ReturnType<typeof aggregateUserStats>>
  users: Awaited<ReturnType<typeof aggregateUsers>>
  guests: Awaited<ReturnType<typeof aggregateGuestSessions>>
}): UserMetrics {
  const { userStats, users, guests } = input

  const guestToRegisteredPercentage = safePct(guests.converted, guests.total)
  const returnedOncePercentage = safePct(userStats.returnedOnceCount, users.total)
  const returnedMultiplePercentage = safePct(userStats.returnedMultipleCount, users.total)

  return {
    activeUsersToday: userStats.active.today,
    activeUsersYesterday: userStats.active.yesterday,
    activeUsersLastWeek: userStats.active.lastWeek,
    activeUsersLastMonth: userStats.active.lastMonth,
    registeredYesterday: users.registeredYesterday,
    registeredThisWeek: users.registeredThisWeek,
    registeredLastWeek: users.registeredLastWeek,
    registeredThisMonth: users.registeredThisMonth,
    registeredLastMonth: users.registeredLastMonth,
    totalUsers: users.total,
    totalGuestSessions: guests.total,
    guestSessionsToday: guests.today,
    guestSessionsLastWeek: guests.lastWeek,
    guestSessionsLastMonth: guests.lastMonth,
    guestToRegisteredCount: guests.converted,
    guestToRegisteredPercentage,
    returnedOnceCount: userStats.returnedOnceCount,
    returnedOncePercentage,
    returnedMultipleCount: userStats.returnedMultipleCount,
    returnedMultiplePercentage,
    returningUsers: userStats.returningInPeriod,
    returningUsersTotal: users.totalUsersBeforePeriod,
  }
}
