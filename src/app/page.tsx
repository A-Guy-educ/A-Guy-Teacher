import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { CourseManagementView } from '../components/course-management-view'
import { getTeacherLoginUrl, parseManagedCourses, requestManagedCourses } from '../server/aguy-api'

export const dynamic = 'force-dynamic'

export default async function CourseManagementPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value === 'he' ? 'he' : 'en'
  const cookieHeader = cookieStore.toString()
  const response = await requestManagedCourses(cookieHeader, { requestId: crypto.randomUUID() })

  if (response.status === 401) redirect(getTeacherLoginUrl())

  if (response.status === 403) {
    return (
      <div className="teacher-page teacher-access-denied">
        <h1>{locale === 'he' ? 'אין הרשאה לניהול קורסים' : 'Course access is restricted'}</h1>
        <p>
          {locale === 'he'
            ? 'העמוד זמין למנהלים ולעורכי תוכן מתקדמים.'
            : 'This page is available to administrators and advanced content editors.'}
        </p>
        <a className="teacher-button" href="https://www.aguy.co.il/">
          {locale === 'he' ? 'חזרה לאתר הלמידה' : 'Return to the learning site'}
        </a>
      </div>
    )
  }

  if (!response.ok) {
    throw new Error(`Course management API failed (${response.status})`)
  }

  const { docs } = await parseManagedCourses(response)
  return <CourseManagementView courses={docs} locale={locale} />
}
