import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { enforceGuestOrUserChatQuota } from '@/server/auth/api-auth'
import { buildGuestSessionCookieHeader } from '@/server/services/guest-session'
import {
  appendMessage,
  generateAssistantReply,
  getOrCreateConversation,
  resolveContextKey,
} from '@/server/web-api/chat'

const BodySchema = z.object({
  message: z.string().min(1),
  acknowledgment: z.string().optional(),
  exerciseId: z.string().optional(),
  lessonId: z.string().optional(),
  chapterId: z.string().optional(),
  courseId: z.string().optional(),
  categoryId: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
  chatAssetIds: z.array(z.string()).optional(),
  contextKeyOverride: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const quota = await enforceGuestOrUserChatQuota(request)
  if (!quota.ok) return quota.response

  const body = parsed.data
  const contextKey = resolveContextKey(body, body.contextKeyOverride)
  if (!contextKey) return NextResponse.json({ error: 'Missing context ID' }, { status: 400 })

  const ownerId = quota.value.ownerId
  const conversation = await getOrCreateConversation(ownerId, contextKey)

  await appendMessage(String(conversation.id), {
    role: 'user',
    content: body.message,
    media: body.mediaIds?.map((mediaId) => ({ mediaId })),
    chatAssets: body.chatAssetIds?.map((chatAssetId) => ({ chatAssetId })),
  })

  const message = await generateAssistantReply({
    message: body.message,
    acknowledgment: body.acknowledgment,
    history: Array.isArray(conversation.messages) ? conversation.messages : [],
    mediaIds: body.mediaIds,
    chatAssetIds: body.chatAssetIds,
  })

  await appendMessage(String(conversation.id), { role: 'assistant', content: message })

  const response = NextResponse.json({
    success: true,
    message,
    conversationId: conversation.id,
    contextKey,
    isGuestMode: quota.value.isGuest,
  })

  if (quota.value.guestCookieToken) {
    const cookieHeader = await buildGuestSessionCookieHeader(quota.value.guestCookieToken)
    response.headers.append('Set-Cookie', cookieHeader)
  }

  return response
}
