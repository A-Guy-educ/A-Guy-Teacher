/**
 * Diagnostic endpoint for the paid-access gate.
 *
 * Given a `?slug=<courseSlug>` and an authenticated session, dumps EXACTLY
 * what web sees from Mongo so we can figure out why the "requires entitlement"
 * gate keeps firing even after admin shows an active enrollment. Compares
 * the three entitlement sources checkPaidAccess reads, plus a full list of
 * the caller's enrollments (so a wrong-course-id bug on the webhook side is
 * obvious). Also does a "raw" find with no id-shape expansion, so we can
 * see whether admin stored `user`/`course` as string vs ObjectId vs
 * populated-object.
 *
 * Only returns the caller's own data (session-scoped). Not gated behind an
 * env flag — the surface is small and the data is already visible to the
 * user in question in other places.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId, ReadPreference, type Document } from 'mongodb'

import { getContentDb, relationId, serializeDoc } from '@/infra/db/content-db'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { idCandidates } from '@/server/web-api/progress'

export const dynamic = 'force-dynamic'

const READ_FROM_PRIMARY = { readPreference: ReadPreference.PRIMARY }

export async function GET(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'slug query param required' }, { status: 400 })
  }

  const db = await getContentDb()

  const courseDoc = await db
    .collection('courses')
    .findOne({ slug }, { readPreference: ReadPreference.PRIMARY })
  if (!courseDoc) {
    return NextResponse.json({ error: `no course with slug "${slug}"` }, { status: 404 })
  }
  const courseId = relationId(courseDoc._id) ?? ''

  const userIds = idCandidates(user.id)
  const courseIds = idCandidates(courseId)

  const [entitlement, enrollment, userDoc, allUserEnrollments, allEnrollmentsForCourse] =
    await Promise.all([
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
      db
        .collection('enrollments')
        .find({ user: { $in: userIds } }, READ_FROM_PRIMARY)
        .limit(50)
        .toArray(),
      // Same course, any user — narrow to id/user/status so we don't leak PII.
      db
        .collection('enrollments')
        .find(
          { course: { $in: courseIds } },
          { projection: { user: 1, status: 1, grantMethod: 1, enrolledAt: 1 }, ...READ_FROM_PRIMARY },
        )
        .limit(20)
        .toArray(),
    ])

  const legacy = Array.isArray(userDoc?.courseEntitlements)
    ? userDoc.courseEntitlements
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          course: relationId(entry.course),
          matchesQueryCourse: relationId(entry.course) === courseId,
          raw: serializeDoc(entry),
        }))
    : []

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      role: user.role ?? null,
    },
    course: {
      id: courseId,
      slug,
      title: courseDoc.title ?? null,
      accessType: courseDoc.accessType ?? null,
      pageAccessType: courseDoc.pageAccessType ?? null,
      isActive: courseDoc.isActive ?? null,
    },
    queries: {
      userEntitlement: entitlement ? serializeDoc(entitlement) : null,
      enrollment: enrollment ? serializeDoc(enrollment) : null,
      legacyCourseEntitlements: legacy,
    },
    wouldRequireEntitlement: !(entitlement || enrollment || legacy.some((e) => e.matchesQueryCourse)),
    diagnostics: {
      allEnrollmentsForCallingUser: allUserEnrollments.map((doc) => ({
        id: relationId(doc._id),
        user: relationId(doc.user),
        userRaw: doc.user,
        course: relationId(doc.course),
        courseRaw: doc.course,
        status: doc.status,
        grantMethod: doc.grantMethod,
        enrolledAt: doc.enrolledAt,
      })),
      allEnrollmentsForCourseSampled: allEnrollmentsForCourse.map((doc) => ({
        id: relationId(doc._id),
        user: relationId(doc.user),
        userRaw: doc.user,
        status: doc.status,
        grantMethod: doc.grantMethod,
        enrolledAt: doc.enrolledAt,
      })),
      idShapes: {
        callerUserId: user.id,
        courseIdFromCoursesCollection: courseId,
        userIdCandidatesUsedInQuery: userIds.map(String),
        courseIdCandidatesUsedInQuery: courseIds.map(String),
      },
      timestamp: new Date().toISOString(),
    },
  })
}
