import { head } from '@vercel/blob'
import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_BYTES,
  CHAT_ASSET_RETENTION_DAYS,
} from '@/server/chat-assets/constants'
import { getContentDb, serializeDoc } from '@/infra/db/content-db'
import { requireUser } from '@/server/auth/api-auth'

const BodySchema = z
  .object({
    uploadSessionId: z.string().optional(),
    blobUrl: z.string().url().optional(),
    originalFilename: z.string().max(255).optional(),
  })
  .refine((body) => body.uploadSessionId || body.blobUrl)
  .refine((body) => !body.uploadSessionId || ObjectId.isValid(body.uploadSessionId), {
    message: 'uploadSessionId is not a valid ObjectId',
  })

const BLOB_HOST_SUFFIX = '.blob.vercel-storage.com'

/**
 * Only Vercel Blob URLs may be stored as a chat asset URL. Anything stored here
 * is later fetched by the server when the asset is attached to a chat message.
 */
export function isBlobStorageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith(BLOB_HOST_SUFFIX)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const db = await getContentDb()
  const ownerId = auth.value.id
  const { uploadSessionId, blobUrl, originalFilename } = parsed.data

  let session = uploadSessionId
    ? await db.collection('upload-sessions').findOne({ _id: new ObjectId(uploadSessionId) })
    : null

  // Resolve by blobUrl only within the caller's own sessions. Matching on
  // blobUrl alone would let one user finalize another user's upload session.
  if (!session && blobUrl) {
    session = await db.collection('upload-sessions').findOne({
      createdBy: ownerId,
      $or: [{ blobUrl }, { originalFilename, status: { $in: ['initiated', 'uploaded'] } }],
    })
  }

  if (!session) return Response.json({ error: 'Upload session not found' }, { status: 404 })
  if (session.createdBy !== ownerId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  if (session.status === 'finalized' && session.chatAssetId) {
    const existing = await db
      .collection('chat-assets')
      .findOne({ _id: new ObjectId(String(session.chatAssetId)) })
    if (existing) {
      return NextResponse.json({
        chatAssetId: existing._id.toString(),
        chatAsset: serializeDoc(existing),
      })
    }
  }

  // Prefer the URL the Blob store reported via `onUploadCompleted`. That
  // callback cannot reach localhost, so a client-supplied URL is still accepted
  // in dev — but only after host validation: this URL is fetched server-side
  // when the asset is attached to a chat message, so an arbitrary host here
  // would be an SSRF primitive.
  const resolvedUrl = String(session.blobUrl || blobUrl || '')
  if (!resolvedUrl) return Response.json({ error: 'Upload not completed' }, { status: 409 })
  if (!isBlobStorageUrl(resolvedUrl)) {
    return Response.json({ error: 'Upload URL is not an allowed blob URL' }, { status: 400 })
  }

  let size = Number(session.expectedSize || 0)
  let mimeType = String(session.mimeType || '')
  try {
    const meta = await head(resolvedUrl)
    size = meta.size || size
    mimeType = meta.contentType || mimeType
  } catch {
    // Blob metadata can lag briefly after upload; keep session values.
  }

  if (size > CHAT_ASSET_MAX_BYTES)
    return Response.json({ error: 'File size exceeds maximum' }, { status: 413 })
  if (
    mimeType &&
    !CHAT_ASSET_ALLOWED_MIME_TYPES.includes(
      mimeType as (typeof CHAT_ASSET_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return Response.json({ error: 'Content type not allowed' }, { status: 415 })
  }

  const expiresAt = new Date(Date.now() + CHAT_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const now = new Date()
  const asset = await db.collection('chat-assets').insertOne({
    tenant: session.tenant,
    createdBy: ownerId,
    url: resolvedUrl,
    pathname: session.pathname,
    originalFilename: session.originalFilename || originalFilename,
    mimeType,
    filesize: size,
    retentionPolicy: 'ephemeral',
    expiresAt,
    uploadSessionId: session._id.toString(),
    createdAt: now,
    updatedAt: now,
  })
  await db.collection('upload-sessions').updateOne(
    { _id: session._id },
    {
      $set: {
        status: 'finalized',
        chatAssetId: asset.insertedId.toString(),
        blobUrl: resolvedUrl,
        updatedAt: now,
      },
    },
  )
  const doc = await db.collection('chat-assets').findOne({ _id: asset.insertedId })
  return NextResponse.json({
    chatAssetId: asset.insertedId.toString(),
    chatAsset: serializeDoc(doc),
  })
}
