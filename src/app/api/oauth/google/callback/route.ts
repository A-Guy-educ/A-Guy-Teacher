import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logOAuthError, logOAuthEvent } from '@/infra/auth/oauth_logger'
import { validateOAuthState } from '@/infra/auth/oauth_state'
import { getPublicBaseUrl } from '@/infra/auth/oauth_url'
import {
  createGoogleUser,
  createSession,
  findUserByEmail,
  findUserByGoogleSub,
  linkGoogleUser,
  setAuthCookie,
} from '@/infra/auth/web-auth'
import { getOnboardingRedirect, START_WIZARD_COMPLETED_COOKIE } from '@/infra/onboarding/redirect'

const googleUserSchema = z.object({
  sub: z.string().min(1),
  email: z
    .string()
    .email()
    .transform((email) => email.toLowerCase()),
  email_verified: z.literal(true),
  name: z.string().optional(),
  picture: z.string().optional(),
})

export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const res = new NextResponse(null, { status: 302 })
  const correlationId = crypto.randomUUID()
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const { valid, returnTo } = validateOAuthState(req, res, state)
  const wizardCompleted = req.cookies.get(START_WIZARD_COMPLETED_COOKIE)?.value === '1'

  if (!valid || !code) {
    res.headers.set('Location', new URL('/login?error=auth_error', req.url).toString())
    return res
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${getPublicBaseUrl(req)}/api/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = (await tokenResponse.json()) as { access_token?: string }
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error('token_exchange_failed')

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const google = googleUserSchema.parse(await userResponse.json())

    const byGoogle = await findUserByGoogleSub(google.sub)
    const byEmail = byGoogle ? null : await findUserByEmail(google.email)
    const isNewUser = !byGoogle && !byEmail
    const user = byGoogle ?? byEmail ?? (await createGoogleUser(google))
    if (!user) throw new Error('user_not_found')
    if (!byGoogle) await linkGoogleUser(user, google)

    const { token } = await createSession(user)
    setAuthCookie(res, token, req.headers)
    await logOAuthEvent(isNewUser ? 'user_created' : 'session_issued', {
      correlationId,
      userId: String(user._id),
      googleSub: google.sub,
    })

    const destination = isNewUser
      ? getOnboardingRedirect(returnTo, { skipPersona: wizardCompleted })
      : returnTo

    res.headers.set('Location', new URL(destination, req.url).toString())
    return res
  } catch (error) {
    logOAuthError('callback_failed', error, correlationId)
    res.headers.set('Location', new URL('/login?error=auth_error', req.url).toString())
    return res
  }
}
