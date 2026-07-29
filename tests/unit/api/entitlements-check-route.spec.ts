/**
 * Characterization tests for GET /api/entitlements/check.
 *
 * This route decides whether a student may open a paid course, so its
 * behaviour is pinned in detail before the query moves into the service layer.
 * A test that needs editing during that move means access rules changed.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
}

async function check(courseId?: string) {
  const { GET } = await import('@/app/api/entitlements/check/route')
  const url = `http://localhost/api/entitlements/check${courseId ? `?courseId=${courseId}` : ''}`
  const response = await GET(new NextRequest(url))
  return { status: response.status, body: await response.json() }
}

describe('GET /api/entitlements/check', () => {
  beforeEach(() => {
    seed()
    mockGetWebUser.mockReset()
    mockGetWebUser.mockResolvedValue({ id: USER_ID, role: 'student' })
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    const { status, body } = await check(COURSE_ID)

    expect(status).toBe(401)
    expect(body).toEqual({ hasAccess: false })
  })

  it('requires a courseId', async () => {
    const { status, body } = await check()

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'courseId required' })
  })

  it('grants an admin access without consulting the database', async () => {
    mockGetWebUser.mockResolvedValue({ id: USER_ID, role: 'admin' })

    const { status, body } = await check(COURSE_ID)

    expect(status).toBe(200)
    expect(body).toEqual({ hasAccess: true })
    expect(db.current!.calls).toEqual([])
  })

  it('grants an admin identified through the roles array', async () => {
    mockGetWebUser.mockResolvedValue({ id: USER_ID, role: 'student', roles: ['admin'] })

    const { body } = await check(COURSE_ID)

    expect(body).toEqual({ hasAccess: true })
  })

  it('denies a student with nothing granted', async () => {
    const { status, body } = await check(COURSE_ID)

    expect(status).toBe(200)
    expect(body).toEqual({ hasAccess: false })
  })

  it('grants access on an entitlement', async () => {
    seed({ 'user-entitlements': [{ user: USER_ID, course: COURSE_ID }] })

    expect((await check(COURSE_ID)).body).toEqual({ hasAccess: true })
  })

  it('grants access on an active enrollment', async () => {
    seed({ enrollments: [{ user: USER_ID, course: COURSE_ID, status: 'active' }] })

    expect((await check(COURSE_ID)).body).toEqual({ hasAccess: true })
  })

  it('ignores a cancelled enrollment', async () => {
    seed({ enrollments: [{ user: USER_ID, course: COURSE_ID, status: 'cancelled' }] })

    expect((await check(COURSE_ID)).body).toEqual({ hasAccess: false })
  })

  it('still honours the legacy courseEntitlements array on the user', async () => {
    seed({ users: [{ _id: USER_ID, courseEntitlements: [{ course: COURSE_ID }] }] })

    expect((await check(COURSE_ID)).body).toEqual({ hasAccess: true })
  })

  it('does not let a legacy entry for another course leak access', async () => {
    seed({ users: [{ _id: USER_ID, courseEntitlements: [{ course: 'a-different-course' }] }] })

    expect((await check(COURSE_ID)).body).toEqual({ hasAccess: false })
  })
})
