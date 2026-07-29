import { describe, expect, it } from 'vitest'

import {
  isSiblingOrigin,
  isTrustedOrigin,
  parseOrigin,
  SINGLE_APP_POLICY,
  toCookieDomain,
} from '@/infra/auth/shared-login/policy'

describe('toCookieDomain', () => {
  it('is undefined when unconfigured, keeping cookies host-only', () => {
    expect(toCookieDomain(undefined)).toBeUndefined()
    expect(toCookieDomain(null)).toBeUndefined()
    expect(toCookieDomain('   ')).toBeUndefined()
  })

  it('normalises to a lowercase, dot-prefixed domain', () => {
    expect(toCookieDomain('aguy.co.il')).toBe('.aguy.co.il')
    expect(toCookieDomain('.AGuy.co.il')).toBe('.aguy.co.il')
    expect(toCookieDomain('  aguy.co.il  ')).toBe('.aguy.co.il')
  })

  it('rejects single-label hosts, which browsers refuse as a cookie Domain', () => {
    expect(toCookieDomain('localhost')).toBeUndefined()
  })

  it.each(['vercel.app', 'my-app.vercel.app', 'preview.fly.dev', 'x.pages.dev', 'a.netlify.app'])(
    'rejects %s, an apex shared with unrelated tenants',
    (domain) => {
      expect(toCookieDomain(domain)).toBeUndefined()
    },
  )
})

describe('isSiblingOrigin', () => {
  const cookieDomain = '.aguy.co.il'

  it('accepts a subdomain of the cookie domain', () => {
    expect(isSiblingOrigin(new URL('https://app2.aguy.co.il/x'), cookieDomain)).toBe(true)
  })

  it('accepts the apex itself', () => {
    expect(isSiblingOrigin(new URL('https://aguy.co.il/x'), cookieDomain)).toBe(true)
  })

  it('rejects a lookalike that merely ends with the same letters', () => {
    expect(isSiblingOrigin(new URL('https://not-aguy.co.il/x'), cookieDomain)).toBe(false)
  })

  it('rejects plain HTTP, since the shared cookie is Secure', () => {
    expect(isSiblingOrigin(new URL('http://app2.aguy.co.il/x'), cookieDomain)).toBe(false)
  })

  it('rejects everything when no cookie domain is configured', () => {
    expect(isSiblingOrigin(new URL('https://app2.aguy.co.il/x'), undefined)).toBe(false)
  })
})

describe('isTrustedOrigin', () => {
  it('accepts an explicitly listed origin over plain HTTP, for local development', () => {
    expect(
      isTrustedOrigin(new URL('http://app2.lvh.me:3001/x'), ['http://app2.lvh.me:3001'], undefined),
    ).toBe(true)
  })

  it('matches the listed origin exactly, including port', () => {
    expect(
      isTrustedOrigin(new URL('http://app2.lvh.me:4000/x'), ['http://app2.lvh.me:3001'], undefined),
    ).toBe(false)
  })

  it('trusts nothing under the single-app policy', () => {
    expect(
      isTrustedOrigin(
        new URL('https://app2.aguy.co.il/x'),
        SINGLE_APP_POLICY.returnOrigins,
        SINGLE_APP_POLICY.cookieDomain,
      ),
    ).toBe(false)
  })
})

describe('parseOrigin', () => {
  it('returns undefined for absent or malformed values', () => {
    expect(parseOrigin(null)).toBeUndefined()
    expect(parseOrigin('')).toBeUndefined()
    expect(parseOrigin('not a url')).toBeUndefined()
  })

  it('parses a valid origin', () => {
    expect(parseOrigin('https://app2.aguy.co.il')?.hostname).toBe('app2.aguy.co.il')
  })
})
