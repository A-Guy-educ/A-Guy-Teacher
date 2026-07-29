/**
 * Characterization tests for GET /api/diag/access-check.
 *
 * A debugging endpoint that returns entitlement documents verbatim — tenant
 * ids, grant methods, timestamps. Its three gates (not in production, signed
 * in, admin) are what keep that from being public, so they are pinned first.
 */

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockGetWebUser = vi.hoisted(() => vi.fn())

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

vi.mock('@/infra/web-api/mongo-payload', () => ({ getWebUser: mockGetWebUser }))

const USER_ID = '507f1f77bcf86cd799439011'
const COURSE_ID = '507f191e810c19729de860ea'
const ADMIN = { id: USER_ID, email: 'admin@example.com', role: 'admin' }

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function accessCheck(slug?: string) {
  const { GET } = await import('@/app/api/diag/access-check/route')
  const url = `http://localhost/api/diag/access-check${slug ? `?slug=${slug}` : ''}`
  const response = await GET(new NextRequest(url))
  return { status: response.status, body: await response.json() }
}

describe('GET /api/diag/access-check', () => {
  beforeEach(() => {
    seed({ courses: [{ _id: COURSE_ID, slug: 'algebra', title: 'Algebra', accessType: 'paid' }] })
    mockGetWebUser.mockReset().mockResolvedValue(ADMIN)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not exist in production, whoever is asking', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')

    const { status, body } = await accessCheck('algebra')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'not found' })
    expect(mockGetWebUser).not.toHaveBeenCalled()
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    expect(await accessCheck('algebra')).toMatchObject({
      status: 401,
      body: { error: 'not authenticated' },
    })
  })

  it('hides itself from a signed-in non-admin, rather than admitting it exists', async () => {
    mockGetWebUser.mockResolvedValue({ id: USER_ID, role: 'student' })

    expect(await accessCheck('algebra')).toMatchObject({
      status: 404,
      body: { error: 'not found' },
    })
  })

  it('accepts an admin identified through the roles array', async () => {
    mockGetWebUser.mockResolvedValue({ id: USER_ID, role: 'student', roles: ['admin'] })

    expect((await accessCheck('algebra')).status).toBe(200)
  })

  it('requires a slug', async () => {
    expect(await accessCheck()).toMatchObject({
      status: 400,
      body: { error: 'slug query param required' },
    })
  })

  it('reports an unknown slug by name', async () => {
    const { status, body } = await accessCheck('missing-course')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'no course with slug "missing-course"' })
  })

  it('reports that access would be required when nothing is granted', async () => {
    const { status, body } = await accessCheck('algebra')

    expect(status).toBe(200)
    expect(body.wouldRequireEntitlement).toBe(true)
    expect(body.course).toMatchObject({ id: COURSE_ID, slug: 'algebra', title: 'Algebra' })
    expect(body.queries).toMatchObject({ userEntitlement: null, enrollment: null })
  })

  it('reports the entitlement that grants access', async () => {
    seed({
      courses: [{ _id: COURSE_ID, slug: 'algebra' }],
      'user-entitlements': [{ _id: 'ent-1', user: USER_ID, course: COURSE_ID }],
    })

    const { body } = await accessCheck('algebra')

    expect(body.wouldRequireEntitlement).toBe(false)
    expect(body.queries.userEntitlement).toMatchObject({ id: 'ent-1' })
  })

  it('does not treat a cancelled enrollment as access', async () => {
    seed({
      courses: [{ _id: COURSE_ID, slug: 'algebra' }],
      enrollments: [{ _id: 'enr-1', user: USER_ID, course: COURSE_ID, status: 'cancelled' }],
    })

    const { body } = await accessCheck('algebra')

    expect(body.queries.enrollment).toBeNull()
    expect(body.wouldRequireEntitlement).toBe(true)
  })

  it('lists every enrollment for the caller, including cancelled ones', async () => {
    seed({
      courses: [{ _id: COURSE_ID, slug: 'algebra' }],
      enrollments: [
        { _id: 'enr-1', user: USER_ID, course: COURSE_ID, status: 'cancelled' },
        { _id: 'enr-2', user: USER_ID, course: 'another-course', status: 'active' },
      ],
    })

    const { body } = await accessCheck('algebra')

    expect(body.diagnostics.allEnrollmentsForCallingUser).toHaveLength(2)
  })

  it('flags which legacy entitlement matches the course being asked about', async () => {
    seed({
      courses: [{ _id: COURSE_ID, slug: 'algebra' }],
      users: [
        {
          _id: USER_ID,
          courseEntitlements: [{ course: COURSE_ID }, { course: 'a-different-course' }],
        },
      ],
    })

    const { body } = await accessCheck('algebra')

    expect(body.queries.legacyCourseEntitlements).toHaveLength(2)
    expect(body.queries.legacyCourseEntitlements[0].matchesQueryCourse).toBe(true)
    expect(body.queries.legacyCourseEntitlements[1].matchesQueryCourse).toBe(false)
    expect(body.wouldRequireEntitlement).toBe(false)
  })
})
