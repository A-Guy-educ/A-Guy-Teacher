import { redirect } from 'next/navigation'

import { returnToPath, sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { getSharedLoginPolicy } from '@/infra/auth/shared-login/policy.env'
import { getMeUser } from '@/infra/utils/getMeUser'

import { PersonaSelectionStep } from './PersonaSelectionStep'

export const metadata = { title: 'Choose Your Teacher' }

export default async function PersonaSelectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/signup')
  }

  const params = await searchParams
  let returnTo = sanitizeReturnTo(params.returnTo, getSharedLoginPolicy())

  // Guard against redirect loops. Compared by path so an absolute sibling URL
  // pointing back at this step is caught too.
  if (returnToPath(returnTo).startsWith('/onboarding/persona')) {
    returnTo = '/'
  }

  return <PersonaSelectionStep returnTo={returnTo} />
}
