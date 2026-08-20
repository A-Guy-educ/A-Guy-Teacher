/**
 * LLM token usage tab: today/month/year totals + averages + top-5 lessons
 * and top-5 users by tokens. Backed by the `llm-usage` event log and
 * `users.llmTokensUsed` counter written by src/server/services/llm-usage.ts
 * on every LLM call.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Token totals + top-5 lessons/users lists
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { TokenMetrics } from '@/server/services/dashboard/metrics-types'

import { MetricCard } from './MetricCard'

interface Props {
  tokens: TokenMetrics
}

export function TokensSection({ tokens }: Props) {
  const t = useTranslations('dashboard.tokens')
  const locale = useLocale()
  const hasAny =
    tokens.totalTokensThisYear > 0 || tokens.topLessons.length > 0 || tokens.topUsers.length > 0

  const maxLessonTokens = tokens.topLessons.reduce((m, r) => Math.max(m, r.totalTokens), 0)
  const maxUserTokens = tokens.topUsers.reduce((m, r) => Math.max(m, r.totalTokens), 0)

  return (
    <section className="space-y-6">
      <h2 className="text-heading-lg font-semibold">{t('section')}</h2>

      {/* Totals + averages */}
      <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label={t('totalToday')} value={tokens.totalTokensToday} />
        <MetricCard label={t('totalMonth')} value={tokens.totalTokensThisMonth} />
        <MetricCard label={t('totalYear')} value={tokens.totalTokensThisYear} />
        <MetricCard label={t('avgPerUser')} value={tokens.avgTokensPerUserThisMonth} />
        <MetricCard label={t('avgPerLesson')} value={tokens.avgTokensPerLessonThisMonth} />
      </div>

      {!hasAny && <p className="text-body-sm text-muted-foreground">{t('noData')}</p>}

      {/* Top lessons + top users */}
      <div className="grid gap-content-gap grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">{t('topLessons')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {tokens.topLessons.length === 0 ? (
              <p className="text-body-sm text-muted-foreground py-section-xs">{t('noData')}</p>
            ) : (
              <ul className="space-y-2">
                {tokens.topLessons.map((row) => {
                  const widthPct =
                    maxLessonTokens > 0 ? (row.totalTokens / maxLessonTokens) * 100 : 0
                  return (
                    <li key={row.lessonId} className="space-y-1">
                      <div className="flex items-center justify-between text-body-sm gap-content-gap-xs">
                        <span className="truncate max-w-[55%]" title={row.lessonTitle}>
                          {row.lessonTitle}
                        </span>
                        <span className="flex items-center gap-3 tabular-nums shrink-0">
                          <span className="text-body-xs text-muted-foreground">
                            {row.callCount.toLocaleString(locale)} {t('callsSuffix')}
                          </span>
                          <span className="font-semibold">
                            {row.totalTokens.toLocaleString(locale)}{' '}
                            <span className="text-body-xs font-normal text-muted-foreground">
                              {t('tokensSuffix')}
                            </span>
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${widthPct}%` }}
                          aria-hidden
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">{t('topUsers')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {tokens.topUsers.length === 0 ? (
              <p className="text-body-sm text-muted-foreground py-section-xs">{t('noData')}</p>
            ) : (
              <ul className="space-y-2">
                {tokens.topUsers.map((row) => {
                  const widthPct = maxUserTokens > 0 ? (row.totalTokens / maxUserTokens) * 100 : 0
                  return (
                    <li key={row.userId} className="space-y-1">
                      <div className="flex items-center justify-between text-body-sm gap-content-gap-xs">
                        <span className="truncate max-w-[70%]" title={row.label}>
                          {row.label}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {row.totalTokens.toLocaleString(locale)}{' '}
                          <span className="text-body-xs font-normal text-muted-foreground">
                            {t('tokensSuffix')}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${widthPct}%` }}
                          aria-hidden
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
