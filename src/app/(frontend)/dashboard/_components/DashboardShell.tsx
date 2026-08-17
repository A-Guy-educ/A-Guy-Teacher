/**
 * Client-side dashboard shell.
 *
 * Server hands us the initial metrics for the default period; a client-side
 * re-fetch only fires when the manager changes the period. Keeps first paint
 * free of a loading spinner while still letting the period selector work
 * without a full page reload.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'

import { logger } from '@/infra/utils/logger'
import type { DashboardMetricsResponse, Period } from '@/server/services/dashboard/metrics-types'

import { ContentCountsSection } from './ContentCountsSection'
import { EngagementSection } from './EngagementSection'
import { PeriodSelector } from './PeriodSelector'
import { RevenueSection } from './RevenueSection'
import { UserMetricsSection } from './UserMetricsSection'

interface Props {
  initialData: DashboardMetricsResponse
}

export function DashboardShell({ initialData }: Props) {
  const [period, setPeriod] = useState<Period>(initialData.period)
  const [data, setData] = useState<DashboardMetricsResponse>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchForPeriod = useCallback(async (next: Period) => {
    setIsRefreshing(true)
    try {
      const res = await fetch(`/api/dashboard-metrics?period=${next}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as DashboardMetricsResponse
      setData(json)
    } catch (error) {
      logger.error({ err: error, next }, 'dashboard: failed to refetch metrics')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (period === initialData.period) return
    void fetchForPeriod(period)
  }, [period, initialData.period, fetchForPeriod])

  return (
    <div className="mx-auto max-w-7xl px-4 py-section-md space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-content-gap">
        <div>
          <h1 className="text-heading-2xl font-bold">Analytics dashboard</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            Period: {data.period}
            {isRefreshing && <span className="ml-2 italic">refreshing…</span>}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} disabled={isRefreshing} />
      </header>

      <UserMetricsSection metrics={data.userMetrics} />
      <ContentCountsSection counts={data.contentCounts} />
      <EngagementSection engagement={data.engagement} />
      <RevenueSection revenue={data.revenueMetrics} />
    </div>
  )
}
