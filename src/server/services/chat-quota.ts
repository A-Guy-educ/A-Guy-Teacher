/**
 * Chat Quota Service
 *
 * @fileType service
 * @domain chat
 * @pattern rolling-window-quota
 * @ai-summary Checks and increments authenticated user chat quota (rolling window)
 */
import { ObjectId, type Collection, type Document } from 'mongodb'
import { getContentDb } from '@/infra/db/content-db'
import { getChatConfig } from '@/infra/llm/providers/shared/chat-config'
import { hoursToMs } from '@/infra/utils/time'

const QUOTA_DEFAULTS = { maxQuestions: 15, windowHours: 12 }

export interface ChatQuotaResult {
  allowed: boolean
  questionsUsed: number
  maxQuestions: number
  resetAt: string | null
}

async function getQuotaConfig() {
  try {
    const config = await getChatConfig()
    return { ...QUOTA_DEFAULTS, ...config.quota }
  } catch {
    return QUOTA_DEFAULTS
  }
}

async function getUsersCollection(): Promise<Collection<Document>> {
  const db = await getContentDb()
  return db.collection('users')
}

/**
 * Check if user has quota remaining and increment if so.
 * Uses a rolling window: if windowStart + windowHours has passed, reset the counter.
 * Uses atomic findOneAndUpdate to prevent race conditions.
 */
export async function checkAndIncrementChatQuota(userId: string): Promise<ChatQuotaResult> {
  const { maxQuestions, windowHours } = await getQuotaConfig()
  const now = new Date()
  const windowMs = hoursToMs(windowHours)
  const cutoffDate = new Date(now.getTime() - windowMs) // time before which window is expired

  if (!ObjectId.isValid(userId)) {
    return { allowed: false, questionsUsed: 0, maxQuestions, resetAt: null }
  }

  const collection = await getUsersCollection()
  const _id = new ObjectId(userId)

  // Try atomic increment (window still valid)
  let result = await collection.findOneAndUpdate(
    {
      _id,
      chatWindowStart: { $gte: cutoffDate }, // window not expired
      chatQuestionsUsed: { $lt: maxQuestions },
    },
    { $inc: { chatQuestionsUsed: 1 } },
    { returnDocument: 'after' },
  )

  if (result) {
    const resetAt = new Date(new Date(result.chatWindowStart).getTime() + windowMs).toISOString()
    return { allowed: true, questionsUsed: result.chatQuestionsUsed, maxQuestions, resetAt }
  }

  // Window expired, or never started — a user who has never chatted has no
  // `chatWindowStart` at all, and Mongo range operators are type-bracketed so
  // a missing field matches neither `$gte` nor `$lt`. Match it explicitly.
  result = await collection.findOneAndUpdate(
    {
      _id,
      $or: [
        { chatWindowStart: { $lt: cutoffDate } },
        { chatWindowStart: null },
        { chatWindowStart: { $exists: false } },
      ],
    },
    { $set: { chatWindowStart: now, chatQuestionsUsed: 1 } },
    { returnDocument: 'after' },
  )

  if (result) {
    // New window started at `now`, one question consumed
    const resetAt = new Date(now.getTime() + windowMs).toISOString()
    return { allowed: true, questionsUsed: 1, maxQuestions, resetAt }
  }

  // Both atomics missed: the user is at the limit inside a valid window, or the
  // user does not exist. Fail closed either way — never grant a free request.
  const fresh = await collection.findOne({ _id })
  const windowStart = fresh?.chatWindowStart ? new Date(fresh.chatWindowStart) : null
  const questionsUsed = fresh?.chatQuestionsUsed ?? maxQuestions
  const resetAt = windowStart ? new Date(windowStart.getTime() + windowMs).toISOString() : null

  return { allowed: false, questionsUsed, maxQuestions, resetAt }
}

/**
 * Get current quota status without incrementing.
 */
export async function getChatQuotaStatus(userId: string): Promise<ChatQuotaResult> {
  const { maxQuestions, windowHours } = await getQuotaConfig()
  const now = new Date()

  if (!ObjectId.isValid(userId)) {
    return { allowed: false, questionsUsed: 0, maxQuestions, resetAt: null }
  }

  const collection = await getUsersCollection()
  const user = await collection.findOne({ _id: new ObjectId(userId) })
  const windowStart = user?.chatWindowStart ? new Date(user.chatWindowStart) : null
  let questionsUsed = user?.chatQuestionsUsed ?? 0

  const windowMs = hoursToMs(windowHours)
  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs

  if (windowExpired) {
    questionsUsed = 0
  }

  const resetAt =
    windowStart && !windowExpired ? new Date(windowStart.getTime() + windowMs).toISOString() : null

  return {
    allowed: questionsUsed < maxQuestions,
    questionsUsed,
    maxQuestions,
    resetAt,
  }
}
