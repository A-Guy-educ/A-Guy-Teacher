/**
 * Signups per month for the last 12 months, rendered as an inline mini
 * bar chart (same visual style as the course-enrollments list — keeps the
 * widget port dependency-free).
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary 12-month signup bar chart backed by aggregateMonthlySignups
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { MonthlySignup } from '@/server/services/dashboard/metrics-types'

interface Props {
  months: MonthlySignup[]
}

function formatMonthLabel(monthKey: string, locale: string): string {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey
  // Day 15 avoids DST edge cases; only month + year are surfaced.
  const date = new Date(year, month - 1, 15)
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
}

export function MonthlySignupsSection({ months }: Props) {
  const t = useTranslations('dashboard.monthly')
  const locale = useLocale()
  const max = months.reduce((m, row) => Math.max(m, row.count), 0)

  return (
    <section className="space-y-4">
      <h2 className="text-heading-lg font-semibold">{t('section')}</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">{t('section')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="grid grid-cols-6 md:grid-cols-12 gap-content-gap-xs items-end h-40">
            {months.map((row) => {
              const heightPct = max > 0 ? (row.count / max) * 100 : 0
              return (
                <li key={row.month} className="flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full bg-primary/80 hover:bg-primary rounded-sm transition-all"
                    style={{ height: `${heightPct}%`, minHeight: row.count > 0 ? 4 : 0 }}
                    title={`${formatMonthLabel(row.month, locale)}: ${row.count.toLocaleString(locale)}`}
                    aria-label={`${formatMonthLabel(row.month, locale)}: ${row.count}`}
                  />
                  <span className="mt-1 text-body-xs text-muted-foreground text-center leading-tight">
                    {formatMonthLabel(row.month, locale).split(' ')[0]}
                  </span>
                  <span className="text-body-xs font-semibold tabular-nums">{row.count}</span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
