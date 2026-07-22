import { head } from '@vercel/blob'
import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_BYTES,
  CHAT_ASSET_RETENTION_DAYS,
} from '@/server/chat-assets/constants'
import { getContentDb, serializeDoc } from '@/infra/db/content-db'
import {
  getOrCreateGuestId,
  getWebUser,
  publicUserId,
  withGuestCookie,
} from '@/infra/web-api/mongo-payload'

const BodySchema = z
  .object({
    uploadSessionId: z.string().optional(),
    blobUrl: z.string().url().optional(),
    originalFilename: z.string().optional(),
  })
  .refine((body) => body.uploadSessionId || body.blobUrl)
  .refine((body) => !body.uploadSessionId || ObjectId.isValid(body.uploadSessionId), {
    message: 'uploadSessionId is not a valid ObjectId',
  })

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const db = await getContentDb()
  const user = await getWebUser(request.headers)
  const guestId = getOrCreateGuestId(request)
  const ownerId = publicUserId(user, guestId)
  const { uploadSessionId, blobUrl, originalFilename } = parsed.data

  let session = uploadSessionId
    ? await db.collection('upload-sessions').findOne({ _id: new ObjectId(uploadSessionId) })
    : null

  if (!session && blobUrl) {
    session = await db.collection('upload-sessions').findOne({
      $or: [
        { blobUrl },
        {
          createdBy: ownerId,
          originalFilename,
          status: { $in: ['initiated', 'uploaded'] },
        },
      ],
    })
  }

  if (!session) return Response.json({ error: 'Upload session not found' }, { status: 404 })
  if (session.createdBy !== ownerId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  if (session.status === 'finalized' && session.chatAssetId) {
    const existing = await db
      .collection('chat-assets')
      .findOne({ _id: new ObjectId(String(session.chatAssetId)) })
    if (existing) {
      return withGuestCookie(
        NextResponse.json({
          chatAssetId: existing._id.toString(),
          chatAsset: serializeDoc(existing),
        }),
        guestId,
      )
    }
  }

  const resolvedUrl = String(session.blobUrl || blobUrl || '')
  if (!resolvedUrl) return Response.json({ error: 'Upload not completed' }, { status: 409 })

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
  return withGuestCookie(
    NextResponse.json({ chatAssetId: asset.insertedId.toString(), chatAsset: serializeDoc(doc) }),
    guestId,
  )
}
