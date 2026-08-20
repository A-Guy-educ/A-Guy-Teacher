import { redirect } from 'next/navigation'

import { VALID_PERIODS, type Period } from '@/server/services/dashboard/metrics-types'

const DASHBOARD_URL = 'https://dash.aguy.co.il/'

function requestedPeriod(value: string | string[] | undefined): Period | undefined {
  const period = Array.isArray(value) ? value[0] : value
  return VALID_PERIODS.includes(period as Period) ? (period as Period) : undefined
}

export default async function DashboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>
}) {
  const { period } = await searchParams
  const destination = new URL(DASHBOARD_URL)
  const validPeriod = requestedPeriod(period)

  if (validPeriod) destination.searchParams.set('period', validPeriod)

  redirect(destination.toString())
}
