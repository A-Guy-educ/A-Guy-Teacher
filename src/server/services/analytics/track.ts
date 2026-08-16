/**
 * Server-side helper for pushing analytics events to the external dashboard.
 *
 * Mirrors the public /api/track contract but lives in the server-side service
 * layer so action handlers (signup, course enroll, ...) can fire events with
 * a normal function call instead of issuing a fetch.
 *
 * Kill-switch: when NEXT_PUBLIC_ANALYTICS_ENABLED is anything other than
 * "true", the helper returns immediately without forwarding. This keeps
 * tracking inert on environments where it has not been enabled, regardless
 * of whether ANALYTICS_URL / ANALYTICS_INGEST_KEY are set.
 *
 * Failures are swallowed: analytics must never break user-facing flows.
 */

import { logger } from '@/infra/utils/logger/logger'

export type AnalyticsEvent = {
  event: string
  session_id?: string
  user_id?: string
  properties?: Record<string, unknown>
  occurred_at?: string
}

export type AnalyticsBatch = {
  events: AnalyticsEvent[]
}

const FORWARD_TIMEOUT_MS = 5_000

function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
}

export async function trackServerEvent(event: AnalyticsEvent): Promise<void> {
  if (!isAnalyticsEnabled()) return

  const analyticsUrl = process.env.ANALYTICS_URL
  const ingestKey = process.env.ANALYTICS_INGEST_KEY

  if (!analyticsUrl || !ingestKey) {
    logger.warn(
      { hasUrl: Boolean(analyticsUrl), hasKey: Boolean(ingestKey), event: event.event },
      'trackServerEvent skipped — kill-switch on or upstream env vars missing',
    )
    return
  }

  const target = `${analyticsUrl.replace(/\/$/, '')}/api/track`
  const payload: AnalyticsBatch = {
    events: [{ ...event, occurred_at: event.occurred_at ?? new Date().toISOString() }],
  }

  try {
    await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Track-Key': ingestKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (error) {
    logger.warn(
      {
        err: error instanceof Error ? { message: error.message } : error,
        target,
        event: event.event,
      },
      'trackServerEvent failed — swallowed',
    )
  }
}
