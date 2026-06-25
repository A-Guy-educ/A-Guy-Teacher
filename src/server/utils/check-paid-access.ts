/**
 * Determines whether a course requires a paid entitlement for access.
 *
 * Checks three sources in parallel: explicit user-entitlements record,
 * active enrollment, and the legacy courseEntitlements array on the user doc.
 * Admin users bypass all checks (returns `requiresEntitlement: false`).
 *
 * @fileType utility
 * @domain access-control
 * @pattern paid-entitlement
 * @ai-summary Grants access to admin users unconditionally — callers must handle `requiresEntitlement: false` for admins separately (e.g., skip rendering a purchase button but allow access).
 */
import { ObjectId, type Document } from 'mongodb'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { idCandidates } from '@/server/web-api/progress'
import { getAuthenticatedUserServer } from './access-gate-server'

interface PaidAccessResult {
  requiresEntitlement: boolean
  isAuthenticated: boolean
}

export async function checkPaidAccess(courseId: string): Promise<PaidAccessResult> {
  const { user } = await getAuthenticatedUserServer()
  if (!user?.id) return { requiresEntitlement: true, isAuthenticated: false }
  if (user.role === 'admin' || user.roles?.includes('admin')) {
    return { requiresEntitlement: false, isAuthenticated: true }
  }

  const db = await getContentDb()
  const userIds = idCandidates(user.id)
  const courseIds = idCandidates(courseId)
  const [entitlement, enrollment, userDoc] = await Promise.all([
    db.collection('user-entitlements').findOne({
      user: { $in: userIds },
      course: { $in: courseIds },
    }),
    db.collection('enrollments').findOne({
      user: { $in: userIds },
      course: { $in: courseIds },
      status: { $ne: 'cancelled' },
    }),
    db
      .collection('users')
      .findOne({ _id: ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id } as Document),
  ])
  const legacy = Array.isArray(userDoc?.courseEntitlements)
    ? userDoc.courseEntitlements.some((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return false
        return relationId((entry as { course?: unknown }).course) === courseId
      })
    : false

  return { requiresEntitlement: !(entitlement || enrollment || legacy), isAuthenticated: true }
}
