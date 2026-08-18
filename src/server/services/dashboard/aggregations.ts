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
  MonthlySignup,
  RevenueMetrics,
  TopLesson,
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
  timeSpread: Array<{
    avgSeconds: number
    stdDevSeconds: number | null
    medianSeconds: number
  }>
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
  medianTimeSpentMinutes: number
  stdDevTimeSpentMinutes: number
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
          timeSpread: [
            { $match: { totalTimeSpentSeconds: { $gt: 0 } } },
            // Safety cap — 100k user-stats docs is far above current scale
            // but bounded so a runaway growth can't blow the 16 MB per-doc
            // limit when `values` gets pushed for the median calc.
            { $limit: 100000 },
            {
              $group: {
                _id: null,
                values: { $push: '$totalTimeSpentSeconds' },
                avgSeconds: { $avg: '$totalTimeSpentSeconds' },
                stdDevSeconds: { $stdDevSamp: '$totalTimeSpentSeconds' },
              },
            },
            {
              $project: {
                avgSeconds: 1,
                stdDevSeconds: 1,
                // Median via $sortArray + arrayElemAt at n/2 (requires
                // Mongo 5.2+). For even n this returns the upper middle
                // value rather than the average of two middles — accurate
                // enough for a "typical session" summary metric.
                medianSeconds: {
                  $let: {
                    vars: {
                      sorted: { $sortArray: { input: '$values', sortBy: 1 } },
                      n: { $size: '$values' },
                    },
                    in: {
                      $cond: [
                        { $eq: ['$$n', 0] },
                        0,
                        {
                          $arrayElemAt: ['$$sorted', { $floor: { $divide: ['$$n', 2] } }],
                        },
                      ],
                    },
                  },
                },
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

  const spread = result.timeSpread[0]
  const avgSeconds = spread?.avgSeconds ?? 0
  const medianSeconds = spread?.medianSeconds ?? 0
  const stdDevSeconds = spread?.stdDevSeconds ?? 0

  return {
    active: {
      today: firstCount(result.activeToday),
      yesterday: firstCount(result.activeYesterday),
      lastWeek: firstCount(result.activeLastWeek),
      lastMonth: firstCount(result.activeLastMonth),
    },
    returningInPeriod: firstCount(result.returningInPeriod),
    avgTimeSpentMinutes: Math.round(avgSeconds / 60),
    medianTimeSpentMinutes: Math.round(medianSeconds / 60),
    stdDevTimeSpentMinutes: Math.round((stdDevSeconds ?? 0) / 60),
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
  registeredToday: Array<{ n: number }>
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
  registeredToday: number
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
          registeredToday: [
            { $match: { createdAt: { $gte: buckets.todayStart } } },
            { $count: 'n' },
          ],
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
    registeredToday: firstCount(result.registeredToday),
    registeredYesterday: firstCount(result.registeredYesterday),
    registeredThisWeek: firstCount(result.registeredThisWeek),
    registeredLastWeek: firstCount(result.registeredLastWeek),
    registeredThisMonth: firstCount(result.registeredThisMonth),
    registeredLastMonth: firstCount(result.registeredLastMonth),
    totalUsersBeforePeriod: firstCount(result.totalUsersBeforePeriod),
  }
}

// ---------------------------------------------------------------------------
// users — signups grouped by month (last 12 months). Feeds the year-view
// bar chart. Empty months are backfilled at the callsite so gaps appear as
// zero bars rather than missing entries.
// ---------------------------------------------------------------------------

interface MonthlySignupRow {
  _id: string
  count: number
}

export async function aggregateMonthlySignups(db: Db): Promise<MonthlySignup[]> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const rows = await db
    .collection('users')
    .aggregate<MonthlySignupRow>([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()

  const counts = new Map(rows.map((row) => [row._id, row.count]))
  const months: MonthlySignup[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${y}-${m}`
    months.push({ month: key, count: counts.get(key) ?? 0 })
  }
  return months
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
// lesson-stats — top lessons by open count (feeds "top lessons opened"
// widget; expand-to-25 UI hides everything past top 5).
//
// Reads from a dedicated counter collection (see src/server/services/
// lesson-stats.ts) rather than user-stats.activityLog because the
// activityLog is capped at 100 entries per user and can't carry
// aggregate counts. `$lookup` on lessons resolves the title so we don't
// have to keep it denormalized on the counter row.
// ---------------------------------------------------------------------------

interface LessonStatsRow {
  lessonId: string
  openCount: number
  lesson: Array<{ title?: string; slug?: string }>
}

export async function aggregateTopLessonsByOpens(db: Db, limit = 25): Promise<TopLesson[]> {
  const rows = await db
    .collection('lesson-stats')
    .aggregate<LessonStatsRow>([
      { $sort: { openCount: -1 } },
      { $limit: limit },
      {
        // `$toObjectId` runs ONCE per input lessonId (25 max after $limit)
        // rather than `$toString: '$_id'` which would compute per lesson doc
        // in the lookup and defeat the default `_id` index — that's a full
        // COLLSCAN of lessons per dashboard load.
        $lookup: {
          from: 'lessons',
          let: { lid: { $toObjectId: '$lessonId' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$lid'] } } },
            { $project: { title: 1, slug: 1 } },
          ],
          as: 'lesson',
        },
      },
    ])
    .toArray()

  return (
    rows
      // Drop counters whose lesson has been deleted — showing orphan ids on
      // the manager's dashboard is confusing and not actionable.
      .filter((row) => row.lesson.length > 0)
      .map((row) => {
        const lesson = row.lesson[0]
        const lessonTitle = lesson?.title || lesson?.slug || `Lesson ${row.lessonId.slice(-6)}`
        return { lessonId: row.lessonId, lessonTitle, openCount: row.openCount }
      })
  )
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
): Promise<Pick<ContentCounts, 'courses' | 'exercises' | 'formulaSheets' | 'prompts'>> {
  // `courses` is counted independently rather than derived from
  // aggregateCourseEnrollments().length because that pipeline caps at
  // $limit: 100 for the top-N widget — deriving from it would silently
  // truncate the "Courses" metric card once the catalog grows past 100.
  const [courses, exercises, formulaSheets, prompts] = await Promise.all([
    db.collection('courses').countDocuments({}),
    db.collection('exercises').countDocuments({}),
    db.collection('formula-sheets').countDocuments({}),
    db.collection('prompts').countDocuments({}),
  ])
  return { courses, exercises, formulaSheets, prompts }
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
    registeredToday: users.registeredToday,
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
