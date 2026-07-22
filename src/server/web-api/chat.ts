import fs from 'fs/promises'

import { ObjectId, type Document } from 'mongodb'

import { resolveMediaFilePath } from '@/infra/config/storage'
import { getContentDb, objectIdFromString, serializeDoc } from '@/infra/db/content-db'
import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_ATTACHMENTS,
  CHAT_ASSET_MAX_BYTES,
} from '@/server/chat-assets/constants'

export type ChatContext = {
  exerciseId?: string
  lessonId?: string
  chapterId?: string
  courseId?: string
  categoryId?: string
}

export type WebChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  hidden?: boolean
  media?: Array<{ mediaId: string; filename?: string; url?: string }>
  chatAssets?: Array<{ chatAssetId: string; filename?: string }>
}

export function resolveContextKey(context: ChatContext, override?: string) {
  if (override) return override
  if (context.lessonId) return `lessons:${context.lessonId}`
  if (context.exerciseId) return `exercises:${context.exerciseId}`
  if (context.chapterId) return `chapters:${context.chapterId}`
  if (context.courseId) return `courses:${context.courseId}`
  if (context.categoryId) return `categories:${context.categoryId}`
  return null
}

function splitContextKey(contextKey: string) {
  const [relationTo, ...rest] = contextKey.split(':')
  return { relationTo, value: rest.join(':') }
}

export async function getOrCreateConversation(ownerId: string, contextKey: string) {
  const db = await getContentDb()
  const conversations = db.collection('conversations')
  const ownerField = ownerId.startsWith('guest:') ? 'guestSession' : 'user'
  const ownerValue = ownerId.startsWith('guest:') ? ownerId.slice('guest:'.length) : ownerId

  const existing = await conversations.findOne({
    [ownerField]: ownerValue,
    contextKey,
    archivedAt: { $exists: false },
  })
  if (existing) return serializeDoc<Record<string, unknown>>(existing)

  const now = new Date()
  const contextRef = splitContextKey(contextKey)
  const doc = {
    [ownerField]: ownerValue,
    contextKey,
    contextRef,
    preferredLocale: 'he',
    messages: [],
    lastMessageAt: now,
    contextPolicyVersion: 'web-v1',
    createdAt: now,
    updatedAt: now,
  }
  const result = await conversations.insertOne(doc)
  return serializeDoc<Record<string, unknown>>(
    await conversations.findOne({ _id: result.insertedId }),
  )
}

export async function findConversation(ownerId: string, contextKey: string) {
  const db = await getContentDb()
  const ownerField = ownerId.startsWith('guest:') ? 'guestSession' : 'user'
  const ownerValue = ownerId.startsWith('guest:') ? ownerId.slice('guest:'.length) : ownerId
  const doc = await db.collection('conversations').findOne({
    [ownerField]: ownerValue,
    contextKey,
    archivedAt: { $exists: false },
  })
  return doc ? serializeDoc<Record<string, unknown>>(doc) : null
}

export async function appendMessage(
  conversationId: string,
  message: Omit<WebChatMessage, 'id' | 'timestamp'> & { timestamp?: string },
) {
  const db = await getContentDb()
  const fullMessage: WebChatMessage = {
    id: new ObjectId().toString(),
    timestamp: message.timestamp ?? new Date().toISOString(),
    role: message.role,
    content: message.content,
    ...(message.hidden !== undefined ? { hidden: message.hidden } : {}),
    ...(message.media ? { media: message.media } : {}),
    ...(message.chatAssets ? { chatAssets: message.chatAssets } : {}),
  }
  await db.collection('conversations').updateOne(
    { _id: objectIdFromString(conversationId) } as Document,
    {
      $push: { messages: fullMessage },
      $set: { updatedAt: new Date(), lastMessageAt: new Date(fullMessage.timestamp) },
    } as Document,
  )
  return fullMessage
}

export async function resetConversation(ownerId: string, contextKey: string) {
  const db = await getContentDb()
  const ownerField = ownerId.startsWith('guest:') ? 'guestSession' : 'user'
  const ownerValue = ownerId.startsWith('guest:') ? ownerId.slice('guest:'.length) : ownerId
  await db
    .collection('conversations')
    .updateMany(
      { [ownerField]: ownerValue, contextKey, archivedAt: { $exists: false } },
      { $set: { archivedAt: new Date(), updatedAt: new Date() } },
    )
  return getOrCreateConversation(ownerId, contextKey)
}

function visibleMessages(conversation: Record<string, unknown> | null): WebChatMessage[] {
  const raw = Array.isArray(conversation?.messages) ? conversation.messages : []
  return raw
    .filter((message): message is WebChatMessage => {
      if (!message || typeof message !== 'object') return false
      const record = message as Partial<WebChatMessage>
      return !record.hidden && Boolean(record.role) && typeof record.content === 'string'
    })
    .map((message) => ({
      ...message,
      role: message.role === 'user' ? 'user' : 'assistant',
    }))
}

