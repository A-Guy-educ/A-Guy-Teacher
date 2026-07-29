/**
 * Characterization tests for POST /api/blob/upload-token.
 *
 * This route hands out a token that lets a browser write directly to blob
 * storage, so the limits it enforces — who is asking, what type, how big — are
 * the security boundary and are pinned before its queries move.
 *
 * `handleUpload` from @vercel/blob is stubbed to invoke the callbacks the route
 * supplies, which is where all of that logic lives.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockRequireUser = vi.hoisted(() => vi.fn())
const captured = vi.hoisted(() => ({
  onBeforeGenerateToken: null as
    | ((pathname: string, payload: string | null) => Promise<Record<string, unknown>>)
    | null,
  onUploadCompleted: null as
    | ((event: { blob: Record<string, string>; tokenPayload: string }) => Promise<void>)
    | null,
}))

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

vi.mock('@/server/auth/api-auth', () => ({ requireUser: mockRequireUser }))

vi.mock('@vercel/blob/client', () => ({
  handleUpload: async (options: Record<string, unknown>) => {
    captured.onBeforeGenerateToken = options.onBeforeGenerateToken as never
    captured.onUploadCompleted = options.onUploadCompleted as never
    return { handled: true }
  },
}))

const USER_ID = 'user-1'
const SESSION_ID = '507f1f77bcf86cd799439011'

/** The route looks the tenant up by this slug; keep the seed in step with it. */
const TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || 'AGuy'

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function requestToken() {
  const { POST } = await import('@/app/api/blob/upload-token/route')
  return POST(
    new NextRequest('http://localhost/api/blob/upload-token', {
      method: 'POST',
      body: JSON.stringify({ type: 'blob.generate-client-token' }),
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function clientPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    originalFilename: 'photo.png',
    contentType: 'image/png',
    size: 1024,
    purpose: 'chat-media',
    ...overrides,
  })
}

describe('POST /api/blob/upload-token', () => {
  beforeEach(() => {
    seed({ tenants: [{ _id: 'tenant-1', slug: TENANT_SLUG }] })
    mockRequireUser.mockReset().mockResolvedValue({ ok: true, value: { id: USER_ID } })
    captured.onBeforeGenerateToken = null
    captured.onUploadCompleted = null
  })

  it('refuses an anonymous caller before reaching blob storage', async () => {
    mockRequireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await requestToken()

    expect(response.status).toBe(401)
    expect(captured.onBeforeGenerateToken).toBeNull()
  })

  it('opens an upload session recording who asked and for what', async () => {
    const fake = seed({ tenants: [{ _id: 'tenant-1', slug: TENANT_SLUG }] })
    await requestToken()

    await captured.onBeforeGenerateToken!('ignored', clientPayload())

    expect(fake.collections['upload-sessions']).toHaveLength(1)
    expect(fake.collections['upload-sessions'][0]).toMatchObject({
      createdBy: USER_ID,
      purpose: 'chat-media',
      originalFilename: 'photo.png',
      mimeType: 'image/png',
      expectedSize: 1024,
      status: 'initiated',
    })
  })

  it('limits the token to the requested content type', async () => {
    await requestToken()

    const token = await captured.onBeforeGenerateToken!('ignored', clientPayload())

    expect(token.allowedContentTypes).toEqual(['image/png'])
    expect(token.addRandomSuffix).toBe(false)
    expect(token.allowOverwrite).toBe(false)
  })

  it('refuses a file larger than the limit', async () => {
    await requestToken()

    await expect(
      captured.onBeforeGenerateToken!('ignored', clientPayload({ size: 10 ** 12 })),
    ).rejects.toThrow('File size exceeds maximum')
  })

  it('refuses a content type that is not allowed', async () => {
    await requestToken()

    await expect(
      captured.onBeforeGenerateToken!(
        'ignored',
        clientPayload({ contentType: 'application/x-sh' }),
      ),
    ).rejects.toThrow('is not allowed')
  })

  it('refuses a malformed payload', async () => {
    await requestToken()

    await expect(
      captured.onBeforeGenerateToken!('ignored', JSON.stringify({ originalFilename: '' })),
    ).rejects.toThrow()
  })

  it('writes no session when the request is refused', async () => {
    const fake = seed({ tenants: [{ _id: 'tenant-1', slug: TENANT_SLUG }] })
    await requestToken()

    await captured.onBeforeGenerateToken!(
      'ignored',
      clientPayload({ contentType: 'application/x-sh' }),
    ).catch(() => undefined)

    expect(fake.collections['upload-sessions'] ?? []).toHaveLength(0)
  })

  it('scopes the upload path to the tenant and user', async () => {
    const fake = seed({ tenants: [{ _id: 'tenant-1', slug: TENANT_SLUG }] })
    await requestToken()

    await captured.onBeforeGenerateToken!('ignored', clientPayload())

    const { pathname } = fake.collections['upload-sessions'][0] as { pathname: string }
    expect(pathname).toContain('tenant-1')
    expect(pathname).toContain(USER_ID)
  })

  it('falls back to a default tenant when none is configured', async () => {
    const fake = seed({ tenants: [] })
    await requestToken()

    await captured.onBeforeGenerateToken!('ignored', clientPayload())

    expect(fake.collections['upload-sessions'][0]).toMatchObject({ tenant: 'default' })
  })

  it('marks the session uploaded once the file lands', async () => {
    const fake = seed({
      tenants: [{ _id: 'tenant-1', slug: TENANT_SLUG }],
      'upload-sessions': [{ _id: SESSION_ID, status: 'initiated' }],
    })
    await requestToken()

    await captured.onUploadCompleted!({
      blob: { url: 'https://blob.example/x.png', pathname: 'chat/x.png' },
      tokenPayload: JSON.stringify({ uploadSessionId: SESSION_ID }),
    })

    expect(fake.collections['upload-sessions'][0]).toMatchObject({
      status: 'uploaded',
      blobUrl: 'https://blob.example/x.png',
      pathname: 'chat/x.png',
    })
  })

  it('ignores a completion callback with no session to update', async () => {
    const fake = seed({
      tenants: [{ _id: 'tenant-1', slug: TENANT_SLUG }],
      'upload-sessions': [{ _id: SESSION_ID, status: 'initiated' }],
    })
    await requestToken()

    await captured.onUploadCompleted!({
      blob: { url: 'https://blob.example/x.png', pathname: 'chat/x.png' },
      tokenPayload: JSON.stringify({}),
    })

    expect(fake.collections['upload-sessions'][0]).toMatchObject({ status: 'initiated' })
  })
})
