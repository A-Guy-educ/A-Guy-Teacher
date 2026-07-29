import { redirect } from 'next/navigation'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { getSharedLoginPolicy } from '@/infra/auth/shared-login/policy.env'
import { getMeUser } from '@/infra/utils/getMeUser'
import { LoginPageContent } from './LoginPageContent'

export const metadata = { title: 'Log In' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const { user } = await getMeUser()

  if (user) {
    redirect('/home')
  }

  // Resolved here rather than in the form: deciding which sibling apps may be
  // redirected to needs the deployment's policy, and a client component cannot
  // read it — it would silently reject every sibling and send users home.
  const { returnTo } = await searchParams
  const destination = sanitizeReturnTo(returnTo, getSharedLoginPolicy())

  return <LoginPageContent returnTo={destination} />
}
