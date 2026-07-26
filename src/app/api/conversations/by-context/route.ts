import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getContentDb, serializeDoc } from '@/infra/db/content-db'
import { requireUser } from '@/server/auth/api-auth'

const CreateConversationSchema = z.object({
  courseId: z.string().min(1),
  locale: z.enum(['he', 'en']).optional(),
})

function ownerFilter(ownerId: string) {
  return {
    user: ObjectId.isValid(ownerId) ? { $in: [ownerId, new ObjectId(ownerId)] } : ownerId,
  }
}

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

function contextFilter(contextKey: string | null, contextKeyPrefix: string | null) {
  if (contextKey) return { contextKey }
  return { contextKey: { $regex: `^${escapeRegex(contextKeyPrefix ?? '')}`, $options: 'i' } }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const ownerId = auth.value.id
  const searchParams = request.nextUrl.searchParams
  const contextKey = searchParams.get('contextKey')
  const contextKeyPrefix = searchParams.get('contextKeyPrefix')
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 100)

  if (!contextKey && !contextKeyPrefix) {
    return NextResponse.json(
      { error: 'contextKey or contextKeyPrefix is required' },
      { status: 400 },
    )
  }

  const db = await getContentDb()
  const query = {
    ...ownerFilter(ownerId),
    ...contextFilter(contextKey, contextKeyPrefix),
    archivedAt: { $exists: false },
  }
  const docs = await db
    .collection('conversations')
    .find(query)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(limit)
    .toArray()
  const total = await db.collection('conversations').countDocuments(query)

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
  const ownerId = auth.value.id
  const db = await getContentDb()
  const now = new Date()
  const contextKey = `ask:${parsed.data.courseId}:${now.getTime()}`

  const result = await db.collection('conversations').insertOne({
    user: ObjectId.isValid(ownerId) ? new ObjectId(ownerId) : ownerId,
    contextRef: { relationTo: 'courses', value: parsed.data.courseId },
    contextKey,
    preferredLocale: parsed.data.locale ?? 'he',
    messages: [],
    lastMessageAt: now,
    contextPolicyVersion: 'web-v1',
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ id: result.insertedId.toString(), contextKey })
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const ownerId = auth.value.id
  const db = await getContentDb()

  const result = await db
    .collection('conversations')
    .updateOne(
      { _id: new ObjectId(id), ...ownerFilter(ownerId) },
      { $set: { archivedAt: new Date(), updatedAt: new Date() } },
    )

  if (!result.matchedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
