import { afterEach, describe, expect, it, vi } from 'vitest'

import { appendAuthCookieClearHeaders } from '@/infra/auth/web-auth'

function getSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  return (
    withGetSetCookie.getSetCookie?.() ??
    headers.get('set-cookie')?.split(/, (?=payload-token=)/) ??
    []
  )
}

describe('appendAuthCookieClearHeaders', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('clears the normal auth cookie', () => {
    const headers = new Headers()

    appendAuthCookieClearHeaders(headers)

    expect(getSetCookies(headers)).toContain(
      'payload-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    )
  })

  it('clears the partitioned production auth cookie', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const headers = new Headers()

    appendAuthCookieClearHeaders(headers)

    expect(getSetCookies(headers)).toContain(
      'payload-token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned',
    )
  })
})
