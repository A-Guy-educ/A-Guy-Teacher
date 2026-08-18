import { NextRequest } from 'next/server'
import { z } from 'zod'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { requireUserWithChatQuota } from '@/server/auth/api-auth'
import { checkTokenLimit, recordLlmUsage } from '@/server/services/llm-usage'
import {
  appendMessage,
  generateAssistantReply,
  getOrCreateConversation,
  type WebChatMessage,
} from '@/server/web-api/chat'

const MAX_MESSAGE_LENGTH = 4000

const BodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  acknowledgment: z.string().max(MAX_MESSAGE_LENGTH).optional(),
  conversationId: z.string().optional().nullable(),
  gradeLevel: z.string().trim().min(1).max(50),
  locale: z.string().max(10).optional(),
})

const LEARNING_CHAT_RATE_LIMIT_MAX = 20
const LEARNING_CHAT_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const CHUNK_SIZE = 80

/**
 * Split a reply into fixed-size pieces for incremental delivery. Slicing by
 * index keeps the concatenated chunks byte-identical to the original reply;
 * the previous regex-and-trim approach glued words together at every boundary.
 */
function chunkText(text: string): string[] {
  if (!text) return []
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE))
  }
  return chunks
}

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Missing message or gradeLevel' }, { status: 400 })
  }

  const quota = await requireUserWithChatQuota(request)
  if (!quota.ok) return quota.response

  const rate = await rateLimit({
    key: `chat:${quota.value.ownerId}:agent-learning-chat`,
    limit: LEARNING_CHAT_RATE_LIMIT_MAX,
    windowMs: LEARNING_CHAT_RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  const ownerId = quota.value.ownerId

  const tokenLimit = await checkTokenLimit(ownerId)
  if (!tokenLimit.withinLimit) {
    return Response.json(
      {
        error: 'token_limit_exceeded',
        used: tokenLimit.used,
        limit: tokenLimit.limit,
        resetAt: tokenLimit.resetAt,
      },
      { status: 429 },
    )
  }

  const contextKey = `learning:${parsed.data.gradeLevel}`
  const conversation = await getOrCreateConversation(ownerId, contextKey)
  const messages = Array.isArray(conversation.messages)
    ? (conversation.messages as WebChatMessage[])
    : []

  await appendMessage(String(conversation.id), {
    role: 'user',
    content: parsed.data.message,
  })

  const { message: reply, usage } = await generateAssistantReply({
    ownerId,
    message: parsed.data.message,
    acknowledgment: parsed.data.acknowledgment,
    history: messages,
  })

  await appendMessage(String(conversation.id), {
    role: 'assistant',
    content: reply,
  })

  if (usage.inputTokens + usage.outputTokens > 0) {
    void recordLlmUsage({
      userId: ownerId,
      lessonId: null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      model: usage.model ?? undefined,
      callType: 'chat',
    })
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunkText(reply)) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`),
        )
      }
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'done', conversationId: conversation.id })}\n\n`,
        ),
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
