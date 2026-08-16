// @vitest-environment node
/**
 * Integration tests: POST /api/track — external analytics proxy
 *
 * Verifies the four behaviour gates from the #1072 spec:
 *  1. Kill-switch OFF (NEXT_PUBLIC_ANALYTICS_ENABLED unset or "false"):
 *     returns { ok: true } immediately with no fetch to the dashboard.
 *  2. Kill-switch ON ("true") with the upstream env vars present:
 *     forwards the payload to ${ANALYTICS_URL}/api/track with the
 *     X-Track-Key header, and returns { ok: true } regardless of the
 *     upstream response.
 *  3. Kill-switch ON but env vars missing: returns { ok: true } without
 *     attempting to forward (no forwarding — but still inert for callers).
 *  4. Errors: malformed JSON body and upstream fetch failure do not
 *     propagate to the client.
 *
 * @fileType integration-test
 * @domain analytics
 * @pattern proxy
 * @ai-summary Tests the kill-switch and forwarding logic of /api/track.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  fetchMock.mockReset()
  // Default: kill-switch off; tests opt in explicitly.
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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function importRoute() {
  const mod = await import('@/app/api/track/route')
  return mod.POST
}

describe('POST /api/track', () => {
  it('returns { ok: true } and does not forward when kill-switch is unset', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = undefined
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED

    const POST = await importRoute()
    const res = await POST(makeRequest({ events: [] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns { ok: true } and does not forward when kill-switch is "false"', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'false'

    const POST = await importRoute()
    const res = await POST(makeRequest({ events: [] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards to ${ANALYTICS_URL}/api/track with X-Track-Key when enabled', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    process.env.ANALYTICS_URL = 'https://analytics.example.com/'
    process.env.ANALYTICS_INGEST_KEY = 'shhh-secret'

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' })

    const POST = await importRoute()
    const res = await POST(
      makeRequest({
        events: [{ event: 'session_start', occurred_at: '2025-01-01T00:00:00Z' }],
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(target).toBe('https://analytics.example.com/api/track')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-Track-Key']).toBe('shhh-secret')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(typeof init.body).toBe('string')
  })

  it('strips trailing slashes from ANALYTICS_URL before composing the target', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    process.env.ANALYTICS_URL = 'https://analytics.example.com////'
    process.env.ANALYTICS_INGEST_KEY = 'shhh-secret'

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' })

    const POST = await importRoute()
    await POST(makeRequest({ events: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://analytics.example.com/api/track')
  })

  it('returns { ok: true } without forwarding when kill-switch is on but env vars are missing', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    delete process.env.ANALYTICS_URL
    delete process.env.ANALYTICS_INGEST_KEY

    const POST = await importRoute()
    const res = await POST(makeRequest({ events: [] }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows upstream fetch failures and still returns { ok: true }', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    process.env.ANALYTICS_URL = 'https://analytics.example.com'
    process.env.ANALYTICS_INGEST_KEY = 'shhh-secret'

    fetchMock.mockRejectedValueOnce(new Error('upstream down'))

    const POST = await importRoute()
    const res = await POST(makeRequest({ events: [] }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('accepts malformed JSON bodies without throwing', async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    process.env.ANALYTICS_URL = 'https://analytics.example.com'
    process.env.ANALYTICS_INGEST_KEY = 'shhh-secret'

    const POST = await importRoute()
    const req = new NextRequest('http://localhost/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'this is not json',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    // No upstream call should ever fire on a parse failure.
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
