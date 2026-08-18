/**
 * GET /api/dashboard-metrics?period=week|month|year
 *
 * Admin-only endpoint powering the /dashboard page. Ported from the Payload
 * admin's /api/admin/dashboard-metrics but rewritten as raw-MongoDB $facet
 * aggregations to hit the <500ms warm perf target (the original serialized
 * 40+ ORM calls and timed out on Vercel).
 *
 * Response shape is unchanged — see DashboardMetricsResponse.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AccountRole } from '@/infra/auth/roles'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { logger } from '@/infra/utils/logger/logger'
import { computeDashboardMetrics } from '@/server/services/dashboard/metrics-service'
import { VALID_PERIODS, type Period } from '@/server/services/dashboard/metrics-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isValidPeriod(value: string | null): value is Period {
  return value !== null && (VALID_PERIODS as readonly string[]).includes(value)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getWebUser(request.headers)
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== AccountRole.Admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const periodParam = request.nextUrl.searchParams.get('period')
  if (periodParam !== null && !isValidPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }
  const period: Period = periodParam ?? 'month'

  const startedAt = Date.now()
  try {
    const data = await computeDashboardMetrics(period)
    const durationMs = Date.now() - startedAt
    logger.info({ durationMs, period, userId: user.id }, 'dashboard-metrics: computed successfully')
    return NextResponse.json(data, {
      headers: {
        // no-store matches the repo's convention for auth-required endpoints
        // (see /api/health, /api/agent/chat/stream). Browser HTTP cache is
        // keyed by URL, not session, so a `private, max-age` header would
        // let a second browser user see the cached admin response after the
        // admin logged out. Server-Timing stays for perf verification.
        'Cache-Control': 'no-store',
        'Server-Timing': `total;dur=${durationMs}`,
      },
    })
  } catch (error) {
    logger.error(
      {
        err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        durationMs: Date.now() - startedAt,
        period,
      },
      'dashboard-metrics: aggregation failed',
    )
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 })
  }
}
