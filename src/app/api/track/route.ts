/**
 * Server-side analytics proxy.
 *
 * Receives events from the client tracker at /api/track and forwards them to
 * the external A-Guy Analytics dashboard at ${ANALYTICS_URL}/api/track.
 *
 * The route is the ONLY way client code reaches the dashboard — the
 * `ANALYTICS_INGEST_KEY` secret never leaves the server. The client tracker
 * posts here, never directly to the dashboard.
 *
 * Kill-switch: when NEXT_PUBLIC_ANALYTICS_ENABLED is anything other than the
 * literal string "true", the route short-circuits with `{ ok: true }` and
 * performs no forwarding. This keeps tracking off on environments where the
 * flag has not been flipped on, regardless of whether ANALYTICS_URL /
 * ANALYTICS_INGEST_KEY are set.
 *
 * The route never returns an error to the client. Failures are logged but
 * swallowed so analytics never breaks user-facing flows.
 */

// public endpoint: anonymous page visits need to reach the tracker

import type { NextRequest } from 'next/server'

import { logger } from '@/infra/utils/logger/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORWARD_TIMEOUT_MS = 5_000

function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
}

export async function POST(request: NextRequest): Promise<Response> {
  // public endpoint: anonymous page visits fire events before login
  if (!isAnalyticsEnabled()) {
    return Response.json({ ok: true })
  }

  const analyticsUrl = process.env.ANALYTICS_URL
  const ingestKey = process.env.ANALYTICS_INGEST_KEY

  if (!analyticsUrl || !ingestKey) {
    logger.warn(
      { hasUrl: Boolean(analyticsUrl), hasKey: Boolean(ingestKey) },
      'Analytics proxy called with kill-switch on but upstream env vars missing — dropping events',
    )
    return Response.json({ ok: true })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    // Empty / malformed body is treated as a no-op so a bad client never throws.
    return Response.json({ ok: true })
  }

  const target = `${analyticsUrl.replace(/\/$/, '')}/api/track`

  // Fire-and-forget. We intentionally do not await this fetch — analytics
  // must never block or fail the client response. Errors are captured by the
  // logger via the .catch handler.
  fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Track-Key': ingestKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    cache: 'no-store',
  }).catch((error) => {
    logger.warn(
      { err: error instanceof Error ? { message: error.message } : error, target },
      'Analytics proxy failed to forward events — swallowed',
    )
  })

  return Response.json({ ok: true })
}
