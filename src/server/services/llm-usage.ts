/**
 * LLM token usage accounting.
 *
 * Two write paths per LLM call:
 *   1. A row in `llm-usage` (event log) so dashboard aggregations can slice
 *      by any time window and by lessonId (unlocks top-lessons-by-tokens
 *      + today/month/year totals).
 *   2. `$inc users.llmTokensUsed` for the per-user counter that drives
 *      rate limiting. Reset happens on the first increment of a new
 *      calendar month.
 *
 * The user-side fields (`llmTokensUsed`, `llmTokensLimit`, `llmTokensResetAt`)
 * are declared in the A-Guy-Admin Payload user schema (PR #337, shipped to
 * admin prod). Payload's `access.create` / `access.update` are `() => false`
 * on those fields, so any Payload write path is a no-op — Web must always
 * write via the raw driver, mirroring the existing chat-quota pattern.
 *
 * @fileType service
 * @domain llm
 * @pattern counter-collection + user-schema-counter
 * @ai-summary Per-call token event log + per-user monthly counter with rate-limit check
 */

import { ObjectId, type Collection, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

const USAGE_COLLECTION = 'llm-usage'
const USERS_COLLECTION = 'users'

export type LlmCallType = 'chat' | 'chat_stream' | 'embedding' | 'lesson_variation' | 'other'

export interface RecordLlmUsageInput {
  userId: string
  lessonId?: string | null
  inputTokens: number
  outputTokens: number
  model?: string
  callType?: LlmCallType
}

export interface TokenLimitStatus {
  withinLimit: boolean
  used: number
  limit: number | null
  resetAt: string | null
}

let indexPromise: Promise<void> | null = null

async function ensureUsageIndexes(): Promise<void> {
  indexPromise ??= (async () => {
    const db = await getContentDb()
    try {
      const c = db.collection(USAGE_COLLECTION)
      // createdAt for time-window aggregations (today/month/year totals).
      await c.createIndex({ createdAt: -1 }, { name: 'llm_usage_created_at_desc' })
      // Compound for "top lessons by tokens" — group by lessonId first.
      await c.createIndex({ lessonId: 1, createdAt: -1 }, { name: 'llm_usage_lesson_created_at' })
      // Compound for per-user drill-downs.
      await c.createIndex({ userId: 1, createdAt: -1 }, { name: 'llm_usage_user_created_at' })
    } catch (err) {
      indexPromise = null
      logger.warn({ err }, 'Failed to ensure llm-usage indexes')
    }
  })()
  return indexPromise
}

/** First moment of the *next* calendar month at server-local time. */
function startOfNextCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

async function usersCollection(): Promise<Collection<Document>> {
  const db = await getContentDb()
  return db.collection(USERS_COLLECTION)
}

/**
 * Bump the user's monthly counter. If the stored `llmTokensResetAt` is in
 * the past (or missing), reset to just the incoming delta and stamp a new
 * next-month reset. Otherwise `$inc` onto the existing counter.
 *
 * Two atomic branches, same pattern as chat-quota — never grants a free
 * write if a concurrent update landed between them.
 */
async function bumpUserCounter(userId: string, delta: number): Promise<void> {
  if (!ObjectId.isValid(userId) || delta <= 0) return
  const users = await usersCollection()
  const _id = new ObjectId(userId)
  const now = new Date()
  const nextReset = startOfNextCalendarMonth(now)

  // Branch 1: existing window is still valid — plain $inc.
  const bumped = await users.findOneAndUpdate(
    { _id, llmTokensResetAt: { $gt: now } },
    { $inc: { llmTokensUsed: delta } },
    { returnDocument: 'after' },
  )
  if (bumped) return

  // Branch 2: window expired OR field missing — reset counter + stamp
  // next-month reset. The `$or` matches all "no valid window" states
  // because Mongo range operators are type-bracketed and won't match a
  // missing field via `$lte`.
  const reset = await users.updateOne(
    {
      _id,
      $or: [
        { llmTokensResetAt: { $lte: now } },
        { llmTokensResetAt: null },
        { llmTokensResetAt: { $exists: false } },
      ],
    },
    { $set: { llmTokensUsed: delta, llmTokensResetAt: nextReset } },
  )
  if (reset.matchedCount > 0) return

  // Branch 3: a concurrent call already stamped a valid window between
  // branches 1 and 2 — apply the delta as a plain $inc so no tokens are
  // silently dropped in that race window.
  await users.updateOne({ _id, llmTokensResetAt: { $gt: now } }, { $inc: { llmTokensUsed: delta } })
}

/**
 * Record one LLM call. Fire-and-forget-safe at the call site — errors are
 * logged but swallowed so a tracking failure never breaks the chat reply.
 */
export async function recordLlmUsage(input: RecordLlmUsageInput): Promise<void> {
  const totalTokens = Math.max(0, Math.floor(input.inputTokens + input.outputTokens))
  if (totalTokens <= 0) return
  if (!ObjectId.isValid(input.userId)) return

  try {
    await ensureUsageIndexes()
    const db = await getContentDb()
    const now = new Date()
    await db.collection(USAGE_COLLECTION).insertOne({
      userId: input.userId,
      lessonId: input.lessonId ?? null,
      inputTokens: Math.max(0, Math.floor(input.inputTokens)),
      outputTokens: Math.max(0, Math.floor(input.outputTokens)),
      totalTokens,
      model: input.model ?? null,
      callType: input.callType ?? 'other',
      createdAt: now,
    })
    await bumpUserCounter(input.userId, totalTokens)
  } catch (err) {
    logger.warn({ err, userId: input.userId }, 'recordLlmUsage failed — swallowed')
  }
}

/**
 * Read-only limit check. Called before the LLM invocation so the route
 * can 429 before spending on the model. `withinLimit: true` when either
 * (a) no `llmTokensLimit` is set (no cap) or (b) the current-month usage
 * is strictly less than the limit.
 *
 * Doesn't perform the calendar reset itself — if the last recorded
 * `llmTokensResetAt` is in the past, current usage is treated as 0 so an
 * expired-window user isn't blocked from making their first call of the
 * new month. `bumpUserCounter` handles the actual reset write.
 */
export async function checkTokenLimit(userId: string): Promise<TokenLimitStatus> {
  if (!ObjectId.isValid(userId)) {
    return { withinLimit: false, used: 0, limit: null, resetAt: null }
  }
  const users = await usersCollection()
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { llmTokensUsed: 1, llmTokensLimit: 1, llmTokensResetAt: 1 } },
  )
  const now = new Date()
  const resetAt: Date | null = user?.llmTokensResetAt ? new Date(user.llmTokensResetAt) : null
  const windowExpired = !resetAt || resetAt <= now
  const rawLimit =
    typeof user?.llmTokensLimit === 'number' && user.llmTokensLimit > 0 ? user.llmTokensLimit : null
  const used = windowExpired ? 0 : Number(user?.llmTokensUsed ?? 0)

  return {
    withinLimit: rawLimit === null || used < rawLimit,
    used,
    limit: rawLimit,
    resetAt: resetAt && !windowExpired ? resetAt.toISOString() : null,
  }
}
