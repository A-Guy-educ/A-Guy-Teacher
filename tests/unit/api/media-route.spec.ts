/**
 * Characterization tests for /api/media.
 *
 * Uploading requires a session; listing does not. The response shape is also
 * pinned: POST returns the document both nested and spread, which callers rely
 * on and which is easy to lose when the query moves into the service layer.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockRequireUser = vi.hoisted(() => vi.fn())
const mockUploadBuffer = vi.hoisted(() => vi.fn())

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

vi.mock('@/server/auth/api-auth', () => ({ requireUser: mockRequireUser }))

vi.mock('@/infra/blob/vercel-blob-adapter', () => ({
  VercelBlobAdapter: class {
    uploadBuffer = mockUploadBuffer
  },
}))

const USER_ID = 'user-1'

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

function signedIn() {
  mockRequireUser.mockResolvedValue({ ok: true, value: { id: USER_ID } })
}

function signedOut() {
  mockRequireUser.mockResolvedValue({
    ok: false,
    response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
  })
}

async function upload(form: FormData) {
  const { POST } = await import('@/app/api/media/route')
  const response = await POST(
    new NextRequest('http://localhost/api/media', { method: 'POST', body: form }),
  )
  return { status: response.status, body: await response.json() }
}

async function list(query = '') {
  const { GET } = await import('@/app/api/media/route')
  const response = await GET(new NextRequest(`http://localhost/api/media${query}`))
  return { status: response.status, body: await response.json() }
}

function formWithFile(name = 'photo.png', type = 'image/png') {
  const form = new FormData()
  form.set('file', new File([new Uint8Array([1, 2, 3])], name, { type }))
  return form
}

describe('POST /api/media', () => {
  beforeEach(() => {
    seed({ media: [] })
    mockRequireUser.mockReset()
    signedIn()
    mockUploadBuffer.mockReset().mockResolvedValue({
      url: 'https://blob.example/media/photo.png',
      pathname: 'media/photo.png',
    })
  })

  it('refuses an anonymous caller, and uploads nothing', async () => {
    signedOut()

    const { status } = await upload(formWithFile())

    expect(status).toBe(401)
    expect(mockUploadBuffer).not.toHaveBeenCalled()
  })

  it('rejects a request with no file', async () => {
    const { status, body } = await upload(new FormData())

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'Missing file' })
  })

  it('stores the file and records who uploaded it', async () => {
    const fake = seed({ media: [] })

    const { status, body } = await upload(formWithFile())

    expect(status).toBe(200)
    expect(fake.collections.media).toHaveLength(1)
    expect(fake.collections.media[0]).toMatchObject({
      createdBy: USER_ID,
      mimeType: 'image/png',
      url: 'https://blob.example/media/photo.png',
      pathname: 'media/photo.png',
    })
    expect(body.doc).toMatchObject({ url: 'https://blob.example/media/photo.png' })
  })

  it('returns the document both nested and spread', async () => {
    const { body } = await upload(formWithFile())

    // Callers use both shapes; dropping either is a silent break.
    expect(body.doc.url).toBe(body.url)
    expect(body.doc.filename).toBe(body.filename)
  })

  it('makes the stored filename unique and safe', async () => {
    const fake = seed({ media: [] })

    await upload(formWithFile('my report (final).png'))

    const { filename } = fake.collections.media[0] as { filename: string }
    expect(filename).not.toContain(' ')
    expect(filename).not.toContain('(')
    expect(filename).toMatch(/^\d+-/)
  })

  it('falls back to a generic content type when the browser sends none', async () => {
    const fake = seed({ media: [] })
    const form = new FormData()
    form.set('file', new File([new Uint8Array([1])], 'blob', { type: '' }))

    await upload(form)

    expect(fake.collections.media[0]).toMatchObject({ mimeType: 'application/octet-stream' })
  })
})

describe('GET /api/media', () => {
  beforeEach(() => {
    mockRequireUser.mockReset()
    signedIn()
  })

  it('lists media without requiring a session', async () => {
    signedOut()
    seed({
      media: [
        { _id: 'm1', filename: 'a.png' },
        { _id: 'm2', filename: 'b.png' },
      ],
    })

    const { status, body } = await list()

    expect(status).toBe(200)
    expect(body.totalDocs).toBe(2)
    expect(body.docs).toHaveLength(2)
  })

  it('returns a single document by id', async () => {
    seed({ media: [{ _id: '507f1f77bcf86cd799439011', filename: 'a.png' }] })

    const { status, body } = await list('?id=507f1f77bcf86cd799439011')

    expect(status).toBe(200)
    expect(body.doc).toMatchObject({ filename: 'a.png' })
  })

  it('returns 404 for an id that matches nothing', async () => {
    seed({ media: [] })

    expect(await list('?id=507f1f77bcf86cd799439011')).toMatchObject({
      status: 404,
      body: { error: 'Not found' },
    })
  })

  it('falls back to the list when the id is not a valid identifier', async () => {
    seed({ media: [{ _id: 'm1', filename: 'a.png' }] })

    const { status, body } = await list('?id=not-an-object-id')

    expect(status).toBe(200)
    expect(body.totalDocs).toBe(1)
  })
})
