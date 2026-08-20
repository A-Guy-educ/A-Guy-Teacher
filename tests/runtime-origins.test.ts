import { describe, expect, it } from 'vitest'

import { resolveRuntimeOrigin } from '../src/config/runtime-origins'

describe('runtime origins', () => {
  const defaults = {
    development: 'http://app.lvh.me:3000',
    name: 'AGUY_API_URL',
    production: 'https://api.aguy.co.il',
  }

  it('uses the local API by default outside production', () => {
    expect(
      resolveRuntimeOrigin({
        ...defaults,
        environment: { NODE_ENV: 'development' },
      }).origin,
    ).toBe('http://app.lvh.me:3000')
  })

  it('requires an explicit API for preview and QA deployments', () => {
    expect(() =>
      resolveRuntimeOrigin({
        ...defaults,
        environment: { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
      }),
    ).toThrow('AGUY_API_URL must be configured for preview and QA deployments')
  })

  it('accepts an HTTPS QA API', () => {
    expect(
      resolveRuntimeOrigin({
        ...defaults,
        environment: { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
        value: 'https://api.qa.aguy.co.il',
      }).origin,
    ).toBe('https://api.qa.aguy.co.il')
  })

  it('rejects insecure production APIs', () => {
    expect(() =>
      resolveRuntimeOrigin({
        ...defaults,
        environment: { NODE_ENV: 'production', VERCEL_ENV: 'production' },
        value: 'http://api.example.test',
      }),
    ).toThrow('AGUY_API_URL must use HTTPS in production')
  })
})
