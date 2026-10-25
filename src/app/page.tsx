import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { ClassDashboard } from '../components/class-dashboard'
import {
  getTeacherLoginUrl,
  getWebOrigin,
  parseClassProgress,
  parseTeacherClasses,
  requestClassProgress,
  requestTeacherClasses,
} from '../server/aguy-api'
import { demoClassProgress, demoClasses, isDemoDataEnabled } from '../server/demo-data'
import type { ClassProgressResponse, TeacherClassesResponse } from '../types/class-progress'

export const dynamic = 'force-dynamic'

type Locale = 'en' | 'he'

const COPY = {
  en: {
    deniedTitle: 'This page is for classroom teachers',
    deniedBody: 'Your account is not assigned to any class yet.',
    back: 'Return to the learning site',
  },
  he: {
    deniedTitle: 'העמוד מיועד למורי כיתות',
    deniedBody: 'החשבון שלך עדיין לא משויך לאף כיתה.',
    back: 'חזרה לאתר הלמידה',
  },
} as const

function NotAuthorized({ locale, webOrigin }: { locale: Locale; webOrigin: string }) {
  const copy = COPY[locale]
  return (
    <div className="teacher-page teacher-access-denied">
      <h1>{copy.deniedTitle}</h1>
      <p>{copy.deniedBody}</p>
      <a className="teacher-button" href={`${webOrigin}/`}>
        {copy.back}
      </a>
    </div>
  )
}

async function loadClasses(cookieHeader: string): Promise<TeacherClassesResponse | number> {
  if (isDemoDataEnabled()) return demoClasses()
  const response = await requestTeacherClasses(cookieHeader, { requestId: crypto.randomUUID() })
  if (!response.ok) return response.status
  return parseTeacherClasses(response)
}

async function loadProgress(
  cookieHeader: string,
  classId: string,
): Promise<ClassProgressResponse | number> {
  if (isDemoDataEnabled()) return demoClassProgress(classId) ?? 404
  const response = await requestClassProgress(cookieHeader, classId, {
    requestId: crypto.randomUUID(),
  })
  if (!response.ok) return response.status
  return parseClassProgress(response)
}

export default async function ClassDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>
}) {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('NEXT_LOCALE')?.value === 'he' ? 'he' : 'en'
  const cookieHeader = cookieStore.toString()
  const webOrigin = getWebOrigin().origin

  const classes = await loadClasses(cookieHeader)
  if (classes === 401) redirect(getTeacherLoginUrl())
  if (classes === 403) return <NotAuthorized locale={locale} webOrigin={webOrigin} />
  if (typeof classes === 'number') throw new Error(`Teacher classes API failed (${classes})`)
  if (classes.classes.length === 0) return <NotAuthorized locale={locale} webOrigin={webOrigin} />

  const requested = (await searchParams).class
  const selected = classes.classes.find((c) => c.id === requested) ?? classes.classes[0]

  const progress = await loadProgress(cookieHeader, selected.id)
  if (progress === 401) redirect(getTeacherLoginUrl())
  if (progress === 403 || progress === 404) {
    return <NotAuthorized locale={locale} webOrigin={webOrigin} />
  }
  if (typeof progress === 'number') throw new Error(`Class progress API failed (${progress})`)

  return (
    <ClassDashboard
      classes={classes.classes}
      demo={isDemoDataEnabled()}
      // Remount on class change so sorting, paging and the open panel reset.
      key={selected.id}
      locale={locale}
      progress={progress}
    />
  )
}
