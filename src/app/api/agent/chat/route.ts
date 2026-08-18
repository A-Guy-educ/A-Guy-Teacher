import { after, NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { requireUserWithChatQuota } from '@/server/auth/api-auth'
import { CHAT_ASSET_MAX_ATTACHMENTS } from '@/server/chat-assets/constants'
import { checkTokenLimit, recordLlmUsage } from '@/server/services/llm-usage'
import {
  appendMessage,
  generateAssistantReply,
  getOrCreateConversation,
  resolveContextKey,
} from '@/server/web-api/chat'

const MAX_MESSAGE_LENGTH = 4000
const MAX_CONTEXT_KEY_LENGTH = 200

const BodySchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  acknowledgment: z.string().max(MAX_MESSAGE_LENGTH).optional(),
  exerciseId: z.string().optional(),
  lessonId: z.string().optional(),
  chapterId: z.string().optional(),
  courseId: z.string().optional(),
  categoryId: z.string().optional(),
  mediaIds: z.array(z.string()).max(CHAT_ASSET_MAX_ATTACHMENTS).optional(),
  chatAssetIds: z.array(z.string()).max(CHAT_ASSET_MAX_ATTACHMENTS).optional(),
  contextKeyOverride: z.string().max(MAX_CONTEXT_KEY_LENGTH).optional(),
})

const CHAT_RATE_LIMIT_MAX = 30
const CHAT_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const quota = await requireUserWithChatQuota(request)
  if (!quota.ok) return quota.response

  const ownerId = quota.value.ownerId
  const rate = await rateLimit({
    key: `chat:${ownerId}:agent-chat`,
    limit: CHAT_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  // Hard cap on LLM token spend per user. `withinLimit: true` when the
  // manager hasn't set a per-user cap (no cap → allow) or usage is below
  // the cap. When over, 429 before spending on the model.
  const tokenLimit = await checkTokenLimit(ownerId)
  if (!tokenLimit.withinLimit) {
    return NextResponse.json(
      {
        error: 'token_limit_exceeded',
        used: tokenLimit.used,
        limit: tokenLimit.limit,
        resetAt: tokenLimit.resetAt,
      },
      { status: 429 },
    )
  }

  const body = parsed.data
  const contextKey = resolveContextKey(body, body.contextKeyOverride)
  if (!contextKey) return NextResponse.json({ error: 'Missing context ID' }, { status: 400 })

  const conversation = await getOrCreateConversation(ownerId, contextKey)

  await appendMessage(String(conversation.id), {
    role: 'user',
    content: body.message,
    media: body.mediaIds?.map((mediaId) => ({ mediaId })),
    chatAssets: body.chatAssetIds?.map((chatAssetId) => ({ chatAssetId })),
  })

  const { message, usage } = await generateAssistantReply({
    ownerId,
    message: body.message,
    acknowledgment: body.acknowledgment,
    history: Array.isArray(conversation.messages) ? conversation.messages : [],
    lessonId: body.lessonId,
    mediaIds: body.mediaIds,
    chatAssetIds: body.chatAssetIds,
  })

  await appendMessage(String(conversation.id), { role: 'assistant', content: message })

  // Record token usage post-response so the reply is on its way before we
  // touch the counter collections. `after()` keeps the runtime alive on
  // Vercel until the write resolves.
  const shouldRecord = usage.inputTokens + usage.outputTokens > 0
  if (shouldRecord) {
    const record = () =>
      recordLlmUsage({
        userId: ownerId,
        lessonId: body.lessonId ?? null,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model ?? undefined,
        callType: 'chat',
      })
    try {
      after(record)
    } catch {
      void record()
    }
  }

  return NextResponse.json({
    success: true,
    message,
    conversationId: conversation.id,
    contextKey,
  })
}
