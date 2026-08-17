/**
 * User metrics — 22 fields grouped into three sub-blocks:
 *   1. Registered users (totals + recent windows)
 *   2. Active users (today/yesterday/lastWeek/lastMonth)
 *   3. Guest sessions + conversion + returning behavior
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import type { UserMetrics } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'

interface Props {
  metrics: UserMetrics
}

export function UserMetricsSection({ metrics }: Props) {
  return (
    <section className="space-y-6">
      <h2 className="text-heading-lg font-semibold">Users</h2>

      {/* Registered totals */}
      <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total users" value={metrics.totalUsers} />
        <MetricCard label="Registered yesterday" value={metrics.registeredYesterday} />
        <MetricCard label="This week" value={metrics.registeredThisWeek} />
        <MetricCard label="Last week" value={metrics.registeredLastWeek} />
        <MetricCard label="This month" value={metrics.registeredThisMonth} />
        <MetricCard label="Last month" value={metrics.registeredLastMonth} />
      </div>

      {/* Active users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">Active users</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-content-gap grid-cols-2 md:grid-cols-4">
            <MetricCard label="Today" value={metrics.activeUsersToday} />
            <MetricCard label="Yesterday" value={metrics.activeUsersYesterday} />
            <MetricCard label="Last week" value={metrics.activeUsersLastWeek} />
            <MetricCard label="Last month" value={metrics.activeUsersLastMonth} />
          </div>
        </CardContent>
      </Card>

      {/* Guests + returning */}
      <div className="grid gap-content-gap grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Guest sessions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3">
              <MetricCard label="Total" value={metrics.totalGuestSessions} />
              <MetricCard label="Today" value={metrics.guestSessionsToday} />
              <MetricCard label="Last week" value={metrics.guestSessionsLastWeek} />
              <MetricCard label="Last month" value={metrics.guestSessionsLastMonth} />
              <MetricCard label="Converted" value={metrics.guestToRegisteredCount} />
              <MetricCard
                label="Conversion"
                value={metrics.guestToRegisteredPercentage}
                suffix="%"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Returning</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3">
              <MetricCard
                label="Returning in period"
                value={metrics.returningUsers}
                hint={`out of ${metrics.returningUsersTotal.toLocaleString('he-IL')} pre-period users`}
              />
              <MetricCard
                label="Returned once"
                value={metrics.returnedOnceCount}
                hint={`${metrics.returnedOncePercentage}%`}
              />
              <MetricCard
                label="Returned >2x"
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
