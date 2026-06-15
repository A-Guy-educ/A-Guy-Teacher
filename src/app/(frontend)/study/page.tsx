import { cookies, headers } from 'next/headers'
import { getSystemLocale } from '@/i18n/server-locale'
import { COURSE_ID_COOKIE_NAME, GRADE_COOKIE_NAME } from '@/client/state/localStorage/userProfile'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { StudyContent } from './_components/StudyContent'
import {
  resolveLearningPageSelection,
  shouldUseEmbeddedLearningFallback,
  type LearningPageSearchParams,
} from './learningPageSelection'
import {
  prefetchEmbeddedLearningFallback,
  prefetchStudyData,
} from '@/server/repos/queries/study-page'

interface StudyPageProps {
  searchParams: Promise<LearningPageSearchParams>
}

export default async function StudyPage({ searchParams }: StudyPageProps) {
  const cookieStore = await cookies()
  const headersList = await headers()
  const params = await searchParams
  const selection = resolveLearningPageSelection({
    cookieCourseId: cookieStore.get(COURSE_ID_COOKIE_NAME)?.value,
    cookieGrade: cookieStore.get(GRADE_COOKIE_NAME)?.value,
    searchParams: params,
    systemLocale: await getSystemLocale(),
  })

  // Server-side prefetch when grade is known (direct DB, no HTTP round-trip)
  const prefetchedData = selection.grade
    ? await prefetchStudyData(
        selection.grade,
        selection.contentLocale,
        'learning',
        selection.courseId,
      )
    : shouldUseEmbeddedLearningFallback({ headersList, selection })
      ? await prefetchEmbeddedLearningFallback(selection.contentLocale, 'learning')
      : null

  return (
    <div>
      <StudyContent lessonType="learning" prefetchedData={prefetchedData} />
    </div>
  )
}

export async function generateMetadata() {
  return pageMetadata({
    title: 'לימוד',
    description: 'בחר נושא ללימוד',
  })
}
