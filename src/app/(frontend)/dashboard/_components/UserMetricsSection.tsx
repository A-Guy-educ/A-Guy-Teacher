/**
 * User metrics — 22 fields grouped into four sub-blocks: registered totals,
 * active users, guest sessions + conversion, and returning behavior.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Sectioned user statistics: registered / active / guests / returning
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { UserMetrics } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'

interface Props {
  metrics: UserMetrics
}

export function UserMetricsSection({ metrics }: Props) {
  const t = useTranslations('dashboard.users')
  const locale = useLocale()

  const returningHint = `${t('returningHintPrefix')} ${metrics.returningUsersTotal.toLocaleString(locale)} ${t('returningHintSuffix')}`

  return (
    <section className="space-y-6">
      <h2 className="text-heading-lg font-semibold">{t('section')}</h2>

      {/* Registered totals */}
      <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label={t('totalUsers')} value={metrics.totalUsers} />
        <MetricCard label={t('registeredYesterday')} value={metrics.registeredYesterday} />
        <MetricCard label={t('thisWeek')} value={metrics.registeredThisWeek} />
        <MetricCard label={t('lastWeek')} value={metrics.registeredLastWeek} />
        <MetricCard label={t('thisMonth')} value={metrics.registeredThisMonth} />
        <MetricCard label={t('lastMonth')} value={metrics.registeredLastMonth} />
      </div>

      {/* Active users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">{t('activeSection')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-content-gap grid-cols-2 md:grid-cols-4">
            <MetricCard label={t('activeToday')} value={metrics.activeUsersToday} />
            <MetricCard label={t('activeYesterday')} value={metrics.activeUsersYesterday} />
            <MetricCard label={t('activeLastWeek')} value={metrics.activeUsersLastWeek} />
            <MetricCard label={t('activeLastMonth')} value={metrics.activeUsersLastMonth} />
          </div>
        </CardContent>
      </Card>

      {/* Guests + returning */}
      <div className="grid gap-content-gap grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">{t('guestSection')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3">
              <MetricCard label={t('guestTotal')} value={metrics.totalGuestSessions} />
              <MetricCard label={t('guestToday')} value={metrics.guestSessionsToday} />
              <MetricCard label={t('guestLastWeek')} value={metrics.guestSessionsLastWeek} />
              <MetricCard label={t('guestLastMonth')} value={metrics.guestSessionsLastMonth} />
              <MetricCard label={t('converted')} value={metrics.guestToRegisteredCount} />
              <MetricCard
                label={t('conversion')}
                value={metrics.guestToRegisteredPercentage}
                suffix="%"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">{t('returningSection')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3">
              <MetricCard
                label={t('returningInPeriod')}
                value={metrics.returningUsers}
                hint={returningHint}
              />
              <MetricCard
                label={t('returnedOnce')}
                value={metrics.returnedOnceCount}
                hint={`${metrics.returnedOncePercentage}%`}
              />
              <MetricCard
                label={t('returnedMultiple')}
                value={metrics.returnedMultipleCount}
                hint={`${metrics.returnedMultiplePercentage}%`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
