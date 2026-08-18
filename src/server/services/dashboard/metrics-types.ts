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

export interface EngagementMetrics {
  avgTimeSpentMinutes: number
  medianTimeSpentMinutes: number
  stdDevTimeSpentMinutes: number
  courseEnrollments: CourseEnrollment[]
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

export interface DashboardMetricsResponse {
  period: Period
  userMetrics: UserMetrics
  monthlySignups: MonthlySignup[]
  contentCounts: ContentCounts
  engagement: EngagementMetrics
  revenueMetrics: RevenueMetrics
}
