/**
 * Chat Assets Service
 *
 * @fileType service
 * @domain chat-assets
 * @pattern repository
 * @ai-summary Stores the record of a file attached to a chat, created once its upload session is finalized.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

export type NewChatAsset = {
  tenant: unknown
  createdBy: string
  url: string
  pathname: unknown
  originalFilename: unknown
  mimeType: string
  filesize: number
  expiresAt: Date
  uploadSessionId: string
}

/** One chat asset by id, or `null`. */
export async function findChatAssetById(id: string): Promise<Document | null> {
  const db = await getContentDb()
  return db.collection('chat-assets').findOne({ _id: new ObjectId(id) } as Document)
}

/**
 * Record an attached file and return it as stored.
 *
 * Assets are ephemeral by policy: they carry an expiry so chat attachments do
 * not accumulate indefinitely.
 */
export async function createChatAsset(
  asset: NewChatAsset,
): Promise<{ id: string; doc: Document | null }> {
  const db = await getContentDb()
  const now = new Date()

  const result = await db.collection('chat-assets').insertOne({
    ...asset,
    retentionPolicy: 'ephemeral',
    createdAt: now,
    updatedAt: now,
  })

  return {
    id: result.insertedId.toString(),
    doc: await db.collection('chat-assets').findOne({ _id: result.insertedId }),
  }
}
