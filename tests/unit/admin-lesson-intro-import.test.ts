import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getWebUser, findOneAndUpdate } = vi.hoisted(() => ({
  getWebUser: vi.fn(),
  findOneAndUpdate: vi.fn(),
}))

vi.mock('@/infra/web-api/mongo-payload', () => ({ getWebUser }))
vi.mock('@/infra/db/content-db', () => ({
  getContentDb: vi.fn(async () => ({
    collection: () => ({ findOneAndUpdate }),
  })),
}))

import { POST } from '@/app/api/admin/lessons/import-intro/route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/lessons/import-intro', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/lessons/import-intro', () => {
  beforeEach(() => {
    getWebUser.mockReset()
    findOneAndUpdate.mockReset()
  })

  it('rejects anonymous users', async () => {
    getWebUser.mockResolvedValue(null)
    expect((await POST(request({}))).status).toBe(401)
  })

  it('hides the endpoint from non-admin users', async () => {
    getWebUser.mockResolvedValue({ id: 'user-1', role: 'student' })
    expect((await POST(request({}))).status).toBe(404)
  })

  it('returns structured validation errors for malformed blocks', async () => {
    getWebUser.mockResolvedValue({ id: 'admin-1', role: 'admin' })
    const response = await POST(
      request({ lessonSlug: 'algebra', blocks: [{ id: 'b1', type: 'latex', latex: '' }] }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.issues).toEqual(expect.any(Array))
    expect(findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when the lesson does not exist', async () => {
    getWebUser.mockResolvedValue({ id: 'admin-1', roles: ['admin'] })
    findOneAndUpdate.mockResolvedValue(null)

    expect(
      (await POST(request({ lessonSlug: 'missing', lessonContextText: 'Introduction' }))).status,
    ).toBe(404)
  })

  it('updates only intro fields for a valid admin request', async () => {
    getWebUser.mockResolvedValue({ id: 'admin-1', role: 'admin' })
    findOneAndUpdate.mockResolvedValue({
      _id: 'lesson-1',
      slug: 'algebra',
      lessonContextText: 'Introduction',
      blocks: [{ id: 'b1', type: 'latex', latex: 'x^2' }],
    })

    const response = await POST(
      request({
        lessonSlug: 'algebra',
        lessonContextText: 'Introduction',
        blocks: [{ id: 'b1', type: 'latex', latex: 'x^2' }],
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.lesson.slug).toBe('algebra')
    const update = findOneAndUpdate.mock.calls[0][1].$set
    expect(update).toMatchObject({ lessonContextText: 'Introduction' })
    expect(update).not.toHaveProperty('chapter')
    expect(update).not.toHaveProperty('course')
  })
})
