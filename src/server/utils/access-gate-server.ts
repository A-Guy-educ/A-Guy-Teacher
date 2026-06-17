/**
 * Server-side authentication using signed HTTP-only cookies.
 *
 * Uses Payload's JWT session cookie to retrieve the authenticated user
 * in Server Components, Server Actions, and API Route Handlers.
 *
 * @fileType utility
 * @domain auth
 * @pattern server-auth
 * @ai-summary Retrieves the authenticated user from a signed HTTP-only cookie on the server; returns `payload: null` to signal this is auth-only, not a full Payload instance.
 */
import { cookies } from 'next/headers'

import { AUTH_COOKIE_NAME, getSessionFromToken } from '@/infra/auth/web-auth'

interface AuthResult {
  user: { id: string; role?: string | null; roles?: string[] | null } | null
  payload: null
}

export async function getAuthenticatedUserServer(): Promise<AuthResult> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  const session = await getSessionFromToken(token)
  return { user: session?.user ?? null, payload: null }
}

export async function isAuthenticatedServer(): Promise<boolean> {
  const { user } = await getAuthenticatedUserServer()
  return Boolean(user)
}
