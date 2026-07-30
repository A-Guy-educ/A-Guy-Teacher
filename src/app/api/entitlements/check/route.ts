import { NextRequest, NextResponse } from 'next/server'

import { getWebUser } from '@/infra/web-api/mongo-payload'
import { findCourseAccessGrants, grantsAccess } from '@/server/services/course-access'

export async function GET(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return NextResponse.json({ hasAccess: false }, { status: 401 })

  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  if (user.role === 'admin' || user.roles?.includes('admin')) {
    return NextResponse.json({ hasAccess: true })
  }

  const grants = await findCourseAccessGrants(user.id, courseId)
  return NextResponse.json({ hasAccess: grantsAccess(grants, courseId) })
}
