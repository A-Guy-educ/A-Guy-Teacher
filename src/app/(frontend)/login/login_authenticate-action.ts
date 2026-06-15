'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'

import { loginWithPassword, setAuthCookie } from '@/infra/auth/web-auth'
import { logger } from '@/infra/utils/logger'

type CookieStore = Parameters<typeof setAuthCookie>[0]['cookies']

export async function loginAction(_formData: FormData, _cookieStore?: CookieStore) {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .safeParse({
      email: _formData.get('email'),
      password: _formData.get('password'),
    })

  if (!parsed.success) return { success: false, error: 'invalidCredentials' }

  try {
    const session = await loginWithPassword(parsed.data.email, parsed.data.password)
    if (!session) return { success: false, error: 'invalidCredentials' }
    const store = _cookieStore ?? (await cookies())
    setAuthCookie({ cookies: store }, session.token)
    return { success: true }
  } catch (error) {
    logger.error({ err: error }, 'Login failed')
    return { success: false, error: 'invalidCredentials' }
  }
}
