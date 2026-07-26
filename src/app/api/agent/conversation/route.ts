import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/server/auth/api-auth'
import { findConversation, formatConversationResponse } from '@/server/web-api/chat'

const BodySchema = z.object({ contextKey: z.string().min(1).max(200) })

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const conversation = await findConversation(auth.value.id, parsed.data.contextKey)
  return NextResponse.json(formatConversationResponse(conversation, parsed.data.contextKey))
}
