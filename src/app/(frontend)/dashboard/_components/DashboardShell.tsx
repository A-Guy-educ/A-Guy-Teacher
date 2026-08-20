/**
 * Client-side dashboard shell.
 *
 * Server hands us the initial metrics for the default period; a client-side
 * refetch fires when the manager changes the period. The refetch guard
 * compares the requested period against `data.period` (the currently-loaded
 * payload), not the server's initial period — otherwise going Week → Month
 * silently no-ops because it matches the initial default and the shell
 * keeps rendering week data under a "Month" header.
 *
 * A failed refetch surfaces as an inline banner with an explicit Retry
 * action so a transient upstream failure doesn't leave the manager stuck
 * on stale data with no recovery path.
 *
 * Layout: sections are grouped into topic tabs (users, content, engagement,
 * revenue) rather than a single scrolling stack. Users tab pairs the
 * period buckets with the monthly signups chart since both are user-time
 * views of the same underlying data.
 *
 * @fileType component
 * @domain dashboard
 * @pattern container
 * @ai-summary Period state + refetch + tab layout for /dashboard sections
 */

'use client'

import { useCallback, useEffect, useState } from 'react'

import { logger } from '@/infra/utils/logger'
import { Button } from '@/ui/web/components/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/web/components/tabs'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { DashboardMetricsResponse, Period } from '@/server/services/dashboard/metrics-types'

import { ContentCountsSection } from './ContentCountsSection'
import { EngagementSection } from './EngagementSection'
import { MonthlySignupsSection } from './MonthlySignupsSection'
import { PeriodSelector } from './PeriodSelector'
import { RevenueSection } from './RevenueSection'
import { TokensSection } from './TokensSection'
import { UserMetricsSection } from './UserMetricsSection'

interface Props {
  initialData: DashboardMetricsResponse
}

export function DashboardShell({ initialData }: Props) {
  const t = useTranslations('dashboard')
  const [period, setPeriod] = useState<Period>(initialData.period)
  const [data, setData] = useState<DashboardMetricsResponse>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasError, setHasError] = useState(false)

  const fetchForPeriod = useCallback(async (next: Period) => {
    setIsRefreshing(true)
    setHasError(false)
    try {
      const res = await fetch(`/api/dashboard-metrics?period=${next}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as DashboardMetricsResponse
      setData(json)
    } catch (err) {
      logger.error({ err, next }, 'dashboard: failed to refetch metrics')
      setHasError(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Guard against the currently-loaded payload's period, not the server's
    // initial period — otherwise Week → Month early-returns because Month
    // matches the initial default while `data` still holds Week.
    if (period === data.period) return
    void fetchForPeriod(period)
  }, [period, data.period, fetchForPeriod])

  return (
    <div className="mx-auto max-w-7xl px-4 py-section-md space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-content-gap">
        <div>
          <h1 className="text-heading-2xl font-bold">{t('title')}</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {t('periodLabel')}: {t(`period.${data.period}`)}
            {isRefreshing && <span className="ml-2 italic">{t('refreshing')}</span>}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} disabled={isRefreshing} />
      </header>

      {hasError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-content-gap rounded-lg border border-error/40 bg-error/10 p-card-padding-sm"
        >
          <p className="text-body-sm text-foreground">{t('loadError')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchForPeriod(period)}
            disabled={isRefreshing}
          >
            {t('retry')}
          </Button>
        </div>
      )}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
          <TabsTrigger value="content">{t('tabs.content')}</TabsTrigger>
          <TabsTrigger value="engagement">{t('tabs.engagement')}</TabsTrigger>
          <TabsTrigger value="tokens">{t('tabs.tokens')}</TabsTrigger>
          <TabsTrigger value="revenue">{t('tabs.revenue')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-8">
          <UserMetricsSection metrics={data.userMetrics} />
          <MonthlySignupsSection months={data.monthlySignups} />
        </TabsContent>

        <TabsContent value="content">
          <ContentCountsSection counts={data.contentCounts} />
        </TabsContent>

        <TabsContent value="engagement">
          <EngagementSection engagement={data.engagement} />
        </TabsContent>

        <TabsContent value="tokens">
          <TokensSection tokens={data.tokenMetrics} />
        </TabsContent>

        <TabsContent value="revenue">
          <RevenueSection revenue={data.revenueMetrics} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
