/**
 * /dashboard — admin-only analytics page.
 *
 * PR-B1: raw JSON dump of the metrics response so the perf target and
 * response shape can be verified live before the widget port (PR-B2)
 * replaces this with the real UI.
 *
 * Auth is server-side: non-admin cookie holders get a 403 rendering
 * instead of the dashboard. Anonymous requests get redirected to /login.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountRole } from '@/infra/auth/roles'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { computeDashboardMetrics } from '@/server/services/dashboard/metrics-service'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const requestHeaders = await headers()
  const user = await getWebUser(requestHeaders)

  if (!user?.id) {
    redirect('/login?returnTo=/dashboard')
  }
  if (user.role !== AccountRole.Admin) {
    return (
      <main className="p-card-padding-lg">
        <h1 className="text-heading-xl font-semibold mb-2">Admin access required</h1>
        <p className="text-muted-foreground">Your account is not authorized to view this page.</p>
      </main>
    )
  }

  const metrics = await computeDashboardMetrics('month')

  return (
    <main className="p-card-padding-lg">
      <h1 className="text-heading-xl font-semibold mb-4">Dashboard metrics (raw)</h1>
      <p className="text-muted-foreground mb-4">
        PR-B1 preview — real widgets ship in PR-B2. This raw JSON is here to verify the aggregation
        shape + perf target (&lt;500ms warm) live.
      </p>
      <pre className="bg-muted rounded-lg p-card-padding-sm overflow-auto text-body-xs leading-relaxed">
        {JSON.stringify(metrics, null, 2)}
      </pre>
    </main>
  )
}
