import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  appendMessage,
  generateAssistantReply,
  getOrCreateConversation,
  type WebChatMessage,
} from '@/server/web-api/chat'
import {
  GUEST_SESSION_COOKIE,
  getOrCreateGuestId,
  getWebUser,
  publicUserId,
} from '@/infra/web-api/mongo-payload'

const BodySchema = z.object({
  message: z.string().trim().min(1),
  acknowledgment: z.string().optional(),
  conversationId: z.string().optional().nullable(),
  gradeLevel: z.string().trim().min(1),
  locale: z.string().optional(),
})

function chunkText(text: string) {
  const chunks = text.match(/.{1,80}(\s|$)/g)
  return chunks?.map((chunk) => chunk.trimEnd()).filter(Boolean) ?? [text]
}

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Missing message or gradeLevel' }, { status: 400 })
  }

  const user = await getWebUser(request.headers)
  const guestId = getOrCreateGuestId(request)
  const ownerId = publicUserId(user, guestId)
  const contextKey = `learning:${parsed.data.gradeLevel}`
  const conversation = await getOrCreateConversation(ownerId, contextKey)
  const messages = Array.isArray(conversation.messages)
    ? (conversation.messages as WebChatMessage[])
    : []

  await appendMessage(String(conversation.id), {
    role: 'user',
    content: parsed.data.message,
  })

  const reply = await generateAssistantReply({
    message: parsed.data.message,
    acknowledgment: parsed.data.acknowledgment,
    history: messages,
  })

  await appendMessage(String(conversation.id), {
    role: 'assistant',
    content: reply,
  })

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

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Set-Cookie': `${GUEST_SESSION_COOKIE}=${guestId}; Path=/; Max-Age=2592000; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}; HttpOnly`,
    },
  })

  return response
}
