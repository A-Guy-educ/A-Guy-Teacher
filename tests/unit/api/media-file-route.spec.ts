/**
 * @fileType unit-test
 * @domain media
 * @pattern media-file-proxy
 * @ai-summary Covers /api/media/file so stored proxy URLs do not redirect back
 *             to themselves and old media can fall back to Blob or disk.
 */
import path from 'path'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  list: vi.fn(),
  readFile: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  default: {
    readFile: mocks.readFile,
  },
}))

vi.mock('@/infra/db/content-db', () => ({
  getContentDb: vi.fn(async () => ({
    collection: vi.fn(() => ({
      findOne: mocks.findOne,
    })),
  })),
}))

vi.mock('@/infra/blob/vercel-blob-adapter', () => ({
  VercelBlobAdapter: class {
    list = mocks.list
  },
}))

describe('/api/media/file/[filename]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue({ blobs: [] })
  })

  it('does not redirect when media.url points back to the same file route', async () => {
    const { GET } = await import('@/app/api/media/file/[filename]/route')
    mocks.findOne.mockResolvedValue({
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      url: '/api/media/file/test.pdf',
    })
    mocks.readFile.mockResolvedValue(Buffer.from('%PDF-1.4'))

    const response = await GET(new NextRequest('http://localhost:3000/api/media/file/test.pdf'), {
      params: Promise.resolve({ filename: 'test.pdf' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(mocks.readFile).toHaveBeenCalledOnce()
  })

  it('redirects to a real external media URL', async () => {
    const { GET } = await import('@/app/api/media/file/[filename]/route')
    const blobUrl = 'https://example.blob.vercel-storage.com/media/test.pdf'
    mocks.findOne.mockResolvedValue({
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      url: blobUrl,
    })

    const response = await GET(new NextRequest('http://localhost:3000/api/media/file/test.pdf'), {
      params: Promise.resolve({ filename: 'test.pdf' }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(blobUrl)
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('finds a Blob file by stored pathname when media.url is only the proxy URL', async () => {
    const { GET } = await import('@/app/api/media/file/[filename]/route')
    const blobUrl = 'https://example.blob.vercel-storage.com/media/test.pdf'
    mocks.findOne.mockResolvedValue({
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      pathname: 'media/test.pdf',
      url: '/api/media/file/test.pdf',
    })
    mocks.list.mockResolvedValue({
      blobs: [{ pathname: 'media/test.pdf', url: blobUrl }],
    })

    const response = await GET(new NextRequest('http://localhost:3000/api/media/file/test.pdf'), {
      params: Promise.resolve({ filename: 'test.pdf' }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(blobUrl)
    expect(mocks.list).toHaveBeenCalledWith('media/test.pdf', 5)
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('finds a Blob file by original filename when the media filename has a generated suffix', async () => {
    const { GET } = await import('@/app/api/media/file/[filename]/route')
    const filename = 'Math - 5units - 571 - 2026 - winter-0278lGV1s1IaTxYrCAy5GJT2DIRrQQ.pdf'
    const originalFilename = 'Math - 5units - 571 - 2026 - winter.pdf'
    const blobUrl = `https://example.blob.vercel-storage.com/${originalFilename}`
    mocks.findOne.mockResolvedValue({
      filename,
      mimeType: 'application/pdf',
      url: `/api/media/file/${filename}`,
    })
    mocks.list.mockImplementation(async (prefix: string) => ({
      blobs: prefix === filename ? [{ pathname: originalFilename, url: blobUrl }] : [],
    }))

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/media/file/${encodeURIComponent(filename)}`),
      {
        params: Promise.resolve({ filename }),
      },
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(encodeURI(blobUrl))
    expect(mocks.list).toHaveBeenCalledWith(filename, 5)
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('returns 404 instead of 500 when proxy URL, Blob, and disk are all missing', async () => {
    const { GET } = await import('@/app/api/media/file/[filename]/route')
    mocks.findOne.mockResolvedValue({
      filename: 'missing.pdf',
      mimeType: 'application/pdf',
      url: '/api/media/file/missing.pdf',
    })
    mocks.readFile.mockRejectedValue(new Error('ENOENT'))

    const response = await GET(
      new NextRequest('http://localhost:3000/api/media/file/missing.pdf'),
      {
        params: Promise.resolve({ filename: 'missing.pdf' }),
      },
    )

    expect(response.status).toBe(404)
  })

  it('rejects path traversal filenames', async () => {
    const { GET } = await import('@/app/api/media/file/[filename]/route')

    const response = await GET(
      new NextRequest('http://localhost:3000/api/media/file/..%2Fsecret.pdf'),
      {
        params: Promise.resolve({ filename: '..%2Fsecret.pdf' }),
      },
    )

    expect(response.status).toBe(400)
    expect(mocks.findOne).not.toHaveBeenCalled()
  })
})

describe('media storage path', () => {
  it('points at root public/media', async () => {
    const { MEDIA_STORAGE_DIR } = await import('@/infra/config/storage')

    expect(MEDIA_STORAGE_DIR).toBe(path.resolve(process.cwd(), 'public/media'))
  })
})
