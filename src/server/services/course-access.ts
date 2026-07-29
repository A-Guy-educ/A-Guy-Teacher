/**
 * Course Access Service
 *
 * @fileType service
 * @domain entitlements
 * @pattern repository
 * @ai-summary Reads the three places course access can come from — an entitlement, an enrollment, or the legacy array on the user — for the access check and its diagnostic sibling.
 */

import { ObjectId, ReadPreference, type Document } from 'mongodb'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { idCandidates } from '@/server/web-api/progress'

/**
 * Entitlement reads are pinned to the primary so a check made straight after a
 * purchase sees the enrollment that was just written, rather than a secondary
 * that has not caught up. Same reasoning as `check-paid-access.ts`.
 */
const READ_FROM_PRIMARY = { readPreference: ReadPreference.PRIMARY }

export type CourseAccessGrants = {
  entitlement: Document | null
  enrollment: Document | null
  /** Entries from the pre-entitlements array still carried on some user docs. */
  legacyEntitlements: { course: string | null; raw: unknown }[]
}

function legacyEntitlementsOf(userDoc: Document | null) {
  const entries = userDoc?.courseEntitlements
  if (!Array.isArray(entries)) return []

  return entries
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({ course: relationId(entry.course), raw: entry }))
}

/** Every grant that could give this user access to this course. */
export async function findCourseAccessGrants(
  userId: string,
  courseId: string,
): Promise<CourseAccessGrants> {
  const db = await getContentDb()
  const userIds = idCandidates(userId)
  const courseIds = idCandidates(courseId)

  const [entitlement, enrollment, userDoc] = await Promise.all([
    db
      .collection('user-entitlements')
      .findOne({ user: { $in: userIds }, course: { $in: courseIds } }, READ_FROM_PRIMARY),
    db.collection('enrollments').findOne(
      {
        user: { $in: userIds },
        course: { $in: courseIds },
        // A cancelled enrollment is a record of the past, not a grant.
        status: { $ne: 'cancelled' },
      },
      READ_FROM_PRIMARY,
    ),
    db
      .collection('users')
      .findOne(
        { _id: ObjectId.isValid(userId) ? new ObjectId(userId) : userId } as Document,
        READ_FROM_PRIMARY,
      ),
  ])

  return { entitlement, enrollment, legacyEntitlements: legacyEntitlementsOf(userDoc) }
}

/** Whether any of the grants covers the course. */
export function grantsAccess(grants: CourseAccessGrants, courseId: string): boolean {
  return Boolean(
    grants.entitlement ||
    grants.enrollment ||
    grants.legacyEntitlements.some((entry) => entry.course === courseId),
  )
}

/** A course by its slug, or `null`. */
export async function findCourseBySlug(slug: string) {
  const db = await getContentDb()
  return db.collection('courses').findOne({ slug }, READ_FROM_PRIMARY)
}

/** Every enrollment belonging to a user, cancelled ones included — for diagnostics. */
export async function listEnrollmentsForUser(userId: string, limit = 50) {
  const db = await getContentDb()
  return db
    .collection('enrollments')
    .find({ user: { $in: idCandidates(userId) } }, READ_FROM_PRIMARY)
    .limit(limit)
    .toArray()
}
