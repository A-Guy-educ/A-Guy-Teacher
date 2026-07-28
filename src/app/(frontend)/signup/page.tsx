import { redirect } from 'next/navigation'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { getSharedLoginPolicy } from '@/infra/auth/shared-login/policy.env'
import { isPasswordLoginEnabled } from '@/infra/config/system-params'
import { SignupPageContent } from './SignupPageContent'

export const metadata = { title: 'Sign Up' }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const passwordEnabled = await isPasswordLoginEnabled()
  const params = await searchParams

  if (!passwordEnabled) {
    const query = new URLSearchParams(params).toString()
    redirect(query ? `/login?${query}` : '/login')
  }

  // Sanitized server-side: only here is the set of trusted sibling apps known.
  return <SignupPageContent returnTo={sanitizeReturnTo(params.returnTo, getSharedLoginPolicy())} />
}
