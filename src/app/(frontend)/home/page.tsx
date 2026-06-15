import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { COURSE_ID_COOKIE_NAME } from '@/client/state/localStorage/userProfile'
import { resolveHomeRedirect } from '@/infra/onboarding/homeRedirect'
import { getMeUser } from '@/infra/utils/getMeUser'

export const metadata = { title: 'Home' }

export default async function HomePage() {
  const { user } = await getMeUser()
  const cookieStore = await cookies()
  const selectedCourseId = cookieStore.get(COURSE_ID_COOKIE_NAME)?.value

  redirect(
    resolveHomeRedirect({
      isAuthenticated: Boolean(user),
      selectedCourseId,
    }),
  )
}