export function formatConversationResponse(
  conversation: Record<string, unknown> | null,
  contextKey: string,
) {
  if (!conversation) {
    return { success: true, exists: false, messages: [], contextKey }
  }
  return {
    success: true,
    exists: true,
    conversationId: conversation.id,
    contextKey,
    messages: visibleMessages(conversation),
    isGuestMode: !conversation.user,
  }
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

type AttachmentDoc = Record<string, unknown> & {
  filename?: unknown
  originalFilename?: unknown
  mimeType?: unknown
  filesize?: unknown
  url?: unknown
}

const SUPPORTED_INLINE_MIME_TYPES = new Set<string>(CHAT_ASSET_ALLOWED_MIME_TYPES)

function cleanMimeType(mimeType: unknown) {
  return String(mimeType || '')
    .split(';')[0]
    ?.trim()
    .toLowerCase()
}

function attachmentName(attachment: AttachmentDoc) {
  return String(
    attachment.originalFilename || attachment.filename || attachment.url || 'attachment',
  )
}

async function fetchAttachmentBuffer(attachment: AttachmentDoc) {
  if (typeof attachment.url === 'string' && attachment.url) {
    const response = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Attachment fetch failed: ${response.status}`)

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: cleanMimeType(attachment.mimeType || response.headers.get('content-type')),
    }
  }

  if (typeof attachment.filename === 'string' && attachment.filename) {
    return {
      buffer: await fs.readFile(resolveMediaFilePath(attachment.filename)),
      mimeType: cleanMimeType(attachment.mimeType),
    }
  }

  return null
}

async function attachmentToInlinePart(attachment: AttachmentDoc): Promise<GeminiPart | null> {
  const mimeType = cleanMimeType(attachment.mimeType)
  if (!SUPPORTED_INLINE_MIME_TYPES.has(mimeType)) return null
  if (Number(attachment.filesize || 0) > CHAT_ASSET_MAX_BYTES) return null

  const loaded = await fetchAttachmentBuffer(attachment)
  if (!loaded || !SUPPORTED_INLINE_MIME_TYPES.has(loaded.mimeType)) return null
  if (loaded.buffer.length > CHAT_ASSET_MAX_BYTES) return null

  return { inlineData: { mimeType: loaded.mimeType, data: loaded.buffer.toString('base64') } }
}

export function buildGeminiUserParts(prompt: string, attachmentParts: GeminiPart[]) {
  return attachmentParts.length > 0 ? [...attachmentParts, { text: prompt }] : [{ text: prompt }]
}

async function loadAttachments(chatAssetIds?: string[], mediaIds?: string[]) {
  const db = await getContentDb()
  const lines: string[] = []
  const parts: GeminiPart[] = []
  let loadedCount = 0

  async function addAttachment(attachment: AttachmentDoc, label: string) {
    lines.push(`${label}: ${attachmentName(attachment)}`)
    if (typeof attachment.url === 'string' && attachment.url)
      lines.push(`File URL: ${attachment.url}`)

    if (loadedCount >= CHAT_ASSET_MAX_ATTACHMENTS) return

    try {
      const part = await attachmentToInlinePart(attachment)
      if (part) {
        parts.push(part)
        loadedCount += 1
      }
    } catch {
      lines.push(`Attachment vision data unavailable: ${attachmentName(attachment)}`)
    }
  }

  if (chatAssetIds?.length) {
    const assets = await db
      .collection('chat-assets')
      .find({ _id: { $in: chatAssetIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } })
      .toArray()
    for (const asset of assets) {
      await addAttachment(asset, 'Attached file')
    }
  }
  if (mediaIds?.length) {
    const media = await db
      .collection('media')
      .find({ _id: { $in: mediaIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } })
      .toArray()
    for (const item of media) {
      await addAttachment(item, 'Attached media')
    }
  }

  return { text: lines.join('\n'), parts }
}

export async function generateAssistantReply(args: {
  message: string
  acknowledgment?: string
  history?: WebChatMessage[]
  chatAssetIds?: string[]
  mediaIds?: string[]
}) {
  const attachments = await loadAttachments(args.chatAssetIds, args.mediaIds)
  const system =
    'You are A-Guy, a concise math tutor. Help the student with clear steps, in the same language they use when possible.'
  const history = (args.history ?? [])
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n')
  const prompt = [history, attachments.text, `Student: ${args.message}`, 'Tutor:']
    .filter(Boolean)
    .join('\n\n')

  if (!process.env.GEMINI_API_KEY) {
    return args.acknowledgment || 'I can help with that. Tell me what part you want to solve first.'
  }

  const model = process.env.LLM_MODEL_OVERRIDE_EXERCISE_CHAT || 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: buildGeminiUserParts(prompt, attachments.parts) }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini chat failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return (
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('') ||
    args.acknowledgment ||
    'I can help with that.'
  )
}

export function toSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}
