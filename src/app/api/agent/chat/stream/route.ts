import { NextRequest } from 'next/server'
import { z } from 'zod'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { logger } from '@/infra/utils/logger'
import { requireUserWithChatQuota } from '@/server/auth/api-auth'
import { checkTokenLimit, recordLlmUsage } from '@/server/services/llm-usage'
import {
  appendMessage,
  generateAssistantReply,
  getOrCreateConversation,
  resolveContextKey,
  toSse,
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
  contextKeyOverride: z.string().max(MAX_CONTEXT_KEY_LENGTH).optional(),
  hidden: z.boolean().optional(),
  hidePromptOnly: z.boolean().optional(),
})

const CHAT_STREAM_RATE_LIMIT_MAX = 20
const CHAT_STREAM_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const CHUNK_SIZE = 80

/**
 * Split a reply into fixed-size pieces for incremental delivery.
 * Slicing by index (rather than a regex match) guarantees the concatenated
 * chunks equal the original reply — a regex over `.` silently drops newlines
 * and any run longer than the chunk size without whitespace.
 */
function chunkReply(reply: string): string[] {
  if (!reply) return []
  const chunks: string[] = []
  for (let i = 0; i < reply.length; i += CHUNK_SIZE) {
    chunks.push(reply.slice(i, i + CHUNK_SIZE))
  }
  return chunks
}

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const quota = await requireUserWithChatQuota(request)
  if (!quota.ok) return quota.response

  const rate = await rateLimit({
    key: `chat:${quota.value.ownerId}:agent-chat-stream`,
    limit: CHAT_STREAM_RATE_LIMIT_MAX,
    windowMs: CHAT_STREAM_RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  const ownerId = quota.value.ownerId

  // Hard cap on LLM token spend — 429 before we invoke the model.
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

  const body = parsed.data
  const contextKey = resolveContextKey(body, body.contextKeyOverride)
  if (!contextKey) return Response.json({ error: 'Missing context ID' }, { status: 400 })

  const conversation = await getOrCreateConversation(ownerId, contextKey)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        await appendMessage(String(conversation.id), {
          role: 'user',
          content: body.message,
          hidden: body.hidden,
        })
        const { message: reply, usage } = await generateAssistantReply({
          ownerId,
          message: body.message,
          acknowledgment: body.acknowledgment,
          history: Array.isArray(conversation.messages) ? conversation.messages : [],
          lessonId: body.lessonId,
        })
        await appendMessage(String(conversation.id), {
          role: 'assistant',
          content: reply,
          hidden: body.hidden && !body.hidePromptOnly,
        })

        for (const chunk of chunkReply(reply))
          controller.enqueue(encoder.encode(toSse('chunk', { text: chunk })))
        controller.enqueue(
          encoder.encode(toSse('done', { conversationId: conversation.id, contextKey })),
        )

        // Token usage write happens after the stream drains — fire-and-
        // forget inside the ReadableStream's async start; we can't use
        // `after()` here because we're not in the outer route context.
        if (usage.inputTokens + usage.outputTokens > 0) {
          void recordLlmUsage({
            userId: ownerId,
            lessonId: body.lessonId ?? null,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            model: usage.model ?? undefined,
            callType: 'chat_stream',
          })
        }
      } catch (error) {
        logger.error({ err: error, contextKey }, 'Chat stream failed')
        controller.enqueue(encoder.encode(toSse('error', { error: 'Chat failed' })))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
    },
  })
}
