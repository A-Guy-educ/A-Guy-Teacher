import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { contentSecurityPolicy } from '@/infra/security/content-security-policy.js'
import { middleware } from '@/middleware'

describe('middleware CSP', () => {
  function createRequest(pathname = '/start', host = 'kp-866cab-523991-pr-34.fly.dev') {
    const url = new URL(pathname, `https://${host}`)
    const headers = new Headers()
    headers.set('host', url.host)

    return new NextRequest(url, { headers })
  }

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sets the shared CSP on preview pages', () => {
    const response = middleware(createRequest('/start'))

    expect(response.headers.get('Content-Security-Policy')).toBe(contentSecurityPolicy)
  })

  it('does not emit frame ancestor restrictions', () => {
    const response = middleware(createRequest('/start'))
    const csp = response.headers.get('Content-Security-Policy')

    expect(csp).not.toContain('frame-ancestors')
    expect(csp).not.toContain('kody-dashboard-aguy.vercel.app')
    expect(csp).not.toContain('kody-dashboard-sable.vercel.app')
  })

  it('keeps the PDF viewer free to use its own response headers', () => {
    const response = middleware(createRequest('/api/pdfjs-viewer'))

    expect(response.headers.get('Content-Security-Policy')).toBeNull()
  })

  it('keeps learning routes protected by default on Kody preview hosts', () => {
    const response = middleware(createRequest('/study'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows learning routes on Kody preview hosts when the preview bypass is enabled', () => {
    vi.stubEnv('KODY_PREVIEW_AUTH_BYPASS', 'true')

    const response = middleware(createRequest('/study'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not bypass auth on normal hosts even when the preview bypass is enabled', () => {
    vi.stubEnv('KODY_PREVIEW_AUTH_BYPASS', 'true')

    const response = middleware(createRequest('/study', 'example.com'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
