/**
 * Date-bucket helpers shared across the dashboard metrics aggregations.
 *
 * Uses the server's local timezone (setHours + getFullYear/getMonth/getDate)
 * for BOTH the boundary Date objects and the "YYYY-MM-DD" strings that get
 * compared to `lastActiveDate`. Internal consistency matters — the previous
 * version mixed local-time boundaries with a UTC-round-tripped string, which
 * silently shifted the today/yesterday buckets by a day near UTC midnight.
 * Server-tz vs. client-tz drift is a separate concern (see admin route,
 * which has the same limitation); this at least stops the bug where our own
 * boundary Date and string disagreed.
 */

import type { Period } from './metrics-types'

export interface DateBuckets {
  now: Date
  todayStart: Date
  yesterdayStart: Date
  thisWeekStart: Date
  lastWeekStart: Date
  thisMonthStart: Date
  lastMonthStart: Date
  periodStart: Date
  todayStr: string
  yesterdayStr: string
  thisWeekStartStr: string
  lastWeekStartStr: string
  lastMonthStartStr: string
  periodStartStr: string
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function periodStartFor(now: Date, period: Period): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (period === 'week') d.setDate(d.getDate() - 7)
  else if (period === 'month') d.setMonth(d.getMonth() - 1)
  else d.setFullYear(d.getFullYear() - 1)
  return d
}

export function computeDateBuckets(period: Period, referenceDate: Date = new Date()): DateBuckets {
  const now = referenceDate
  const todayStart = startOfDay(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStart = startOfDay(yesterday)
  const thisWeekStart = startOfWeek(now)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = new Date(thisMonthStart)
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
  const periodStart = periodStartFor(now, period)

  return {
    now,
    todayStart,
    yesterdayStart,
    thisWeekStart,
    lastWeekStart,
    thisMonthStart,
    lastMonthStart,
    periodStart,
    todayStr: ymd(todayStart),
    yesterdayStr: ymd(yesterdayStart),
    thisWeekStartStr: ymd(thisWeekStart),
    lastWeekStartStr: ymd(lastWeekStart),
    lastMonthStartStr: ymd(lastMonthStart),
    periodStartStr: ymd(periodStart),
  }
}
