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
 * performs no forwarding. Server-side gate is authoritative — the
 * `NEXT_PUBLIC_` client-side check is inlined at build time (see
 * src/lib/analytics/tracker.ts), so an env flip alone does not disable
 * already-shipped client bundles; the server proxy here catches the residual
 * traffic until the next deploy.
 *
 * The route never returns an error to the client. Failures are logged but
 * swallowed so analytics never breaks user-facing flows.
 */

import { after } from 'next/server'
import type { NextRequest } from 'next/server'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { logger } from '@/infra/utils/logger/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORWARD_TIMEOUT_MS = 5_000
// 32 KB matches ~200 typical events at 150 bytes each — well above the
// tracker's MAX_BATCH_SIZE (50) worst case and below the level where a
// single request could exhaust the runtime.
const MAX_BODY_BYTES = 32 * 1024
// Public endpoint, so the limit is per-IP (there is no user). 60 batches
// per minute is generous for a tab that flushes every 5 s (12/min upper
// bound) yet still contains a burst attempt to poison / amplify.
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 60_000

function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
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

  // Per-IP rate limit — public endpoint using the private ingest key on the
  // caller's behalf, so an unbounded flood would poison the dashboard and
  // amplify a request into a paid outbound.
  const rate = await rateLimit({
    key: `track:ip:${clientIp(request)}`,
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  // Content-Length pre-check — reject oversized bodies before parsing so a
  // malicious 100 MB body cannot exhaust the Node runtime via request.json().
  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ ok: true })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return Response.json({ ok: true })
  }
  // Second gate — the header can lie or be absent. Enforce on the actual
  // bytes we just read.
  if (rawBody.length > MAX_BODY_BYTES) {
    return Response.json({ ok: true })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    // Empty / malformed body is treated as a no-op so a bad client never throws.
    return Response.json({ ok: true })
  }

  const target = `${analyticsUrl.replace(/\/+$/, '')}/api/track`

  // Vercel's Node.js serverless containers can freeze right after the
  // response is sent — a bare fire-and-forget fetch may be dropped mid-flight
  // and silently lose events. `after()` tells the runtime to keep the
  // instance alive until the callback resolves.
  after(async () => {
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
        { err: error instanceof Error ? { message: error.message } : error, target },
        'Analytics proxy failed to forward events — swallowed',
      )
    }
  })

  return Response.json({ ok: true })
}
