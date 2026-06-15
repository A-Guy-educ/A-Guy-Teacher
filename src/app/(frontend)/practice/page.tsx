import { cookies } from 'next/headers'
import { getSystemLocale } from '@/i18n/server-locale'
import { COURSE_ID_COOKIE_NAME, GRADE_COOKIE_NAME } from '@/client/state/localStorage/userProfile'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { StudyContent } from '../study/_components/StudyContent'
import {
  resolveLearningPageSelection,
  type LearningPageSearchParams,
} from '../study/learningPageSelection'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

interface PracticePageProps {
  searchParams: Promise<LearningPageSearchParams>
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const cookieStore = await cookies()
  const params = await searchParams
  const selection = resolveLearningPageSelection({
    cookieCourseId: cookieStore.get(COURSE_ID_COOKIE_NAME)?.value,
    cookieGrade: cookieStore.get(GRADE_COOKIE_NAME)?.value,
    searchParams: params,
    systemLocale: await getSystemLocale(),
  })

  const prefetchedData = selection.grade
    ? await prefetchStudyData(
        selection.grade,
        selection.contentLocale,
        'practice',
        selection.courseId,
      )
    : null

  return (
    <div>
      <StudyContent lessonType="practice" prefetchedData={prefetchedData} />
    </div>
  )
}

export async function generateMetadata() {
  return pageMetadata({
    title: 'תרגול',
    description: 'תרגל נושאים',
  })
}
