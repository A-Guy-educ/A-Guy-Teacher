/**
 * Lessons Service
 *
 * @fileType service
 * @domain lessons
 * @pattern repository
 * @ai-summary Writes to lesson documents. Lessons are addressed by id or by slug depending on the caller, so both are accepted here rather than each route deciding.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

export type LessonIntroUpdate = {
  lessonContextText?: string
  blocks?: unknown
}

/**
 * Update a lesson's intro content, addressed by id or slug, and return the
 * fields the caller reports back. `null` means no such lesson.
 *
 * Only the named fields are projected: the caller only ever echoes those, and
 * a lesson document is large.
 */
export async function updateLessonIntro(
  target: { lessonId?: string; lessonSlug?: string },
  update: LessonIntroUpdate,
): Promise<Document | null> {
  const db = await getContentDb()
  const filter = target.lessonId
    ? { _id: new ObjectId(target.lessonId) }
    : { slug: target.lessonSlug }

  return db
    .collection('lessons')
    .findOneAndUpdate(
      filter as Document,
      { $set: { ...update, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { _id: 1, slug: 1, lessonContextText: 1, blocks: 1 } },
    )
}
