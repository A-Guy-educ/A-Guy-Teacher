/**
 * Characterization tests for POST /api/exercises/import.
 *
 * Written before the route's query moves into the service layer, so the
 * migration can be checked against behaviour rather than intent. If one of
 * these needs editing during that move, behaviour changed — see
 * docs/architecture/DATA-ACCESS.md.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return {
    ...actual,
    getContentDb: async () => db.current!.db,
  }
})

const LESSON_ID = '507f1f77bcf86cd799439011'

function seed(seedData: Record<string, Doc[]>) {
  db.current = mockContentDb(seedData)
  return db.current
}

function post(query: string) {
  return new NextRequest(`http://localhost/api/exercises/import${query}`, { method: 'POST' })
}

async function callRoute(query: string) {
  const { POST } = await import('@/app/api/exercises/import/route')
  const response = await POST(post(query))
  return { status: response.status, body: await response.json() }
}

describe('POST /api/exercises/import', () => {
  beforeEach(() => {
    seed({})
  })

  it('rejects a request with no lessonId', async () => {
    const { status, body } = await callRoute('')

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'lessonId is required' })
  })

  it('returns 404 when the lesson does not exist', async () => {
    const { status, body } = await callRoute(`?lessonId=${LESSON_ID}`)

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Lesson not found' })
  })

  it('reports the existing exercise count without importing anything', async () => {
    seed({
      lessons: [{ _id: LESSON_ID, title: 'Algebra' }],
      exercises: [{ lesson: LESSON_ID }, { lesson: LESSON_ID }, { lesson: 'other-lesson' }],
    })

    const { status, body } = await callRoute(`?lessonId=${LESSON_ID}`)

    expect(status).toBe(200)
    expect(body).toEqual({
      success: true,
      imported: 0,
      existingCount: 2,
      message: 'Exercise conversion is not available in the web-only build.',
    })
  })

  it('is a read-only probe — it writes nothing', async () => {
    const fake = seed({ lessons: [{ _id: LESSON_ID }], exercises: [] })

    await callRoute(`?lessonId=${LESSON_ID}`)

    expect(fake.touched('exercises', 'insertOne')).toBe(false)
    expect(fake.touched('exercises', 'updateOne')).toBe(false)
  })

  it('treats a non-ObjectId lessonId as a plain string key', async () => {
    seed({ lessons: [{ _id: 'legacy-lesson' }], exercises: [{ lesson: 'legacy-lesson' }] })

    const { status, body } = await callRoute('?lessonId=legacy-lesson')

    expect(status).toBe(200)
    expect(body.existingCount).toBe(1)
  })
})
