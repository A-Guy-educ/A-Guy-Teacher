/**
 * Entitlement Grants Service
 *
 * @fileType service
 * @domain entitlements
 * @pattern repository
 * @ai-summary Redeeming an access code: finding it, consuming exactly one use, and granting the course. The consume step is a conditional update rather than a read-then-write, so two simultaneous redemptions cannot both succeed on the last remaining use.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'
import { idCandidates } from '@/server/web-api/progress'

/** An access code by its printed form, matched without regard to case. */
export async function findAccessCode(code: string): Promise<Document | null> {
  const db = await getContentDb()

  return db
    .collection('access-codes')
    .findOne({ code }, { collation: { locale: 'en', strength: 2 } })
}

/** True when the user already has this course by entitlement or enrollment. */
export async function hasCourseGrant(userId: string, courseId: string): Promise<boolean> {
  const db = await getContentDb()
  const userIds = idCandidates(userId)
  const courseIds = idCandidates(courseId)

  const [entitlement, enrollment] = await Promise.all([
    db.collection('user-entitlements').findOne({
      user: { $in: userIds },
      course: { $in: courseIds },
    }),
    db.collection('enrollments').findOne({
      user: { $in: userIds },
      course: { $in: courseIds },
      status: { $ne: 'cancelled' },
    }),
  ])

  return Boolean(entitlement || enrollment)
}

/**
 * Consume one use of an access code, returning false if it could not be.
 *
 * The conditions live in the update filter rather than in a prior read on
 * purpose: an expired, deactivated or exhausted code fails the filter at the
 * moment of writing, so two people redeeming the last use at once cannot both
 * win.
 */
export async function consumeAccessCodeUse(accessCode: Document): Promise<boolean> {
  const db = await getContentDb()
  const maxUses = Number(accessCode.maxUses || 0)

  const filter: Record<string, unknown> = {
    _id: accessCode._id,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }
  if (maxUses > 0) filter.currentUses = { $lt: maxUses }

  const result = await db
    .collection('access-codes')
    .updateOne(filter as Document, { $inc: { currentUses: 1 }, $set: { updatedAt: new Date() } })

  return result.modifiedCount > 0
}

/** Grant a course to a user, by both entitlement and enrollment. */
export async function grantCourseByCode(
  userId: string,
  courseId: string,
  accessCode: Document,
): Promise<void> {
  const db = await getContentDb()
  const now = new Date()
  const user = ObjectId.isValid(userId) ? new ObjectId(userId) : userId
  const course = ObjectId.isValid(courseId) ? new ObjectId(courseId) : courseId

  await Promise.all([
    db.collection('user-entitlements').insertOne({
      tenant: accessCode.tenant,
      user,
      contentType: 'course',
      course,
      grantMethod: 'code',
      accessCode: accessCode._id,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('enrollments').insertOne({
      tenant: accessCode.tenant,
      user,
      course,
      status: 'active',
      grantMethod: 'code',
      source: 'self',
      enrolledAt: now,
      metadata: { accessCodeId: accessCode._id.toString() },
      createdAt: now,
      updatedAt: now,
    }),
  ])
}
