/**
 * Conversations Service
 *
 * @fileType service
 * @domain conversations
 * @pattern repository
 * @ai-summary Reads, creates and archives a user's chat conversations. Every query is scoped to the owner — a conversation is private, so there is deliberately no way to ask this service for someone else's.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

/**
 * Ownership is the security boundary for conversations, so it is built in
 * here rather than left to each caller to remember. The user reference is
 * stored both as an ObjectId and as its string form depending on when the
 * record was written, so both are matched.
 */
function ownedBy(ownerId: string) {
  return {
    user: ObjectId.isValid(ownerId) ? { $in: [ownerId, new ObjectId(ownerId)] } : ownerId,
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match one exact context, or every context under a prefix.
 *
 * The prefix is escaped before becoming a pattern: it arrives from the query
 * string, and an unescaped `.` or `*` would quietly widen the search.
 */
function matchingContext(contextKey: string | null, contextKeyPrefix: string | null) {
  if (contextKey) return { contextKey }
  return { contextKey: { $regex: `^${escapeRegex(contextKeyPrefix ?? '')}`, $options: 'i' } }
}

export type ConversationQuery = {
  ownerId: string
  contextKey: string | null
  contextKeyPrefix: string | null
  limit: number
}

/** A page of the caller's live conversations, plus the total matching count. */
export async function findConversationsByContext(query: ConversationQuery): Promise<{
  docs: Document[]
  total: number
}> {
  const db = await getContentDb()
  const filter = {
    ...ownedBy(query.ownerId),
    ...matchingContext(query.contextKey, query.contextKeyPrefix),
    archivedAt: { $exists: false },
  }

  const [docs, total] = await Promise.all([
    db
      .collection('conversations')
      .find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(query.limit)
      .toArray(),
    db.collection('conversations').countDocuments(filter),
  ])

  return { docs, total }
}

/** Start an empty conversation about a course, and return its id and context. */
export async function createConversation(input: {
  ownerId: string
  courseId: string
  locale: 'he' | 'en'
}): Promise<{ id: string; contextKey: string }> {
  const db = await getContentDb()
  const now = new Date()
  const contextKey = `ask:${input.courseId}:${now.getTime()}`

  const result = await db.collection('conversations').insertOne({
    user: ObjectId.isValid(input.ownerId) ? new ObjectId(input.ownerId) : input.ownerId,
    contextRef: { relationTo: 'courses', value: input.courseId },
    contextKey,
    preferredLocale: input.locale,
    messages: [],
    lastMessageAt: now,
    contextPolicyVersion: 'web-v1',
    createdAt: now,
    updatedAt: now,
  })

  return { id: result.insertedId.toString(), contextKey }
}

/**
 * Archive one of the caller's conversations. Returns false when it does not
 * exist or belongs to someone else — the caller cannot tell the two apart, by
 * design.
 *
 * Archival rather than deletion: the chat history stays recoverable.
 */
export async function archiveConversation(
  ownerId: string,
  conversationId: string,
): Promise<boolean> {
  const db = await getContentDb()
  const now = new Date()

  const result = await db
    .collection('conversations')
    .updateOne({ _id: new ObjectId(conversationId), ...ownedBy(ownerId) } as Document, {
      $set: { archivedAt: now, updatedAt: now },
    })

  return result.matchedCount > 0
}
