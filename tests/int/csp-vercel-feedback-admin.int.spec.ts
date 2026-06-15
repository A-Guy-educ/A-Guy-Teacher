import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { contentSecurityPolicy } from '@/infra/security/content-security-policy.js'
import { middleware } from '@/middleware'

describe('CSP configuration', () => {
  function extractDirective(csp: string, directive: string): string | null {
    const match = csp.match(new RegExp(`${directive}\\s+([^;]+)`))
    return match ? match[1] : null
  }

  function createRequest(pathname: string) {
    const url = new URL(pathname, 'https://kp-866cab-523991-pr-34.fly.dev')
    const headers = new Headers()
    headers.set('host', url.host)

    return new NextRequest(url, { headers })
  }

  it('allows Vercel feedback assets in script-src', () => {
    const scriptSrc = extractDirective(contentSecurityPolicy, 'script-src')

    expect(scriptSrc).not.toBeNull()
    expect(scriptSrc).toContain('https://vercel.live')
  })

  it('allows Vercel feedback connections in connect-src', () => {
    const connectSrc = extractDirective(contentSecurityPolicy, 'connect-src')

    expect(connectSrc).not.toBeNull()
    expect(connectSrc).toContain('https://vercel.live')
  })

  it('allows Vercel live frames in frame-src', () => {
    const frameSrc = extractDirective(contentSecurityPolicy, 'frame-src')

    expect(frameSrc).not.toBeNull()
    expect(frameSrc).toContain('vercel.live')
  })

  it('does not restrict which hosts can embed preview pages', () => {
    expect(contentSecurityPolicy).not.toContain('frame-ancestors')
  })

  it('sets CSP from middleware on admin routes', () => {
    const response = middleware(createRequest('/admin'))

    expect(response.headers.get('Content-Security-Policy')).toBe(contentSecurityPolicy)
    expect(response.headers.get('x-locale')).toBeNull()
  })
})
