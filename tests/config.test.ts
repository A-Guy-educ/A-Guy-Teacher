import { describe, expect, it } from 'vitest'

import config from '../next.config.js'
import { GET } from '../src/app/api/health/route.js'
import robots from '../src/app/robots.js'

describe('Teacher deployment boundary', () => {
  it('serves only Teacher routes, without proxying to Web', () => {
    expect('rewrites' in config).toBe(false)
  })

  it('keeps the Teacher health route local and secret-free', async () => {
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      service: 'A-Guy Teacher',
      mode: 'class-dashboard',
      status: 'ok',
    })
  })

  it('blocks crawlers from indexing the private teacher app', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    })
  })
})
