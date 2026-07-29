/**
 * Media Service
 *
 * @fileType service
 * @domain media
 * @pattern repository
 * @ai-summary Reads and records media documents. Blob storage itself is handled by the caller; this only owns the database side.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

export type MediaRecord = {
  filename: string
  type: string
  mimeType: string
  filesize: number
  url: string
  pathname: string
  createdBy: string
}

/** Record an uploaded file and return the stored document. */
export async function createMedia(record: MediaRecord): Promise<Document | null> {
  const db = await getContentDb()
  const now = new Date()

  const result = await db
    .collection('media')
    .insertOne({ ...record, createdAt: now, updatedAt: now })

  return db.collection('media').findOne({ _id: result.insertedId })
}

/** One media document by id, or `null`. */
export async function findMediaById(id: string): Promise<Document | null> {
  const db = await getContentDb()
  return db.collection('media').findOne({ _id: new ObjectId(id) })
}

/** One media document by its stored filename, or `null`. */
export async function findMediaByFilename(filename: string): Promise<Document | null> {
  const db = await getContentDb()
  return db.collection('media').findOne({ filename })
}

/** The most recently added media, newest first. */
export async function listRecentMedia(limit = 50): Promise<Document[]> {
  const db = await getContentDb()
  return db.collection('media').find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}
