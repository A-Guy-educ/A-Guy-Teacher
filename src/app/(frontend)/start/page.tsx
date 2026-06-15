import type { Metadata } from 'next'

import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { isValidContentLocale } from '@/infra/types/content'
import { getPublishedCourseList } from '@/server/services/course-list-service'

import { StartPageClient } from './StartPageClient'

export const revalidate = 60

export default async function StartPage() {
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined
  const courses = await getPublishedCourseList(contentLocale)

  return <StartPageClient courses={courses} direction={getDirection(locale)} />
}

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Aguy - כניסה למערכת הלמידה החכמה',
    description: 'מערכת למידה אישית למתמטיקה עם שיעורים, תרגול, שאלות ומבחנים.',
  })
}
