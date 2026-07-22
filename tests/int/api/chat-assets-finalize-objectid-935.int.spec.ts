/**
 * Integration tests: POST /api/chat-assets/finalize input validation (issue #935)
 *
 * The route accepted any string as `uploadSessionId`, then passed it to
 * `new ObjectId(...)`, which throws `BSONError` for malformed values →
 * unhandled 500.
 *
 * Acceptance criterion: a malformed `uploadSessionId` returns 400 with the
 * generic "Invalid request" envelope, no 500.
 *
 * Mirrors the mock-based pattern in tests/int/api/stats-streak-timezone-939:
 * stub the DB + auth helpers, hit the route handler directly with NextRequest.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getContentDbMock,
  getWebUserMock,
  getOrCreateGuestIdMock,
  publicUserIdMock,
  withGuestCookieMock,
} = vi.hoisted(() => ({
  getContentDbMock: vi.fn(),
  getWebUserMock: vi.fn(),
  getOrCreateGuestIdMock: vi.fn(),
  publicUserIdMock: vi.fn(),
  withGuestCookieMock: vi.fn((response: unknown) => response),
}))

vi.mock('@/infra/db/content-db', () => ({
  getContentDb: getContentDbMock,
}))

vi.mock('@/infra/web-api/mongo-payload', () => ({
  getWebUser: getWebUserMock,
  getOrCreateGuestId: getOrCreateGuestIdMock,
  publicUserId: publicUserIdMock,
  withGuestCookie: withGuestCookieMock,
}))

vi.mock('@vercel/blob', () => ({
  head: vi.fn(async () => ({ size: 1024, contentType: 'image/jpeg' })),
}))

import { POST } from '@/app/api/chat-assets/finalize/route'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/chat-assets/finalize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  getWebUserMock.mockResolvedValue({ id: 'user-1' })
  getOrCreateGuestIdMock.mockReturnValue('guest-1')
  publicUserIdMock.mockReturnValue('user-1')
  // The route never reaches DB queries when validation fails, but stub in case.
  getContentDbMock.mockResolvedValue({
    collection: vi.fn(() => ({
      findOne: vi.fn(async () => null),
      insertOne: vi.fn(async () => ({ insertedId: new ObjectId() })),
      updateOne: vi.fn(async () => ({ matchedCount: 0, modifiedCount: 0 })),
    })),
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/chat-assets/finalize — uploadSessionId validation (#935)', () => {
  it('returns 400 when uploadSessionId is not a valid ObjectId', async () => {
    const response = await POST(makeRequest({ uploadSessionId: 'not-a-valid-objectid' }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'Invalid request' })
    // DB and downstream paths must not run for malformed input.
    expect(getContentDbMock).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty string uploadSessionId', async () => {
    const response = await POST(makeRequest({ uploadSessionId: '' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid request' })
  })

  it('returns 400 for a too-short hex string uploadSessionId', async () => {
    const response = await POST(makeRequest({ uploadSessionId: 'a'.repeat(10) }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid request' })
  })

  it('returns 400 when both uploadSessionId and blobUrl are missing', async () => {
    const response = await POST(makeRequest({ originalFilename: 'foo.pdf' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid request' })
  })

  it('does not throw BSONError for malformed uploadSessionId (regression for #935)', async () => {
    // The bug: new ObjectId('garbage') throws BSONError, leaving the route to
    // surface as 500. After the fix the schema rejects before reaching the
    // ObjectId constructor.
    let thrown: unknown = null
    let response: Response | undefined
    try {
      response = await POST(makeRequest({ uploadSessionId: 'garbage' }))
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeNull()
    expect(response).toBeDefined()
    expect(response!.status).toBe(400)
  })
})

describe('POST /api/chat-assets/finalize — schema accepts valid input', () => {
  it('passes schema validation and reaches DB lookup for a valid ObjectId', async () => {
    // The mocked DB returns null for any findOne, so the route will surface
    // a 404 ("Upload session not found") — that is fine: it proves the
    // schema accepted the input and the request made it past Zod.
    const validId = new ObjectId().toHexString()
    const response = await POST(makeRequest({ uploadSessionId: validId }))

    expect(response.status).toBe(404)
    expect(getContentDbMock).toHaveBeenCalledTimes(1)
  })

  it('passes schema validation for a request that omits uploadSessionId but includes blobUrl', async () => {
    const response = await POST(
      makeRequest({ blobUrl: 'https://example.blob.vercel-storage.com/foo.pdf' }),
    )

    expect(response.status).toBe(404)
    expect(getContentDbMock).toHaveBeenCalledTimes(1)
  })
})
