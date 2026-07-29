import { describe, expect, it } from 'vitest'

import { returnToPath, sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { SINGLE_APP_POLICY, type SharedLoginPolicy } from '@/infra/auth/shared-login/policy'

const SHARED: SharedLoginPolicy = {
  cookieDomain: '.a-guy.co.il',
  returnOrigins: [],
  apiOrigins: [],
}

const DEV: SharedLoginPolicy = {
  returnOrigins: ['http://app2.lvh.me:3001'],
  apiOrigins: [],
}

describe('sanitizeReturnTo with shared login configured', () => {
  it('allows returning to a sibling app on the shared-login domain', () => {
    expect(sanitizeReturnTo('https://app2.a-guy.co.il/dashboard', SHARED)).toBe(
      'https://app2.a-guy.co.il/dashboard',
    )
  })

  it('allows the apex domain itself', () => {
    expect(sanitizeReturnTo('https://a-guy.co.il/home', SHARED)).toBe('https://a-guy.co.il/home')
  })

  it('preserves query strings and fragments on sibling URLs', () => {
    expect(sanitizeReturnTo('https://app2.a-guy.co.il/x?ref=login#top', SHARED)).toBe(
      'https://app2.a-guy.co.il/x?ref=login#top',
    )
  })

  it('still rejects unrelated origins', () => {
    expect(sanitizeReturnTo('https://evil.com/steal', SHARED)).toBe('/')
  })

  it('rejects a lookalike domain that merely ends with the same letters', () => {
    expect(sanitizeReturnTo('https://not-a-guy.co.il/steal', SHARED)).toBe('/')
  })

  it('rejects plain HTTP siblings, since the shared cookie is Secure', () => {
    expect(sanitizeReturnTo('http://app2.a-guy.co.il/dashboard', SHARED)).toBe('/')
  })

  it('allows an explicitly listed origin, for local development over HTTP', () => {
    expect(sanitizeReturnTo('http://app2.lvh.me:3001/dashboard', DEV)).toBe(
      'http://app2.lvh.me:3001/dashboard',
    )
  })

  it('does not allow an unlisted port on an otherwise listed host', () => {
    expect(sanitizeReturnTo('http://app2.lvh.me:4000/dashboard', DEV)).toBe('/')
  })

  it('keeps relative paths working exactly as before', () => {
    expect(sanitizeReturnTo('/courses?ref=header#section', SHARED)).toBe(
      '/courses?ref=header#section',
    )
    expect(sanitizeReturnTo('//evil.com', SHARED)).toBe('/')
    expect(sanitizeReturnTo('javascript:alert(1)', SHARED)).toBe('/')
  })
})

describe('sanitizeReturnTo under the single-app policy', () => {
  it('is relative-only', () => {
    expect(sanitizeReturnTo('https://app2.a-guy.co.il/dashboard', SINGLE_APP_POLICY)).toBe('/')
    expect(sanitizeReturnTo('/courses', SINGLE_APP_POLICY)).toBe('/courses')
  })
})

describe('returnToPath', () => {
  it('returns a relative destination unchanged', () => {
    expect(returnToPath('/onboarding/persona?returnTo=%2Fx')).toBe(
      '/onboarding/persona?returnTo=%2Fx',
    )
  })

  it('extracts the path from an absolute sibling destination', () => {
    expect(returnToPath('https://app2.a-guy.co.il/onboarding/persona?a=1#b')).toBe(
      '/onboarding/persona?a=1#b',
    )
  })
})
