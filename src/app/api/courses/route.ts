import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPublishedCourseList } from '@/server/services/course-list-service'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // public endpoint: published course catalog
  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')
  const courseLabel = searchParams.get('where[courseLabel][equals]')

  let docs = await getPublishedCourseList()
  if (id) docs = docs.filter((course) => course.id === id)
  if (courseLabel) docs = docs.filter((course) => course.courseLabel === courseLabel)

  return NextResponse.json({
    docs,
    totalDocs: docs.length,
    limit: docs.length,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  })
}
