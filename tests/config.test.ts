import { describe, expect, it } from 'vitest'

import config from '../next.config.js'
import { GET } from '../src/app/api/health/route.js'
import robots from '../src/app/robots.js'

describe('Teacher deployment boundary', () => {
  it('passes unmatched routes through to the canonical Web application', async () => {
    const rewrites = await config.rewrites?.()

    expect(rewrites).toEqual({
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/:path*',
          destination: 'http://app.lvh.me:3000/:path*',
        },
      ],
    })
  })

  it('keeps the Teacher health route local and secret-free', async () => {
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      service: 'A-Guy Teacher',
      mode: 'course-management',
      status: 'ok',
    })
  })

  it('blocks crawlers from indexing duplicate pass-through content', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    })
  })
})
