/**
 * Upload Sessions Service
 *
 * @fileType service
 * @domain chat-assets
 * @pattern repository
 * @ai-summary Tracks browser-direct uploads to blob storage: an upload session is opened before a token is issued and closed when the file lands, so an abandoned upload leaves a record rather than nothing.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

/**
 * The tenant that owns uploads on this deployment.
 *
 * Falls back to a literal `'default'` rather than failing: an upload should
 * not break because a tenant document is missing from a fresh environment.
 */
export async function resolveDefaultTenantId(): Promise<string> {
  const db = await getContentDb()
  const tenant = await db
    .collection('tenants')
    .findOne({ slug: process.env.DEFAULT_TENANT_SLUG || 'AGuy' })

  return tenant?._id?.toString() || 'default'
}

export type NewUploadSession = {
  tenant: string
  createdBy: string
  purpose: string
  originalFilename: string
  mimeType: string
  expectedSize: number
  expiresAt: Date
}

/**
 * Open a session before any bytes are accepted.
 *
 * Returns the raw stored id rather than a string: it is handed straight back
 * to `setUploadSessionPathname`, and round-tripping it through text would
 * force a conversion that the database did not ask for.
 */
export async function openUploadSession(session: NewUploadSession): Promise<unknown> {
  const db = await getContentDb()
  const now = new Date()

  const result = await db
    .collection('upload-sessions')
    .insertOne({ ...session, status: 'initiated', createdAt: now, updatedAt: now })

  return result.insertedId
}

/** Record where the file will live, once the path is known. */
export async function setUploadSessionPathname(
  sessionId: unknown,
  pathname: string,
): Promise<void> {
  const db = await getContentDb()

  await db.collection('upload-sessions').updateOne({ _id: sessionId } as Document, {
    $set: { pathname, updatedAt: new Date() },
  })
}

/**
 * Close the session once blob storage confirms the upload.
 *
 * The id arrives as text here, having travelled to the browser and back in the
 * upload token, so it has to be parsed.
 */
export async function completeUploadSession(
  sessionId: string,
  blob: { url: string; pathname: string },
): Promise<void> {
  const db = await getContentDb()

  await db.collection('upload-sessions').updateOne({ _id: new ObjectId(sessionId) } as Document, {
    $set: {
      blobUrl: blob.url,
      pathname: blob.pathname,
      status: 'uploaded',
      updatedAt: new Date(),
    },
  })
}

/** One upload session by id, or `null`. */
export async function findUploadSessionById(sessionId: string): Promise<Document | null> {
  const db = await getContentDb()
  return db.collection('upload-sessions').findOne({ _id: new ObjectId(sessionId) } as Document)
}

/**
 * Find a caller's unfinished session by the blob it produced, or by the
 * filename it was opened for.
 *
 * Scoped to the owner deliberately: matching on the blob URL alone would let
 * one user finalize another user's upload.
 */
export async function findOwnUploadSessionByBlob(
  ownerId: string,
  blobUrl: string,
  originalFilename?: string,
): Promise<Document | null> {
  const db = await getContentDb()

  return db.collection('upload-sessions').findOne({
    createdBy: ownerId,
    $or: [{ blobUrl }, { originalFilename, status: { $in: ['initiated', 'uploaded'] } }],
  })
}

/** Mark a session finished and point it at the asset it produced. */
export async function finalizeUploadSession(
  sessionId: unknown,
  asset: { chatAssetId: string; blobUrl: string },
): Promise<void> {
  const db = await getContentDb()

  await db.collection('upload-sessions').updateOne({ _id: sessionId } as Document, {
    $set: { status: 'finalized', ...asset, updatedAt: new Date() },
  })
}
