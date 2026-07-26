import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { requireUser } from '@/server/auth/api-auth'
import { resetConversation } from '@/server/web-api/chat'

const BodySchema = z.object({ contextKey: z.string().min(1).max(200) })

const RESET_RATE_LIMIT_MAX = 20
const RESET_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const rate = await rateLimit({
    key: `chat:${auth.value.id}:reset-chat`,
    limit: RESET_RATE_LIMIT_MAX,
    windowMs: RESET_RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  const conversation = await resetConversation(auth.value.id, parsed.data.contextKey)
  return NextResponse.json({
    success: true,
    conversationId: conversation.id,
    contextKey: parsed.data.contextKey,
  })
}
