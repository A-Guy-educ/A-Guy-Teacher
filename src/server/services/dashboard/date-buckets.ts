/**
 * Date-bucket helpers shared across the dashboard metrics aggregations.
 *
 * Uses the server's local timezone the same way the admin route does — the
 * dashboard is admin-facing and the manager runs on Israel time, so
 * "today"/"yesterday" match a human's expectation without needing tz
 * conversion. If we ever multi-region this, revisit.
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
  const value = date.toISOString().split('T')[0]
  if (!value) throw new Error('date toISOString returned no date portion')
  return value
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
