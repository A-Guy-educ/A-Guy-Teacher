// @vitest-environment node
/**
 * Unit tests for the server-side analytics helper.
 *
 * Verifies the kill-switch and forwarding rules mirror the public /api/track
 * proxy so the two paths can't diverge silently.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// trackServerEvent wraps its outbound fetch in `after()` from `next/server`
// so the dashboard forward happens post-response on Vercel. In vitest there
// is no request lifecycle to run the callback, so we replace `after` with a
// synchronous invoker. (The helper also catches the "outside request
// context" throw and falls back to a naked fire-and-forget promise, so this
// mock is belt-and-braces.)
vi.mock('next/server', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    after: (callback: () => unknown) => {
      void callback()
    },
  }
})

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  fetchMock.mockReset()
  delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED
  delete process.env.ANALYTICS_URL
  delete process.env.ANALYTICS_INGEST_KEY
})

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key]
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value
  }
})

describe('trackServerEvent', () => {
  it('is a no-op when kill-switch is off', async () => {
    const { trackServerEvent } = await import('@/server/services/analytics/track')
    await trackServerEvent({ event: 'signup', user_id: 'u1' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards to ${ANALYTICS_URL}/api/track in dashboard shape when enabled', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    process.env.ANALYTICS_URL = 'https://analytics.example.com'
    process.env.ANALYTICS_INGEST_KEY = 'shhh-secret'

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' })

    const { trackServerEvent } = await import('@/server/services/analytics/track')
    await trackServerEvent({ event: 'signup', user_id: 'u1', properties: { method: 'email' } })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(target).toBe('https://analytics.example.com/api/track')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-Track-Key']).toBe('shhh-secret')

    const body = JSON.parse(init.body as string)
    expect(body.events).toHaveLength(1)
    // Dashboard shape: flat, camelCase, synthesized server sessionId keyed
    // off user_id, meta carries the arbitrary `properties` payload, ts is
    // a unix-ms number.
    expect(body.events[0]).toMatchObject({
      event: 'signup',
      sessionId: 'server:u1',
      userId: 'u1',
      meta: { method: 'email' },
    })
    expect(typeof body.events[0].ts).toBe('number')
  })

  it('is a no-op when upstream env vars are missing', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    delete process.env.ANALYTICS_URL
    delete process.env.ANALYTICS_INGEST_KEY

    const { trackServerEvent } = await import('@/server/services/analytics/track')
    await trackServerEvent({ event: 'course_enroll', user_id: 'u1' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows upstream fetch failures', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    process.env.ANALYTICS_URL = 'https://analytics.example.com'
    process.env.ANALYTICS_INGEST_KEY = 'shhh-secret'

    fetchMock.mockRejectedValueOnce(new Error('upstream down'))

    const { trackServerEvent } = await import('@/server/services/analytics/track')
    await expect(trackServerEvent({ event: 'signup', user_id: 'u1' })).resolves.toBeUndefined()
  })
})
