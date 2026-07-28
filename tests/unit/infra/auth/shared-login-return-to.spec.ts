import { afterEach, describe, expect, it, vi } from 'vitest'

import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'

describe('sanitizeReturnTo with shared login configured', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows returning to a sibling app on the shared-login domain', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    expect(sanitizeReturnTo('https://app2.a-guy.co.il/dashboard')).toBe(
      'https://app2.a-guy.co.il/dashboard',
    )
  })

  it('allows the apex domain itself', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    expect(sanitizeReturnTo('https://a-guy.co.il/home')).toBe('https://a-guy.co.il/home')
  })

  it('preserves query strings and fragments on sibling URLs', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    expect(sanitizeReturnTo('https://app2.a-guy.co.il/x?ref=login#top')).toBe(
      'https://app2.a-guy.co.il/x?ref=login#top',
    )
  })

  it('still rejects unrelated origins', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    expect(sanitizeReturnTo('https://evil.com/steal')).toBe('/')
  })

  it('rejects a lookalike domain that merely ends with the same letters', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    expect(sanitizeReturnTo('https://not-a-guy.co.il/steal')).toBe('/')
  })

  it('rejects plain HTTP siblings, since the shared cookie is Secure', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    expect(sanitizeReturnTo('http://app2.a-guy.co.il/dashboard')).toBe('/')
  })

  it('allows an explicitly listed origin, for local development over HTTP', () => {
    vi.stubEnv('AUTH_ALLOWED_RETURN_ORIGINS', 'http://app2.lvh.me:3001')

    expect(sanitizeReturnTo('http://app2.lvh.me:3001/dashboard')).toBe(
      'http://app2.lvh.me:3001/dashboard',
    )
  })

  it('does not allow an unlisted port on an otherwise listed host', () => {
    vi.stubEnv('AUTH_ALLOWED_RETURN_ORIGINS', 'http://app2.lvh.me:3001')

    expect(sanitizeReturnTo('http://app2.lvh.me:4000/dashboard')).toBe('/')
  })

  it('keeps relative paths working exactly as before', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    expect(sanitizeReturnTo('/courses?ref=header#section')).toBe('/courses?ref=header#section')
    expect(sanitizeReturnTo('//evil.com')).toBe('/')
    expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/')
  })
})
