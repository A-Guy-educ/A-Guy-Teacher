import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AUTH_COOKIE_OPTIONS,
  getAuthCookieOptionsForRequest,
  isEmbeddedOAuthContext,
} from '@/infra/auth/oauth_constants'

describe('isEmbeddedOAuthContext', () => {
  it('returns true when Sec-Fetch-Dest is iframe (any casing)', () => {
    expect(isEmbeddedOAuthContext(new Headers({ 'Sec-Fetch-Dest': 'iframe' }))).toBe(true)
    expect(isEmbeddedOAuthContext(new Headers({ 'sec-fetch-dest': 'IFRAME' }))).toBe(true)
  })

  it('returns false for top-level destinations', () => {
    expect(isEmbeddedOAuthContext(new Headers({ 'Sec-Fetch-Dest': 'document' }))).toBe(false)
    expect(isEmbeddedOAuthContext(new Headers({ 'Sec-Fetch-Dest': 'empty' }))).toBe(false)
    expect(isEmbeddedOAuthContext(new Headers({ 'Sec-Fetch-Dest': 'script' }))).toBe(false)
  })

  it('returns false when the header is missing', () => {
    expect(isEmbeddedOAuthContext(new Headers())).toBe(false)
  })
})

describe('getAuthCookieOptionsForRequest (dev)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the default AUTH_COOKIE_OPTIONS in development regardless of headers', () => {
    vi.stubEnv('NODE_ENV', 'development')

    const iframe = getAuthCookieOptionsForRequest(new Headers({ 'Sec-Fetch-Dest': 'iframe' }))
    const topLevel = getAuthCookieOptionsForRequest(new Headers({ 'Sec-Fetch-Dest': 'document' }))
    const empty = getAuthCookieOptionsForRequest(new Headers())

    expect(iframe).toEqual(AUTH_COOKIE_OPTIONS)
    expect(topLevel).toEqual(AUTH_COOKIE_OPTIONS)
    expect(empty).toEqual(AUTH_COOKIE_OPTIONS)
  })
})

describe('getAuthCookieOptionsForRequest (production)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps SameSite=None + Partitioned for iframe (Kody preview) requests', () => {
    vi.stubEnv('NODE_ENV', 'production')

    const options = getAuthCookieOptionsForRequest(new Headers({ 'Sec-Fetch-Dest': 'iframe' }))

    expect(options.sameSite).toBe('none')
    expect(options.partitioned).toBe(true)
    expect(options.secure).toBe(true)
  })

  it('uses SameSite=Lax and drops Partitioned for top-level OAuth requests (mobile/desktop fix)', () => {
    vi.stubEnv('NODE_ENV', 'production')

    const options = getAuthCookieOptionsForRequest(new Headers({ 'Sec-Fetch-Dest': 'document' }))

    expect(options.sameSite).toBe('lax')
    expect(options.partitioned).toBe(false)
    expect(options.secure).toBe(true)
    // httpOnly and path must still be set so the cookie keeps its server-side identity
    expect(options.httpOnly).toBe(true)
    expect(options.path).toBe('/')
  })

  it('falls back to SameSite=Lax when the Sec-Fetch-Dest header is missing (mobile Safari quirk)', () => {
    vi.stubEnv('NODE_ENV', 'production')

    const options = getAuthCookieOptionsForRequest(new Headers())

    expect(options.sameSite).toBe('lax')
    expect(options.partitioned).toBe(false)
  })
})
