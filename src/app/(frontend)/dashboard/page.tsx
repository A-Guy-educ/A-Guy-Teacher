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
import { NotAuthorizedPanel } from './_components/NotAuthorizedPanel'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const requestHeaders = await headers()
  const user = await getWebUser(requestHeaders)

  if (!user?.id) {
    redirect('/login?returnTo=/dashboard')
  }
  if (user.role !== AccountRole.Admin) {
    return <NotAuthorizedPanel />
  }

  const metrics = await computeDashboardMetrics('month')

  return (
    <main>
      <DashboardShell initialData={metrics} />
    </main>
  )
}
