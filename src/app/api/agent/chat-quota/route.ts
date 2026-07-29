import { NextRequest, NextResponse } from 'next/server'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { getUserChatQuotaStatus, requireUser } from '@/server/auth/api-auth'

const CHAT_QUOTA_STATUS_RATE_LIMIT_MAX = 60
const CHAT_QUOTA_STATUS_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const rate = await rateLimit({
    key: `user:${auth.value.id}:agent-chat-quota`,
    limit: CHAT_QUOTA_STATUS_RATE_LIMIT_MAX,
    windowMs: CHAT_QUOTA_STATUS_RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  const status = await getUserChatQuotaStatus(auth.value.id)
  return NextResponse.json(status)
}
