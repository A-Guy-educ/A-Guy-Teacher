// @vitest-environment node
/**
 * Integration tests: POST /api/bug-report
 *
 * Tests the bug-report endpoint end-to-end:
 *  1) Happy path: a well-formed body returns 200 with delivered=true and forwards
 *     the report to sendBugReport with the expected fields.
 *  2) Missing description returns 400 with an issue list.
 *  3) RESEND_API_KEY missing → sendBugReport returns no_adapter → API returns
 *     200 with delivered:false (no 500s in preview).
 *  4) Rate limit exceeded → 429 with Retry-After header.
 *
 * The route enforces a 3-per-5-minutes per-IP throttle on its own in-memory
 * cache, so we test it with a per-test IP/UA key combination and reset between
 * cases via the exported _reset helper.
 *
 * @fileType integration-test
 * @domain email
 * @pattern bug-report
 * @ai-summary Tests the /api/bug-report handler: validation, send, no-adapter fallback, and rate limit.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the bug-report service BEFORE importing the route so the route picks
// up the mocked module. We do not mock the email service for the happy-path
// test that proves the route constructs the right call surface — we mock it
// for the rate-limit and no-adapter tests so we can assert the return shape.
const { sendBugReportMock } = vi.hoisted(() => ({
  sendBugReportMock: vi.fn(),
}))
vi.mock('@/server/email/services/bug-report-service', () => ({
  sendBugReport: (...args: unknown[]) => sendBugReportMock(...args),
  _resetResendClient: vi.fn(),
  BUG_REPORT_RECIPIENT: 'office@guykoren.co.il',
}))

// Mock the auth helper so anonymous submits (the default) don't try to hit
// the user collection / sessions store. The route treats the result as
// optional anyway; we just want it to return null.
vi.mock('@/infra/web-api/mongo-payload', () => ({
  getWebUser: vi.fn(async () => null),
  getOrCreateGuestId: vi.fn(() => 'guest-test'),
  publicUserId: vi.fn(() => 'guest:test'),
  withGuestCookie: vi.fn((r: unknown) => r),
}))

let POST: (request: NextRequest) => Promise<Response>
let _resetBugReportRateLimitCache: () => void

function makeRequest(body: unknown, ip: string, userAgent: string): NextRequest {
  return new NextRequest('http://localhost/api/bug-report', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': userAgent,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  // Reset the route's in-memory rate limit cache between tests so a previous
  // test's quota doesn't bleed into the next one.
  if (!_resetBugReportRateLimitCache) {
    const routeMod = await import('@/app/api/bug-report/route')
    POST = routeMod.POST
    _resetBugReportRateLimitCache = routeMod._resetBugReportRateLimitCache
  } else {
    _resetBugReportRateLimitCache()
  }
  sendBugReportMock.mockReset()
  // Default to a successful send — individual tests override as needed.
  sendBugReportMock.mockResolvedValue({ delivered: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ─── Happy path ──────────────────────────────────────────────────────────────

describe('POST /api/bug-report', () => {
  it('happy path: forwards a well-formed report to sendBugReport and returns delivered:true', async () => {
    const req = makeRequest(
      {
        description: 'The page crashes when I open the dashboard',
        contactEmail: 'reporter@example.com',
        url: 'https://example.com/dashboard',
        userAgent: 'Mozilla/5.0 (test)',
      },
      '203.0.113.1',
      'agent-happy-1',
    )

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: boolean; delivered: boolean }
    expect(json.success).toBe(true)
    expect(json.delivered).toBe(true)

    expect(sendBugReportMock).toHaveBeenCalledTimes(1)
    const call = sendBugReportMock.mock.calls[0][0] as Record<string, unknown>
    expect(call.description).toBe('The page crashes when I open the dashboard')
    expect(call.contactEmail).toBe('reporter@example.com')
    expect(call.pageUrl).toBe('https://example.com/dashboard')
    expect(call.userAgent).toBe('Mozilla/5.0 (test)')
    // Per-request idempotency key must be present.
    expect(typeof call.idempotencyKey).toBe('string')
    expect((call.idempotencyKey as string).length).toBeGreaterThan(0)
  })

  it('works without an optional contactEmail (anonymous submitter)', async () => {
    const req = makeRequest(
      {
        description: 'No contact, just the bug.',
        url: 'https://example.com/page',
        userAgent: 'Mozilla/5.0 (anon)',
      },
      '203.0.113.2',
      'agent-happy-2',
    )

    const res = await POST(req)
    expect(res.status).toBe(200)
    const call = sendBugReportMock.mock.calls[0][0] as Record<string, unknown>
    // The hook drops the empty contactEmail before send; the API should pass
    // through whatever the client sent (undefined or null).
    expect(call.contactEmail == null).toBe(true)
  })

  // ─── Validation ────────────────────────────────────────────────────────────

  it('returns 400 when description is missing', async () => {
    const req = makeRequest(
      {
        // description omitted on purpose
        url: 'https://example.com/page',
        userAgent: 'Mozilla/5.0',
      },
      '203.0.113.10',
      'agent-bad-1',
    )

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string; issues: unknown[] }
    expect(json.error).toBe('invalid_body')
    expect(Array.isArray(json.issues)).toBe(true)
    expect(sendBugReportMock).not.toHaveBeenCalled()
  })

  it('returns 400 when description is below the 5-character minimum', async () => {
    const req = makeRequest(
      {
        description: 'no',
        url: 'https://example.com/page',
        userAgent: 'Mozilla/5.0',
      },
      '203.0.113.11',
      'agent-bad-2',
    )

    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(sendBugReportMock).not.toHaveBeenCalled()
  })

  it('returns 400 when body is not JSON', async () => {
    const req = new NextRequest('http://localhost/api/bug-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.12' },
      body: 'this is not json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('invalid_json')
    expect(sendBugReportMock).not.toHaveBeenCalled()
  })

  // ─── No adapter (RESEND_API_KEY missing) ──────────────────────────────────

  it('returns 200 with delivered:false when RESEND_API_KEY is missing (no 500 in preview)', async () => {
    sendBugReportMock.mockResolvedValueOnce({ delivered: false, reason: 'no_adapter' })

    const req = makeRequest(
      {
        description: 'In dev/preview with no Resend key configured.',
        url: 'https://example.com/page',
        userAgent: 'Mozilla/5.0',
      },
      '203.0.113.20',
      'agent-noadapter-1',
    )

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: boolean; delivered: boolean; reason: string }
    expect(json.success).toBe(true)
    expect(json.delivered).toBe(false)
    expect(json.reason).toBe('no_adapter')
  })

  it('returns 502 when sendBugReport reports a real send failure', async () => {
    sendBugReportMock.mockResolvedValueOnce({ delivered: false, reason: 'error' })

    const req = makeRequest(
      {
        description: 'Real Resend failure path.',
        url: 'https://example.com/page',
        userAgent: 'Mozilla/5.0',
      },
      '203.0.113.21',
      'agent-fail-1',
    )

    const res = await POST(req)
    expect(res.status).toBe(502)
    const json = (await res.json()) as { success: boolean; reason: string }
    expect(json.success).toBe(false)
    expect(json.reason).toBe('send_failed')
  })

  // ─── Rate limit ────────────────────────────────────────────────────────────

  it('returns 429 with Retry-After after the per-IP quota is exhausted', async () => {
    const ip = '203.0.113.30'
    const ua = 'agent-rl-1'

    // 3 sends should succeed (the route's MAX), the 4th should be blocked.
    for (let i = 0; i < 3; i++) {
      const res = await POST(
        makeRequest(
          {
            description: `Report number ${i + 1}`,
            url: 'https://example.com/page',
            userAgent: 'Mozilla/5.0',
          },
          ip,
          ua,
        ),
      )
      expect(res.status).toBe(200)
    }

    const blocked = await POST(
      makeRequest(
        {
          description: 'This one should be blocked.',
          url: 'https://example.com/page',
          userAgent: 'Mozilla/5.0',
        },
        ip,
        ua,
      ),
    )
    expect(blocked.status).toBe(429)
    const retryAfter = Number(blocked.headers.get('Retry-After'))
    expect(Number.isFinite(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThan(0)
    // The blocked call should not have reached the email service.
    expect(sendBugReportMock).toHaveBeenCalledTimes(3)
  })

  it('isolates the rate limit per (IP, user-agent) pair', async () => {
    const ip1 = '203.0.113.40'
    const ip2 = '203.0.113.41'
    const ua1 = 'agent-rl-iso-1'
    const ua2 = 'agent-rl-iso-2'

    // Burn through ip1+ua1's quota.
    for (let i = 0; i < 3; i++) {
      const res = await POST(
        makeRequest(
          { description: `burn ${i + 1}`, url: 'https://x', userAgent: 'Mozilla/5.0' },
          ip1,
          ua1,
        ),
      )
      expect(res.status).toBe(200)
    }

    // ip1+ua1 is now blocked
    const blocked = await POST(
      makeRequest({ description: 'blocked', url: 'https://x', userAgent: 'Mozilla/5.0' }, ip1, ua1),
    )
    expect(blocked.status).toBe(429)

    // ip2+ua2 still has its full quota — different IP and UA means different key.
    const fresh = await POST(
      makeRequest({ description: 'fresh', url: 'https://x', userAgent: 'Mozilla/5.0' }, ip2, ua2),
    )
    expect(fresh.status).toBe(200)
  })
})
