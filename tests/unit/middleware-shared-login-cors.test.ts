import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { middleware } from '@/middleware'

function createRequest(
  pathname: string,
  { origin, method = 'GET' }: { origin?: string; method?: string } = {},
) {
  const url = new URL(pathname, 'https://www.aguy.co.il')
  const headers = new Headers({ host: url.host })
  if (origin) headers.set('origin', origin)

  return new NextRequest(url, { headers, method })
}

describe('middleware CORS for sibling apps', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows an API call from a sibling app on the shared-login domain', () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    const response = middleware(
      createRequest('/api/users/me', { origin: 'https://app2.aguy.co.il' }),
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app2.aguy.co.il')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    expect(response.headers.get('Vary')).toContain('Origin')
  })

  it('never answers with a wildcard, which browsers reject alongside credentials', () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    const response = middleware(
      createRequest('/api/users/me', { origin: 'https://app2.aguy.co.il' }),
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*')
  })

  it('denies an unrelated origin', () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    const response = middleware(createRequest('/api/users/me', { origin: 'https://evil.com' }))

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('denies a lookalike domain', () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    const response = middleware(
      createRequest('/api/users/me', { origin: 'https://not-aguy.co.il' }),
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('adds no CORS headers when shared login is not configured', () => {
    const response = middleware(
      createRequest('/api/users/me', { origin: 'https://app2.aguy.co.il' }),
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('answers the preflight without running the request', () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    const response = middleware(
      createRequest('/api/users/me', { origin: 'https://app2.aguy.co.il', method: 'OPTIONS' }),
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app2.aguy.co.il')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('honours an explicitly allowed origin for local development', () => {
    vi.stubEnv('API_ALLOWED_ORIGINS', 'http://app2.lvh.me:3001')

    const response = middleware(
      createRequest('/api/users/me', { origin: 'http://app2.lvh.me:3001' }),
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://app2.lvh.me:3001')
  })

  it('leaves non-API routes untouched', () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    const response = middleware(createRequest('/start', { origin: 'https://app2.aguy.co.il' }))

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
