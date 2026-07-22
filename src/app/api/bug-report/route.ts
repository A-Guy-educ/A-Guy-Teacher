/**
 * POST /api/bug-report
 *
 * Receives a bug report from the in-app floating "Report a Bug" widget and forwards
 * it to office@guykoren.co.il via Resend. Anonymous-friendly (does not require
 * auth) but rate-limited per IP to keep the office inbox from being spammed.
 *
 * Body: { description: string, contactEmail?: string, url: string, userAgent: string }
 *
 * @fileType route
 * @domain email
 * @pattern bug-report
 * @ai-summary Validates a bug report, applies a per-IP rate limit, and emails it via Resend.
 */

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getWebUser } from '@/infra/web-api/mongo-payload'
import {
  _resetDurableRateLimit,
  rateLimit,
  rateLimitExceededResponse,
} from '@/infra/security/rate-limit'
import { logger } from '@/infra/utils/logger/logger'

import { sendBugReport } from '@/server/email/services/bug-report-service'

export const dynamic = 'force-dynamic'

const BUG_REPORT_RATE_LIMIT_MAX = 3
const BUG_REPORT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

const BodySchema = z.object({
  description: z
    .string()
    .trim()
    .min(5, 'description must be at least 5 characters')
    .max(5_000, 'description must be at most 5000 characters'),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .email('contactEmail must be a valid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  url: z.string().trim().min(1).max(2_000),
  userAgent: z.string().trim().min(1).max(1_000),
})

/**
 * Reset the durable rate-limit entries for this endpoint (testing only).
 * Delegates to the shared infra helper because the route no longer owns any
 * in-memory state.
 */
export function _resetBugReportRateLimitCache(): Promise<void> {
  return _resetDurableRateLimit()
}

function getClientKey(request: NextRequest): string {
  // Trust order: x-forwarded-for (first hop), x-real-ip, fallback to UA. We
  // intentionally avoid `request.ip` because Next doesn't always populate it
  // for route handlers — and we don't want a missing IP to silently disable
  // the throttle.
  const forwarded = request.headers.get('x-forwarded-for')
  const ip =
    (forwarded ? forwarded.split(',')[0]?.trim() : '') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const ua = request.headers.get('user-agent') || 'unknown-ua'
  return `bug-report:${ip}::${ua}`
}

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request)
  const rate = await rateLimit({
    key: clientKey,
    limit: BUG_REPORT_RATE_LIMIT_MAX,
    windowMs: BUG_REPORT_RATE_LIMIT_WINDOW_MS,
  })

  if (!rate.allowed) {
    logger.warn({ clientKeyPrefix: clientKey.slice(0, 32) }, 'Bug report: rate limit exceeded')
    return rateLimitExceededResponse(rate)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_body',
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
      { status: 400 },
    )
  }

  const { description, contactEmail, url, userAgent } = parsed.data

  // Best-effort: capture the authenticated user if there is one. The route
  // intentionally does NOT require auth so anonymous users can also report bugs.
  let authedUser: { id?: unknown; email?: string | null } | null = null
  try {
    const u = await getWebUser(request.headers)
    if (u) {
      authedUser = { id: u.id, email: (u as { email?: string | null }).email ?? null }
    }
  } catch {
    // Swallow — auth is optional for this endpoint.
  }

  const result = await sendBugReport({
    description,
    contactEmail: contactEmail ?? null,
    pageUrl: url,
    userAgent,
    userLocale: request.headers.get('accept-language')?.split(',')[0]?.trim(),
    userId: authedUser?.id != null ? String(authedUser.id) : null,
    userEmail: authedUser?.email ?? contactEmail ?? null,
    idempotencyKey: randomUUID(),
  })

  if (!result.delivered) {
    if (result.reason === 'no_adapter') {
      return NextResponse.json(
        { success: true, delivered: false, reason: 'no_adapter' },
        { status: 200 },
      )
    }
    return NextResponse.json(
      { success: false, delivered: false, reason: 'send_failed' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true, delivered: true })
}
