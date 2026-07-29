import { handleUpload } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_BYTES,
  CHAT_ASSET_TOKEN_VALID_MINUTES,
} from '@/server/chat-assets/constants'
import { buildChatAssetPathname } from '@/server/chat-assets/pathname'
import { requireUser } from '@/server/auth/api-auth'
import {
  completeUploadSession,
  openUploadSession,
  resolveDefaultTenantId,
  setUploadSessionPathname,
} from '@/server/services/upload-sessions'

const ClientPayloadSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().positive(),
  purpose: z.enum(['chat-media']).default('chat-media'),
})

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const ownerId = auth.value.id
  const tenantId = await resolveDefaultTenantId()

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

      const expiresAt = new Date(Date.now() + CHAT_ASSET_TOKEN_VALID_MINUTES * 60 * 1000)
      const uploadSessionId = await openUploadSession({
        tenant: tenantId,
        createdBy: ownerId,
        purpose: payload.purpose,
        originalFilename: payload.originalFilename,
        mimeType: payload.contentType,
        expectedSize: payload.size,
        expiresAt,
      })
      const pathname = buildChatAssetPathname({
        tenantId,
        userId: ownerId,
        uploadSessionId: String(uploadSessionId),
        filename: payload.originalFilename,
      })
      await setUploadSessionPathname(uploadSessionId, pathname)

      return {
        allowedContentTypes: [payload.contentType],
        maximumSizeInBytes: CHAT_ASSET_MAX_BYTES,
        validUntil: expiresAt.getTime(),
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60 * 60 * 24,
        tokenPayload: JSON.stringify({
          uploadSessionId: String(uploadSessionId),
          tenantId,
          userId: ownerId,
        }),
      }
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const payload = JSON.parse(tokenPayload || '{}') as { uploadSessionId?: string }
      if (!payload.uploadSessionId) return
      await completeUploadSession(payload.uploadSessionId, blob)
    },
  })

  return NextResponse.json(result)
}
