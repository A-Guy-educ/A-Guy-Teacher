'use server'

import { cookies } from 'next/headers'

import { createPasswordUser, setAuthCookie } from '@/infra/auth/web-auth'
import { checkRateLimit } from './signup_rateLimit-action'
import { SignupSchema, type SignupResult } from '../signup_schemas'

type CookieStore = Parameters<typeof setAuthCookie>[0]['cookies']

export async function signupAction(
  formData: FormData,
  _cookieStore?: CookieStore,
): Promise<SignupResult> {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    website: formData.get('website'),
  }

  if (rawData.website && rawData.website.toString().trim() !== '') {
    return {
      success: false,
      message: 'Unable to create account. Please try again.',
    }
  }

  const parsed = SignupSchema.safeParse(rawData)

  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((err) => {
      if (err.path[0]) {
        errors[err.path[0].toString()] = err.message
      }
    })
    return { success: false, message: 'Validation failed', errors }
  }

  const { email, password, confirmPassword } = parsed.data

  if (password !== confirmPassword) {
    return {
      success: false,
      errors: { confirmPassword: 'Passwords do not match' },
    }
  }

  const emailHash = Buffer.from(email).toString('base64')
  if (!checkRateLimit(emailHash)) {
    return {
      success: false,
      error: 'Too many signup attempts. Please try again later.',
    }
  }

  const session = await createPasswordUser({
    name: parsed.data.name,
    email,
    password,
  })

  if (!session) {
    return {
      success: false,
      error: 'Email is already registered',
    }
  }

  const store = _cookieStore ?? (await cookies())
  setAuthCookie({ cookies: store }, session.token)

  return { success: true, userId: session.user.id, data: { userId: session.user.id } }
}
