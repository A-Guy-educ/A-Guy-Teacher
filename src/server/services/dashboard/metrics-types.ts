/**
 * Response contract for the admin dashboard metrics endpoint.
 *
 * Mirrors the shape of `A-Guy-Admin/src/app/api/admin/dashboard-metrics` so
 * the ported widgets (see PR-B2) render against the same field names. Any
 * change here breaks the widgets — coordinate before touching.
 */

export type Period = 'week' | 'month' | 'year'

export const VALID_PERIODS: readonly Period[] = ['week', 'month', 'year']

export interface UserMetrics {
  activeUsersToday: number
  activeUsersYesterday: number
  activeUsersLastWeek: number
  activeUsersLastMonth: number
  registeredToday: number
  registeredYesterday: number
  registeredThisWeek: number
  registeredLastWeek: number
  registeredThisMonth: number
  registeredLastMonth: number
  totalUsers: number
  totalGuestSessions: number
  guestSessionsToday: number
  guestSessionsLastWeek: number
  guestSessionsLastMonth: number
  guestToRegisteredCount: number
  guestToRegisteredPercentage: number
  returnedOnceCount: number
  returnedOncePercentage: number
  returnedMultipleCount: number
  returnedMultiplePercentage: number
  returningUsers: number
  returningUsersTotal: number
}

/** One month bucket for the year-view signups chart. `month` is "YYYY-MM". */
export interface MonthlySignup {
  month: string
  count: number
}

export interface CourseEnrollment {
  courseTitle: string
  count: number
}

/**
 * One row for "active learners per course" — sourced from
 * `users.currentCourse` (the last course the user picked or opened a
 * lesson in), not the `enrollments` collection which counts purchases.
 * A user can own multiple courses but only be on one at a time.
 */
export interface UsersPerCourse {
  courseTitle: string
  count: number
}

/**
 * One row for the "top lessons opened" widget. Sorted desc by openCount.
 * `avgDurationSeconds` is null when we have opens tracked but no ended
 * sessions yet (early after PR 2 ships, or lessons with only bail-outs).
 */
export interface TopLesson {
  lessonId: string
  lessonTitle: string
  openCount: number
  avgDurationSeconds: number | null
}

/**
 * Session-time roll-up by lesson type (learning / practice / exam). Values
 * are averages in seconds; null when no completed sessions of that type.
 */
export interface SessionTimeByLessonType {
  learning: number | null
  practice: number | null
  exam: number | null
}

export interface EngagementMetrics {
  avgTimeSpentMinutes: number
  medianTimeSpentMinutes: number
  stdDevTimeSpentMinutes: number
  courseEnrollments: CourseEnrollment[]
  usersPerCourse: UsersPerCourse[]
  topLessons: TopLesson[]
  sessionTimeByLessonType: SessionTimeByLessonType
  featureUsage: {
    questionsAsked: number
    conversationsStarted: number
    lessonsCompleted: number
    exercisesAttempted: number
    exercisesCompleted: number
  }
  lessonTypeUsage: {
    learning: number
    practice: number
    exam: number
  }
}

export interface ContentCounts {
  courses: number
  lessons: number
  exercises: number
  formulaSheets: number
  prompts: number
}

export interface CurrencyRevenue {
  [currencyCode: string]: number
}

export interface TopProduct {
  productName: string
  agorot: number
}

export interface RevenueMetrics {
  totalRevenueAgorot: CurrencyRevenue
  refundedAgorot: number
  failedAgorot: number
  transactionCount: number
  successRate: number
  topProducts: TopProduct[]
}

export interface TopLessonByTokens {
  lessonId: string
  lessonTitle: string
  totalTokens: number
  callCount: number
}

export interface TopUserByTokens {
  userId: string
  label: string
  totalTokens: number
}

export interface TokenMetrics {
  totalTokensToday: number
  totalTokensThisMonth: number
  totalTokensThisYear: number
  avgTokensPerUserThisMonth: number
  avgTokensPerLessonThisMonth: number
  topLessons: TopLessonByTokens[]
  topUsers: TopUserByTokens[]
}

export interface DashboardMetricsResponse {
  period: Period
  userMetrics: UserMetrics
  monthlySignups: MonthlySignup[]
  contentCounts: ContentCounts
  engagement: EngagementMetrics
  revenueMetrics: RevenueMetrics
  tokenMetrics: TokenMetrics
}
