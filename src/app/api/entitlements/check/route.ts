import { ObjectId, ReadPreference, type Document } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { idCandidates } from '@/server/web-api/progress'

// Same reasoning as src/server/utils/check-paid-access.ts — pin reads to the
// primary so the entitlement check sees freshly written enrollments instead of
// a lagging secondary.
const READ_FROM_PRIMARY = { readPreference: ReadPreference.PRIMARY }

export async function GET(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return NextResponse.json({ hasAccess: false }, { status: 401 })

  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  if (user.role === 'admin' || user.roles?.includes('admin'))
    return NextResponse.json({ hasAccess: true })

  const db = await getContentDb()
  const userIds = idCandidates(user.id)
  const courseIds = idCandidates(courseId)
  const [entitlement, enrollment, userDoc] = await Promise.all([
    db.collection('user-entitlements').findOne(
      {
        user: { $in: userIds },
        course: { $in: courseIds },
      },
      READ_FROM_PRIMARY,
    ),
    db.collection('enrollments').findOne(
      {
        user: { $in: userIds },
        course: { $in: courseIds },
        status: { $ne: 'cancelled' },
      },
      READ_FROM_PRIMARY,
    ),
    db
      .collection('users')
      .findOne(
        { _id: ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id } as Document,
        READ_FROM_PRIMARY,
      ),
  ])

  const legacy = Array.isArray(userDoc?.courseEntitlements)
    ? userDoc.courseEntitlements.some((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return false
        return relationId((entry as { course?: unknown }).course) === courseId
      })
    : false

  return NextResponse.json({ hasAccess: Boolean(entitlement || enrollment || legacy) })
}
