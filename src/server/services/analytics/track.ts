/**
 * Server-side helper for pushing analytics events to the external dashboard.
 *
 * Mirrors the public /api/track contract but lives in the server-side service
 * layer so action handlers (signup, course enroll, ...) can fire events with
 * a normal function call instead of issuing a fetch.
 *
 * Latency: the outbound fetch runs via `after()` from `next/server`, so an
 * awaited call at the site (`await trackServerEvent(...)`) does not block
 * the user-visible response on the dashboard's roundtrip. Callers may await
 * or not — either way the network I/O happens post-response. When invoked
 * outside a request context (crons, scripts, tests) we fall back to a plain
 * fire-and-forget promise so `after()` doesn't throw.
 *
 * Envelope: sends the same `{ events, sent_at }` batch shape as the client
 * tracker, minus `session_id` / `source` because server-fired events do not
 * belong to any tab session and have no acquisition attribution — the
 * dashboard should treat those two fields as optional for that reason.
 *
 * Kill-switch: when NEXT_PUBLIC_ANALYTICS_ENABLED is anything other than
 * "true", the helper returns immediately without forwarding. This keeps
 * tracking inert on environments where it has not been enabled, regardless
 * of whether ANALYTICS_URL / ANALYTICS_INGEST_KEY are set.
 *
 * Failures are swallowed: analytics must never break user-facing flows.
 */

import { after } from 'next/server'

import { logger } from '@/infra/utils/logger/logger'

export type AnalyticsEvent = {
  event: string
  session_id?: string
  user_id?: string
  properties?: Record<string, unknown>
  occurred_at?: string
}

export type AnalyticsBatch = {
  sent_at: string
  events: AnalyticsEvent[]
}

const FORWARD_TIMEOUT_MS = 5_000

function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
}

async function forwardEvent(
  target: string,
  ingestKey: string,
  payload: AnalyticsBatch,
  eventName: string,
): Promise<void> {
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
        event: eventName,
      },
      'trackServerEvent failed — swallowed',
    )
  }
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

  const target = `${analyticsUrl.replace(/\/+$/, '')}/api/track`
  const payload: AnalyticsBatch = {
    sent_at: new Date().toISOString(),
    events: [{ ...event, occurred_at: event.occurred_at ?? new Date().toISOString() }],
  }

  try {
    after(() => forwardEvent(target, ingestKey, payload, event.event))
  } catch {
    // Called outside a request context (script, cron, test). Drop back to a
    // plain fire-and-forget so the caller does not fail.
    void forwardEvent(target, ingestKey, payload, event.event)
  }
}
