/**
 * API Route Auth + Quota Helpers
 *
 * Shared guards for /api/* routes that:
 *  1. Require an authenticated user (reject 401 for anonymous).
 *  2. Enforce a per-user chat quota (reject 429 when the user is over budget).
 *
 * Guest (unauthenticated) chat is no longer supported — every chat route
 * requires a session. See `docs/` history for the removed guest-session flow.
 *
 * Reuses:
 *  - `web-auth.ts` for session-token verification (the canonical auth path).
 *  - `services/chat-quota.ts` for the rolling-window authenticated-user quota.
 *
 * @fileType utility
 * @domain auth
 * @pattern guard
 * @ai-summary Drop-in guards for AI/paid-API routes — returns 401 for anonymous, 429 when over quota, otherwise proceeds.
 */
import { NextRequest, NextResponse } from 'next/server'

import { getSessionFromToken, tokenFromHeaders } from '@/infra/auth/web-auth'
import { checkAndIncrementChatQuota, getChatQuotaStatus } from '@/server/services/chat-quota'

type AuthedUser = { id: string }

export type GuardSuccess<T> = { ok: true; value: T }
export type GuardFailure = { ok: false; response: NextResponse }

function ok<T>(value: T): GuardSuccess<T> {
  return { ok: true, value }
}

function fail(response: NextResponse): GuardFailure {
  return { ok: false, response }
}

/**
 * Resolve the authenticated user from the request headers (cookie or bearer JWT).
 * Returns a 401 NextResponse if no valid session is present.
 */
export async function requireUser(
  request: NextRequest,
): Promise<GuardSuccess<AuthedUser> | GuardFailure> {
  const token = tokenFromHeaders(request.headers)
  const session = await getSessionFromToken(token)
  if (!session?.user?.id) {
    return fail(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  return ok({ id: String(session.user.id) })
}

/**
 * Enforce the authenticated-user chat quota. Increments atomically;
 * returns 429 when the user is over budget.
 */
export async function enforceUserChatQuota(
  userId: string,
): Promise<
  | GuardSuccess<{ questionsUsed: number; maxQuestions: number; resetAt: string | null }>
  | GuardFailure
> {
  const result = await checkAndIncrementChatQuota(userId)
  if (!result.allowed) {
    return fail(
      NextResponse.json(
        {
          error: 'Quota exceeded',
          questionsUsed: result.questionsUsed,
          maxQuestions: result.maxQuestions,
          resetAt: result.resetAt,
        },
        { status: 429 },
      ),
    )
  }
  return ok({
    questionsUsed: result.questionsUsed,
    maxQuestions: result.maxQuestions,
    resetAt: result.resetAt,
  })
}

/**
 * Require a session and enforce the chat quota in one step. Replaces the
 * former `enforceGuestOrUserChatQuota` now that guests cannot chat.
 */
export async function requireUserWithChatQuota(request: NextRequest): Promise<
  | GuardSuccess<{
      ownerId: string
      questionsUsed: number
      maxQuestions: number
      resetAt: string | null
    }>
  | GuardFailure
> {
  const auth = await requireUser(request)
  if (!auth.ok) return auth

  const quota = await enforceUserChatQuota(auth.value.id)
  if (!quota.ok) return quota

  return ok({
    ownerId: auth.value.id,
    questionsUsed: quota.value.questionsUsed,
    maxQuestions: quota.value.maxQuestions,
    resetAt: quota.value.resetAt,
  })
}

/**
 * Get the current chat quota status for the calling user. Used by the
 * `/api/agent/chat-quota` endpoint so the UI bar reflects server-enforced
 * state instead of a hardcoded `999`.
 */
export async function getUserChatQuotaStatus(userId: string) {
  const status = await getChatQuotaStatus(userId)
  return {
    allowed: status.allowed,
    questionsUsed: status.questionsUsed,
    maxQuestions: status.maxQuestions,
    resetAt: status.resetAt,
  }
}
