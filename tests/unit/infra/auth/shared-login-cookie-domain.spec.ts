import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getAuthCookieOptionsForRequest,
  isEmbeddedOAuthContext,
  resolveAuthCookieDomain,
} from '@/infra/auth/oauth_constants'
import { appendAuthCookieClearHeaders, authCookieDeleteOptions } from '@/infra/auth/web-auth'

function getSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  return (
    withGetSetCookie.getSetCookie?.() ??
    headers.get('set-cookie')?.split(/, (?=payload-token=)/) ??
    []
  )
}

describe('resolveAuthCookieDomain', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is undefined when unconfigured, keeping the cookie host-only', () => {
    expect(resolveAuthCookieDomain()).toBeUndefined()
  })

  it('normalises to a leading dot', () => {
    vi.stubEnv('ROOT_DOMAIN', 'a-guy.co.il')
    expect(resolveAuthCookieDomain()).toBe('.a-guy.co.il')
  })

  it('accepts a value that already has a leading dot', () => {
    vi.stubEnv('ROOT_DOMAIN', '.A-Guy.co.il')
    expect(resolveAuthCookieDomain()).toBe('.a-guy.co.il')
  })

  it('ignores surrounding whitespace', () => {
    vi.stubEnv('ROOT_DOMAIN', '  a-guy.co.il  ')
    expect(resolveAuthCookieDomain()).toBe('.a-guy.co.il')
  })

  it('rejects single-label hosts (browsers refuse Domain=.localhost)', () => {
    vi.stubEnv('ROOT_DOMAIN', 'localhost')
    expect(resolveAuthCookieDomain()).toBeUndefined()
  })

  it.each(['vercel.app', 'my-app.vercel.app', 'preview.fly.dev', 'x.pages.dev'])(
    'rejects the shared platform domain %s',
    (domain) => {
      vi.stubEnv('ROOT_DOMAIN', domain)
      expect(resolveAuthCookieDomain()).toBeUndefined()
    },
  )
})

describe('getAuthCookieOptionsForRequest with a shared domain', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('scopes top-level logins to the parent domain', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ROOT_DOMAIN', 'a-guy.co.il')

    const options = getAuthCookieOptionsForRequest(new Headers({ 'Sec-Fetch-Dest': 'document' }))

    expect(options.domain).toBe('.a-guy.co.il')
    expect(options.sameSite).toBe('lax')
    expect(options.partitioned).toBe(false)
  })

  it('omits the domain for partitioned iframe cookies, which cannot be shared anyway', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ROOT_DOMAIN', 'a-guy.co.il')

    const options = getAuthCookieOptionsForRequest(new Headers({ 'Sec-Fetch-Dest': 'iframe' }))

    expect(options.domain).toBeUndefined()
    expect(options.partitioned).toBe(true)
  })

  it('leaves the cookie host-only when no domain is configured', () => {
    vi.stubEnv('NODE_ENV', 'production')

    const options = getAuthCookieOptionsForRequest(new Headers({ 'Sec-Fetch-Dest': 'document' }))

    expect(options.domain).toBeUndefined()
  })
})

describe('isEmbeddedOAuthContext for server actions', () => {
  it('treats a cross-site fetch (server action inside the preview iframe) as embedded', () => {
    const headers = new Headers({ 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Site': 'cross-site' })
    expect(isEmbeddedOAuthContext(headers)).toBe(true)
  })

  it('does not treat a cross-site top-level navigation as embedded (Google OAuth redirect)', () => {
    const headers = new Headers({ 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Site': 'cross-site' })
    expect(isEmbeddedOAuthContext(headers)).toBe(false)
  })

  it('does not treat a same-origin fetch as embedded', () => {
    const headers = new Headers({ 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Site': 'same-origin' })
    expect(isEmbeddedOAuthContext(headers)).toBe(false)
  })
})

describe('logout clears the shared cookie', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('emits a Domain-scoped clear so sibling apps are logged out too', () => {
    vi.stubEnv('ROOT_DOMAIN', 'a-guy.co.il')
    const headers = new Headers()

    appendAuthCookieClearHeaders(headers)

    expect(getSetCookies(headers)).toContain(
      'payload-token=; Path=/; Max-Age=0; HttpOnly; Domain=.a-guy.co.il; SameSite=Lax',
    )
  })

  it('emits no Domain-scoped clear when shared login is off', () => {
    const headers = new Headers()

    appendAuthCookieClearHeaders(headers)

    expect(getSetCookies(headers).some((cookie) => cookie.includes('Domain='))).toBe(false)
  })

  it('mirrors the write scope in the cookie-store delete options', () => {
    vi.stubEnv('ROOT_DOMAIN', 'a-guy.co.il')

    expect(authCookieDeleteOptions()).toEqual({
      name: 'payload-token',
      path: '/',
      domain: '.a-guy.co.il',
    })
  })
})
