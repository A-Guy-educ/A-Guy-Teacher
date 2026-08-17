/**
 * /dashboard — admin-only analytics page.
 *
 * Server-side auth gate + SSR-fetched initial metrics for the default
 * period; the client shell owns period changes and re-fetches. Anonymous
 * requests redirect to /login; non-admin cookie holders get a 403 panel.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountRole } from '@/infra/auth/roles'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { computeDashboardMetrics } from '@/server/services/dashboard/metrics-service'

import { DashboardShell } from './_components/DashboardShell'

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
    <main>
      <DashboardShell initialData={metrics} />
    </main>
  )
}
