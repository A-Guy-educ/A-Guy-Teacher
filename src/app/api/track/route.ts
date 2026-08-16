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
import { z } from 'zod'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { transformToDashboardEvent } from '@/server/services/analytics/dashboard-transform'
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
// Per-batch caps for the shape validator. `MAX_EVENTS_PER_BATCH` matches
// the tracker's flush ceiling (100 per the WEB_INTEGRATION_PROMPT.md
// contract). Per-event `properties` is capped at 4 KB serialized to keep
// a single event from consuming the whole 32 KB body budget on its own.
const MAX_EVENTS_PER_BATCH = 100
const MAX_PROPERTIES_JSON_BYTES = 4 * 1024

// Bounded event envelope — rejects unknown top-level fields via `.strict()`
// so a caller can't smuggle in extra data the dashboard might mis-index. All
// string fields have max lengths chosen against the concrete payloads the
// client tracker and server helper actually emit; `properties` is an
// arbitrary record, but capped in bytes below.
const AnalyticsEventSchema = z
  .object({
    event: z.string().min(1).max(64),
    session_id: z.string().max(64).optional(),
    user_id: z.string().max(64).optional(),
    properties: z
      .record(z.string(), z.unknown())
      .refine((props) => JSON.stringify(props).length <= MAX_PROPERTIES_JSON_BYTES, {
        message: 'properties too large',
      })
      .optional(),
    occurred_at: z.string().max(32).optional(),
  })
  .strict()

const AnalyticsBatchSchema = z
  .object({
    session_id: z.string().max(64).optional(),
    source: z.string().max(128).optional(),
    sent_at: z.string().max(32).optional(),
    events: z.array(AnalyticsEventSchema).max(MAX_EVENTS_PER_BATCH),
  })
  .strict()

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

  let rawPayload: unknown
  try {
    rawPayload = JSON.parse(rawBody)
  } catch {
    // Empty / malformed body is treated as a no-op so a bad client never throws.
    return Response.json({ ok: true })
  }

  // Shape validation — the endpoint is public and uses the private
  // ingest key on the caller's behalf, so accepting arbitrary JSON would
  // let anyone POST events attributed to another user_id, inflate
  // conversion counts, or push unknown-shaped rows into the dashboard.
  // We keep the response silent (200 { ok: true }) rather than 400 so
  // bad clients never see analytics as a broken API surface.
  const parsed = AnalyticsBatchSchema.safeParse(rawPayload)
  if (!parsed.success) {
    logger.warn(
      {
        ip: clientIp(request),
        issue: parsed.error.issues[0]?.message,
        path: parsed.error.issues[0]?.path.join('.'),
      },
      'Analytics proxy rejected malformed batch — dropped',
    )
    return Response.json({ ok: true })
  }
  const payload = parsed.data

  const outbound = {
    events: payload.events.map((event) =>
      transformToDashboardEvent(event, payload.session_id, payload.source),
    ),
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
        body: JSON.stringify(outbound),
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
