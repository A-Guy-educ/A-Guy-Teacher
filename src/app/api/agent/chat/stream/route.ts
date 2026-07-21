import { NextRequest } from 'next/server'
import { z } from 'zod'

import { enforceGuestOrUserChatQuota } from '@/server/auth/api-auth'
import {
  appendMessage,
  generateAssistantReply,
  getOrCreateConversation,
  resolveContextKey,
  toSse,
} from '@/server/web-api/chat'

const BodySchema = z.object({
  message: z.string().min(1),
  acknowledgment: z.string().optional(),
  exerciseId: z.string().optional(),
  lessonId: z.string().optional(),
  chapterId: z.string().optional(),
  courseId: z.string().optional(),
  categoryId: z.string().optional(),
  contextKeyOverride: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const quota = await enforceGuestOrUserChatQuota(request)
  if (!quota.ok) return quota.response

  const body = parsed.data
  const contextKey = resolveContextKey(body, body.contextKeyOverride)
  if (!contextKey) return Response.json({ error: 'Missing context ID' }, { status: 400 })

  const ownerId = quota.value.ownerId
  const conversation = await getOrCreateConversation(ownerId, contextKey)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        await appendMessage(String(conversation.id), { role: 'user', content: body.message })
        const reply = await generateAssistantReply({
          message: body.message,
          acknowledgment: body.acknowledgment,
          history: Array.isArray(conversation.messages) ? conversation.messages : [],
        })
        await appendMessage(String(conversation.id), { role: 'assistant', content: reply })

        const chunks = reply.match(/.{1,80}(\s|$)/g) || [reply]
        for (const chunk of chunks)
          controller.enqueue(encoder.encode(toSse('chunk', { text: chunk })))
        controller.enqueue(
          encoder.encode(toSse('done', { conversationId: conversation.id, contextKey })),
        )
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            toSse('error', { error: error instanceof Error ? error.message : 'Chat failed' }),
          ),
        )
      } finally {
        controller.close()
      }
    },
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
  }
  if (quota.value.guestCookieToken) {
    headers['Set-Cookie'] =
      `guest_session=${quota.value.guestCookieToken}; Path=/; Max-Age=2592000; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}; HttpOnly`
  }

  return new Response(stream, { headers })
}
