'use server'

import { cookies } from 'next/headers'

import { AUTH_COOKIE_NAME, authCookieDeleteOptions, revokeSession } from '@/infra/auth/web-auth'

export async function logoutAction() {
  const cookieStore = await cookies()

  // Revoke server-side first: clearing the cookie alone leaves the session
  // valid for any copy of the token, and for every sibling app on the domain.
  await revokeSession(cookieStore.get(AUTH_COOKIE_NAME)?.value)

  // Must mirror the write scope — a delete without `Domain` cannot remove a
  // domain-scoped cookie, which would leave the user signed in elsewhere.
  cookieStore.delete(authCookieDeleteOptions())

  return { success: true }
}
