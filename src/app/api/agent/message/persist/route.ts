import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { requireUser } from '@/server/auth/api-auth'
import { appendMessage, getOrCreateConversation } from '@/server/web-api/chat'

const BodySchema = z.object({
  contextKey: z.string().min(1).max(200),
  content: z.string().min(1).max(8000),
})

const PERSIST_RATE_LIMIT_MAX = 30
const PERSIST_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const rate = await rateLimit({
    key: `chat:${auth.value.id}:message-persist`,
    limit: PERSIST_RATE_LIMIT_MAX,
    windowMs: PERSIST_RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  const conversation = await getOrCreateConversation(auth.value.id, parsed.data.contextKey)
  await appendMessage(String(conversation.id), { role: 'assistant', content: parsed.data.content })
  return NextResponse.json({ success: true })
}
