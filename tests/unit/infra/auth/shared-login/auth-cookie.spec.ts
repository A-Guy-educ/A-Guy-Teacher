import { describe, expect, it } from 'vitest'

import {
  authCookieClearHeaders,
  authCookieIdentity,
  buildAuthCookieOptions,
  AUTH_COOKIE_NAME,
} from '@/infra/auth/shared-login/auth-cookie'
import { SINGLE_APP_POLICY, type SharedLoginPolicy } from '@/infra/auth/shared-login/policy'

const SHARED: SharedLoginPolicy = {
  cookieDomain: '.aguy.co.il',
  returnOrigins: [],
  apiOrigins: [],
}

describe('buildAuthCookieOptions', () => {
  it('scopes a top-level login to the shared domain', () => {
    const options = buildAuthCookieOptions(SHARED, { embedded: false, secure: true })

    expect(options).toMatchObject({
      domain: '.aguy.co.il',
      sameSite: 'lax',
      partitioned: false,
      httpOnly: true,
      secure: true,
      path: '/',
    })
  })

  it('omits the domain for an embedded login, which cannot be shared anyway', () => {
    const options = buildAuthCookieOptions(SHARED, { embedded: true, secure: true })

    expect(options.domain).toBeUndefined()
    expect(options.partitioned).toBe(true)
    expect(options.sameSite).toBe('none')
  })

  it('never partitions an insecure deployment, where SameSite=None is invalid', () => {
    const options = buildAuthCookieOptions(SHARED, { embedded: true, secure: false })

    expect(options.partitioned).toBe(false)
    expect(options.sameSite).toBe('lax')
  })

  it('leaves the cookie host-only under the single-app policy', () => {
    const options = buildAuthCookieOptions(SINGLE_APP_POLICY, { embedded: false, secure: true })

    expect(options.domain).toBeUndefined()
  })
})

describe('authCookieIdentity', () => {
  it('mirrors the write scope so the delete actually removes the cookie', () => {
    expect(authCookieIdentity(SHARED)).toEqual({
      name: AUTH_COOKIE_NAME,
      path: '/',
      domain: '.aguy.co.il',
    })
  })

  it('omits the domain when shared login is off', () => {
    expect(authCookieIdentity(SINGLE_APP_POLICY)).toEqual({ name: AUTH_COOKIE_NAME, path: '/' })
  })
})

describe('authCookieClearHeaders', () => {
  it('clears the plain cookie in development', () => {
    expect(authCookieClearHeaders(SINGLE_APP_POLICY, false)).toEqual([
      'payload-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ])
  })

  it('also clears the partitioned variant on a secure deployment', () => {
    expect(authCookieClearHeaders(SINGLE_APP_POLICY, true)).toEqual([
      'payload-token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None',
      'payload-token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned',
    ])
  })

  it('also clears the domain-scoped variant, or siblings stay signed in', () => {
    expect(authCookieClearHeaders(SHARED, true)).toContain(
      'payload-token=; Path=/; Max-Age=0; HttpOnly; Secure; Domain=.aguy.co.il; SameSite=None',
    )
  })

  it('clears every scope at once, since all three can coexist during rollout', () => {
    expect(authCookieClearHeaders(SHARED, true)).toHaveLength(3)
  })
})
