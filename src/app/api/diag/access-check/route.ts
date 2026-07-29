/**
 * Diagnostic endpoint for the paid-access gate.
 *
 * Given a `?slug=<courseSlug>` and an admin session, dumps EXACTLY what web
 * sees from Mongo so we can figure out why the "requires entitlement" gate
 * keeps firing even after admin shows an active enrollment. Compares the
 * three entitlement sources checkPaidAccess reads, plus a full list of the
 * caller's OWN enrollments (so a wrong-course-id bug on the webhook side is
 * obvious). Reads the caller's own data only — do NOT add cross-user
 * queries here, that's how you leak enrollments for other students on the
 * same course.
 *
 * Admin-gated (mirrors /api/entitlements/check) and 404s in production
 * builds so this can never be a persistent per-user debug surface if the
 * cleanup below slips. To investigate a specific student's case, an admin
 * can impersonate or the student can be walked through /api/entitlements/check
 * (which returns just the boolean).
 *
 * TODO: This is a temporary debugging surface for the post-purchase gate
 * investigation. Remove once we're satisfied the buyer-side race is closed
 * and no new "still see the paywall" reports come in. Track under whichever
 * issue supersedes this — do NOT let this route go stale in the codebase.
 */
import { NextRequest, NextResponse } from 'next/server'

import { relationId, serializeDoc } from '@/infra/db/content-db'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import {
  findCourseAccessGrants,
  findCourseBySlug,
  listEnrollmentsForUser,
} from '@/server/services/course-access'
import { idCandidates } from '@/server/web-api/progress'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Belt-and-suspenders expiration guard: this endpoint is off on the prod
  // Vercel target so the "someone forgot to delete this" failure mode stays
  // bounded. Preview / dev deploys still see it (VERCEL_ENV=preview), so
  // dev.aguy.co.il investigations don't break. Admin-only gating below is
  // still the real active guard — this just makes the prod exposure zero.
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const user = await getWebUser(request.headers)
  if (!user?.id) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }
  // Admin-gate to match /api/entitlements/check. Serialized entitlement /
  // enrollment docs carry tenant IDs, grantMethod, timestamps — more surface
  // than any normal user page. If we need to debug a specific student, an
  // admin runs this on their behalf.
  if (user.role !== 'admin' && !user.roles?.includes('admin')) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'slug query param required' }, { status: 400 })
  }

  const courseDoc = await findCourseBySlug(slug)
  if (!courseDoc) {
    return NextResponse.json({ error: `no course with slug "${slug}"` }, { status: 404 })
  }
  const courseId = relationId(courseDoc._id) ?? ''

  const userIds = idCandidates(user.id)
  const courseIds = idCandidates(courseId)

  const [grants, allUserEnrollments] = await Promise.all([
    findCourseAccessGrants(user.id, courseId),
    listEnrollmentsForUser(user.id),
  ])
  const { entitlement, enrollment } = grants

  const legacy = grants.legacyEntitlements.map((entry) => ({
    course: entry.course,
    matchesQueryCourse: entry.course === courseId,
    raw: serializeDoc(entry.raw as Record<string, unknown>),
  }))

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
      isActive: courseDoc.isActive ?? null,
    },
    queries: {
      userEntitlement: entitlement ? serializeDoc(entitlement) : null,
      enrollment: enrollment ? serializeDoc(enrollment) : null,
      legacyCourseEntitlements: legacy,
    },
    wouldRequireEntitlement: !(
      entitlement ||
      enrollment ||
      legacy.some((e) => e.matchesQueryCourse)
    ),
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
