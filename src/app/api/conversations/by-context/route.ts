import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { serializeDoc } from '@/infra/db/content-db'
import { requireUser } from '@/server/auth/api-auth'
import {
  archiveConversation,
  createConversation,
  findConversationsByContext,
} from '@/server/services/conversations'

const CreateConversationSchema = z.object({
  courseId: z.string().min(1),
  locale: z.enum(['he', 'en']).optional(),
})

function previewTitle(messages: unknown) {
  if (!Array.isArray(messages)) return ''
  const first = messages.find((message) => {
    if (!message || typeof message !== 'object') return false
    const entry = message as { role?: unknown; hidden?: unknown; content?: unknown }
    return entry.role === 'user' && !entry.hidden && typeof entry.content === 'string'
  }) as { content?: string } | undefined
  if (!first?.content) return ''
  return first.content.slice(0, 50) + (first.content.length > 50 ? '...' : '')
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const searchParams = request.nextUrl.searchParams
  const contextKey = searchParams.get('contextKey')
  const contextKeyPrefix = searchParams.get('contextKeyPrefix')

  if (!contextKey && !contextKeyPrefix) {
    return NextResponse.json(
      { error: 'contextKey or contextKeyPrefix is required' },
      { status: 400 },
    )
  }

  const { docs, total } = await findConversationsByContext({
    ownerId: auth.value.id,
    contextKey,
    contextKeyPrefix,
    limit: Math.min(Number(searchParams.get('limit') ?? 100), 100),
  })

  const conversations = docs.map((doc) => {
    const serialized = serializeDoc<Record<string, unknown>>(doc)
    const messages = Array.isArray(serialized.messages) ? serialized.messages : []
    return {
      id: String(serialized.id),
      contextKey: String(serialized.contextKey ?? ''),
      title: String(serialized.title || previewTitle(messages)),
      lastMessageAt: String(
        serialized.lastMessageAt || serialized.updatedAt || serialized.createdAt || '',
      ),
      messageCount: messages.filter((message) => {
        return Boolean(
          message && typeof message === 'object' && !(message as { hidden?: unknown }).hidden,
        )
      }).length,
    }
  })

  return NextResponse.json({ conversations, total })
}

export async function POST(request: NextRequest) {
  const parsed = CreateConversationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const created = await createConversation({
    ownerId: auth.value.id,
    courseId: parsed.data.courseId,
    locale: parsed.data.locale ?? 'he',
  })

  return NextResponse.json(created)
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  if (!(await archiveConversation(auth.value.id, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
