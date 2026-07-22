// @vitest-environment node
/**
 * Integration tests: Durable Rate Limiter (issue #937)
 *
 * Verifies that `rateLimit()` from `@/infra/security/rate-limit` enforces
 * quotas atomically across a Mongo-backed TTL collection — i.e. the
 * "N+1th request within window → 429" acceptance criterion, plus the
 * per-endpoint and per-key isolation that makes the helper reusable for
 * both anonymous (bug-report) and authenticated (AI endpoints) routes.
 *
 * @fileType integration-test
 * @domain security
 * @pattern rate-limiting
 * @ai-summary Tests the durable Mongo-backed rate limiter helper end-to-end.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { startMongoContainer } from '@/infra/utils/test/mongodb-container'
import {
  _resetDurableRateLimit,
  applyRateLimitHeaders,
  rateLimit,
  rateLimitExceededResponse,
} from '@/infra/security/rate-limit'

let mongoStarted = false

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = await startMongoContainer()
    mongoStarted = true
  }
})

afterAll(async () => {
  if (mongoStarted) delete process.env.DATABASE_URL
})

beforeEach(async () => {
  await _resetDurableRateLimit()
})

describe('durable rateLimit helper', () => {
  it('allows N requests and blocks the (N+1)th within the window', async () => {
    const opts = { key: 'rl-test:basic', limit: 3, windowMs: 60_000 }

    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(opts)
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(3 - (i + 1))
    }

    const blocked = await rateLimit(opts)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.resetAt).toBeGreaterThan(Date.now())
  })

  it('resets the counter once the window expires', async () => {
    const opts = { key: 'rl-test:window', limit: 2, windowMs: 60 }

    expect((await rateLimit(opts)).allowed).toBe(true)
    expect((await rateLimit(opts)).allowed).toBe(true)
    expect((await rateLimit(opts)).allowed).toBe(false)

    // Wait out the window. 80ms is generous for a 60ms window on a
    // single-node Mongo where date arithmetic is millisecond-precise.
    await new Promise((resolve) => setTimeout(resolve, 120))

    const afterReset = await rateLimit(opts)
    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(1)
  })

  it('isolates keys (different keys do not share a quota)', async () => {
    const a = { key: 'rl-test:iso-a', limit: 2, windowMs: 60_000 }
    const b = { key: 'rl-test:iso-b', limit: 2, windowMs: 60_000 }

    expect((await rateLimit(a)).allowed).toBe(true)
    expect((await rateLimit(a)).allowed).toBe(true)
    expect((await rateLimit(a)).allowed).toBe(false)

    // b is untouched: first call should report 1 remaining (count=1 of limit=2)
    const firstB = await rateLimit(b)
    expect(firstB.allowed).toBe(true)
    expect(firstB.remaining).toBe(1)
  })

  it('returns the same resetAt for calls within the same window', async () => {
    const opts = { key: 'rl-test:reset', limit: 5, windowMs: 60_000 }
    const first = await rateLimit(opts)
    const second = await rateLimit(opts)
    expect(second.resetAt).toBe(first.resetAt)
  })

  it('rejects invalid options', async () => {
    await expect(rateLimit({ key: '', limit: 1, windowMs: 1000 })).rejects.toThrow(
      /key is required/,
    )
    await expect(rateLimit({ key: 'x', limit: 0, windowMs: 1000 })).rejects.toThrow(
      /limit must be > 0/,
    )
    await expect(rateLimit({ key: 'x', limit: 1, windowMs: 0 })).rejects.toThrow(
      /windowMs must be > 0/,
    )
  })

  it('applyRateLimitHeaders sets X-RateLimit-* and Retry-After when blocked', () => {
    const headers = new Headers()
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      limit: 5,
    }
    applyRateLimitHeaders(headers, result)

    expect(headers.get('X-RateLimit-Limit')).toBe('5')
    expect(headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(headers.get('X-RateLimit-Reset')).toBeTruthy()
    const retryAfter = Number(headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(30)
  })

  it('rateLimitExceededResponse returns 429 with the bug-report response shape', () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      limit: 3,
    }
    const response = rateLimitExceededResponse(result)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeTruthy()
    expect(response.headers.get('X-RateLimit-Limit')).toBe('3')
    return response.json().then((body: any) => {
      expect(body.error).toBe('rate_limited')
      expect(body.retryAfter).toBeGreaterThan(0)
    })
  })
})
