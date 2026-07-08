import { NextRequest, NextResponse } from 'next/server'

import { isValidContentLocale } from '@/infra/types/content'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

const VALID_LESSON_TYPES = ['learning', 'practice', 'exam'] as const

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const grade = searchParams.get('grade')

  if (!grade) {
    return NextResponse.json({ error: 'Grade parameter is required' }, { status: 400 })
  }

  const localeParam = searchParams.get('locale')
  const locale = localeParam && isValidContentLocale(localeParam) ? localeParam : undefined
  const courseId = searchParams.get('courseId') || undefined
  const lessonTypeParam = searchParams.get('lessonType')
  const lessonType =
    lessonTypeParam &&
    VALID_LESSON_TYPES.includes(lessonTypeParam as (typeof VALID_LESSON_TYPES)[number])
      ? (lessonTypeParam as (typeof VALID_LESSON_TYPES)[number])
      : 'practice'

  const data = await prefetchStudyData(grade, locale, lessonType, courseId)

  if (!data) {
    return NextResponse.json({
      chapters: [],
      courseSlug: '',
      courseId: '',
      courseTitle: grade,
      courseLabel: grade,
      coursePageAccessType: 'mandatory',
      courseAccessType: 'free',
      gatedDelayMs: 300000,
      gatedWarningMs: 30000,
    })
  }

  const response = NextResponse.json(data)
  response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return response
}
