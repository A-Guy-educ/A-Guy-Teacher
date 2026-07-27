import { handleUpload } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_BYTES,
  CHAT_ASSET_TOKEN_VALID_MINUTES,
} from '@/server/chat-assets/constants'
import { buildChatAssetPathname } from '@/server/chat-assets/pathname'
import { getContentDb } from '@/infra/db/content-db'
import { requireUser } from '@/server/auth/api-auth'

const ClientPayloadSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().positive(),
  purpose: z.enum(['chat-media']).default('chat-media'),
})

async function defaultTenantId() {
  const db = await getContentDb()
  const tenant = await db
    .collection('tenants')
    .findOne({ slug: process.env.DEFAULT_TENANT_SLUG || 'AGuy' })
  return tenant?._id?.toString() || 'default'
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const db = await getContentDb()
  const ownerId = auth.value.id
  const tenantId = await defaultTenantId()

  const result = await handleUpload({
    request,
    body: await request.json(),
    onBeforeGenerateToken: async (_pathname, rawPayload) => {
      const payload = ClientPayloadSchema.parse(JSON.parse(rawPayload || '{}'))
      if (payload.size > CHAT_ASSET_MAX_BYTES) throw new Error('File size exceeds maximum')
      if (
        !CHAT_ASSET_ALLOWED_MIME_TYPES.includes(
          payload.contentType as (typeof CHAT_ASSET_ALLOWED_MIME_TYPES)[number],
        )
      ) {
        throw new Error(`Content type ${payload.contentType} is not allowed`)
      }

      const now = new Date()
      const expiresAt = new Date(now.getTime() + CHAT_ASSET_TOKEN_VALID_MINUTES * 60 * 1000)
      const session = await db.collection('upload-sessions').insertOne({
        tenant: tenantId,
        createdBy: ownerId,
        purpose: payload.purpose,
        originalFilename: payload.originalFilename,
        mimeType: payload.contentType,
        expectedSize: payload.size,
        status: 'initiated',
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      const pathname = buildChatAssetPathname({
        tenantId,
        userId: ownerId,
        uploadSessionId: session.insertedId.toString(),
        filename: payload.originalFilename,
      })
      await db
        .collection('upload-sessions')
        .updateOne({ _id: session.insertedId }, { $set: { pathname, updatedAt: new Date() } })

      return {
        allowedContentTypes: [payload.contentType],
        maximumSizeInBytes: CHAT_ASSET_MAX_BYTES,
        validUntil: expiresAt.getTime(),
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60 * 60 * 24,
        tokenPayload: JSON.stringify({
          uploadSessionId: session.insertedId.toString(),
          tenantId,
          userId: ownerId,
        }),
      }
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const payload = JSON.parse(tokenPayload || '{}') as { uploadSessionId?: string }
      if (!payload.uploadSessionId) return
      const { ObjectId } = await import('mongodb')
      await db.collection('upload-sessions').updateOne(
        { _id: new ObjectId(payload.uploadSessionId) },
        {
          $set: {
            blobUrl: blob.url,
            pathname: blob.pathname,
            status: 'uploaded',
            updatedAt: new Date(),
          },
        },
      )
    },
  })

  return NextResponse.json(result)
}
