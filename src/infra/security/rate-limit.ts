/**
 * Durable Rate Limiter
 *
 * Serverless-safe per-key rate limit backed by a Mongo TTL collection. Every
 * call performs an atomic findOneAndUpdate so concurrent lambdas / cold
 * starts cannot race past the quota (the original in-memory Map in
 * bug-report/route.ts was trivially bypassed by fan-out — issue #937).
 *
 * Collection layout (`rate_limits`):
 *   { key: string (unique), count: int, expiresAt: Date (TTL) }
 *
 * Algorithm:
 *   - Filter by `key`. If `expiresAt > now`, increment `count`. Otherwise
 *     reset window: `count = 1`, `expiresAt = now + windowMs`.
 *   - Implemented as a single aggregation-pipeline update + upsert so the
 *     "active vs. expired" branch is decided server-side, atomically.
 *   - The TTL index is a cleanup convenience — correctness does NOT depend
 *     on it (the conditional update handles expired windows even on a
 *     single-node Mongo with no replica set).
 *
 * @fileType utility
 * @domain security
 * @pattern sliding-window-quota
 * @ai-summary Durable, serverless-safe rate limiter using a Mongo TTL collection with atomic upserts.
 */
import { NextResponse } from 'next/server'
import type { Collection } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

export const RATE_LIMIT_COLLECTION = 'rate_limits'
const TTL_INDEX_NAME = 'rate_limits_ttl'

interface RateLimitDoc {
  key: string
  count: number
  expiresAt: Date
}

export interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

let indexesEnsured: Promise<void> | null = null

async function ensureIndexes(collection: Collection<RateLimitDoc>): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = collection
      .createIndex({ key: 1 }, { unique: true, name: 'rate_limits_key_unique' })
      .then(() =>
        collection.createIndex({ expiresAt: 1 }, { name: TTL_INDEX_NAME, expireAfterSeconds: 0 }),
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        indexesEnsured = null
        logger.warn({ err }, 'Failed to ensure rate-limit indexes')
      })
  }
  return indexesEnsured
}

/**
 * Check (and atomically increment) the rate limit for `key`.
 *
 * Returns the post-increment state. `allowed` is false once `count` exceeds
 * `limit` — the caller is expected to translate that into 429 + Retry-After.
 */
export async function rateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  if (!key) throw new Error('rateLimit: key is required')
  if (limit <= 0) throw new Error('rateLimit: limit must be > 0')
  if (windowMs <= 0) throw new Error('rateLimit: windowMs must be > 0')

  const db = await getContentDb()
  const collection = db.collection<RateLimitDoc>(RATE_LIMIT_COLLECTION)
  await ensureIndexes(collection)

  const now = new Date()
  const newExpiresAt = new Date(now.getTime() + windowMs)

  // Aggregation-pipeline update: branch on whether the existing window is
  // still active (expiresAt > now). Active → increment count, keep expiresAt.
  // Expired or absent → reset to count=1, expiresAt=now+windowMs. Single
  // round-trip, atomic on the server.
  const updated = await collection.findOneAndUpdate(
    { key },
    [
      {
        $set: {
          count: {
            $cond: [
              {
                $and: [{ $ifNull: ['$expiresAt', false] }, { $gt: ['$expiresAt', now] }],
              },
              { $add: [{ $ifNull: ['$count', 0] }, 1] },
              1,
            ],
          },
          expiresAt: {
            $cond: [
              {
                $and: [{ $ifNull: ['$expiresAt', false] }, { $gt: ['$expiresAt', now] }],
              },
              '$expiresAt',
              newExpiresAt,
            ],
          },
          key: { $ifNull: ['$key', key] },
        },
      },
    ],
    { upsert: true, returnDocument: 'after' },
  )

  if (!updated) {
    // Should not happen with returnDocument:'after' on upsert, but guard
    // against driver quirks so callers always get a definitive verdict.
    return { allowed: true, remaining: limit - 1, resetAt: newExpiresAt.getTime(), limit }
  }

  const count = updated.count
  const allowed = count <= limit
  const remaining = Math.max(0, limit - count)

  if (!allowed) {
    logger.debug({ keyPrefix: key.slice(0, 32), count, limit }, 'Rate limit exceeded')
  }

  return {
    allowed,
    remaining,
    resetAt: updated.expiresAt.getTime(),
    limit,
  }
}

/**
 * Apply standard rate-limit headers to a Response.
 * Sets X-RateLimit-Limit / Remaining / Reset, plus Retry-After when blocked.
 */
export function applyRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))

  if (!result.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
    headers.set('Retry-After', String(retryAfterSeconds))
  }
}

/**
 * Build a 429 NextResponse that mirrors the bug-report route's existing
 * shape: { error: 'rate_limited', retryAfter } + standard headers.
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  const response = NextResponse.json({ error: 'rate_limited', retryAfter }, { status: 429 })
  applyRateLimitHeaders(response.headers, result)
  response.headers.set('Retry-After', String(retryAfter))
  return response
}

/**
 * Clear all durable rate-limit entries. Intended for tests; never call in
 * production paths.
 */
export async function _resetDurableRateLimit(): Promise<void> {
  const db = await getContentDb()
  await db.collection<RateLimitDoc>(RATE_LIMIT_COLLECTION).deleteMany({})
}
