/**
 * API Route Auth + Quota Helpers
 *
 * Shared guards for /api/* routes that:
 *  1. Require an authenticated user (reject 401 for anonymous).
 *  2. Enforce a per-user chat quota (reject 429 when the user is over budget).
 *  3. Allow guests with a separate guest quota for endpoints that are
 *     intentionally guest-accessible (chat, chat/stream, learning-chat).
 *
 * Reuses:
 *  - `web-auth.ts` for session-token verification (the canonical auth path).
 *  - `services/chat-quota.ts` for the rolling-window authenticated-user quota.
 *  - `services/guest-session.ts` for guest sessions + atomic message counting.
 *
 * @fileType utility
 * @domain auth
 * @pattern guard
 * @ai-summary Drop-in guards for AI/paid-API routes — returns 401 for anonymous, 429 when over quota, otherwise proceeds.
 */
import { NextRequest, NextResponse } from 'next/server'

import { getSessionFromToken, tokenFromHeaders } from '@/infra/auth/web-auth'
import { getPayload } from '@/infra/types/backend'
import { checkAndIncrementChatQuota, getChatQuotaStatus } from '@/server/services/chat-quota'
import {
  checkAndIncrementGuestMessageCount,
  createGuestSession,
  getGuestSessionByToken,
  getGuestSessionCookie,
} from '@/server/services/guest-session'

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
  const payload = await getPayload()
  const result = await checkAndIncrementChatQuota(payload, userId)
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
 * Enforce a quota for endpoints that may be reached by guests.
 * - Authenticated users: authenticated rolling-window chat quota.
 * - Guests: per-session message count backed by the `guest-sessions` collection
 *   (atomic findOneAndUpdate, exactly the same shape as `guest-session.ts`).
 *
 * Lazily creates a guest session when a guest cookie is not yet known, and
 * returns the cookie token so callers can attach it to the response.
 */
export async function enforceGuestOrUserChatQuota(request: NextRequest): Promise<
  | GuardSuccess<{
      ownerId: string
      isGuest: boolean
      questionsUsed: number
      maxQuestions: number
      resetAt: string | null
      guestCookieToken?: string
    }>
  | GuardFailure
> {
  const token = tokenFromHeaders(request.headers)
  const session = await getSessionFromToken(token)

  if (session?.user?.id) {
    const quota = await enforceUserChatQuota(String(session.user.id))
    if (!quota.ok) return quota
    return ok({
      ownerId: String(session.user.id),
      isGuest: false,
      questionsUsed: quota.value.questionsUsed,
      maxQuestions: quota.value.maxQuestions,
      resetAt: quota.value.resetAt,
    })
  }

  const payload = await getPayload()
  const cookieToken = getGuestSessionCookie(request.headers)

  let guestSession = cookieToken ? await getGuestSessionByToken(payload, cookieToken) : null
  let guestCookieToken: string | undefined
  if (!guestSession) {
    const created = await createGuestSession(payload, {})
    guestSession = created.session
    guestCookieToken = created.token
  }

  const limit = await checkAndIncrementGuestMessageCount(payload, guestSession.id)
  if (!limit.allowed) {
    return fail(
      NextResponse.json(
        {
          error: 'Quota exceeded',
          questionsUsed: limit.current,
          maxQuestions: limit.max,
          resetAt: null,
        },
        { status: 429 },
      ),
    )
  }

  return ok({
    ownerId: `guest:${guestSession.id}`,
    isGuest: true,
    questionsUsed: limit.current,
    maxQuestions: limit.max,
    resetAt: null,
    guestCookieToken,
  })
}

/**
 * Get the current chat quota status for the calling user. Used by the
 * `/api/agent/chat-quota` endpoint so the UI bar reflects server-enforced
 * state instead of a hardcoded `999`.
 */
export async function getUserChatQuotaStatus(userId: string) {
  const payload = await getPayload()
  const status = await getChatQuotaStatus(payload, userId)
  return {
    allowed: status.allowed,
    questionsUsed: status.questionsUsed,
    maxQuestions: status.maxQuestions,
    resetAt: status.resetAt,
  }
}
