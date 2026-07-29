/**
 * Characterization tests for POST /api/entitlements/redeem.
 *
 * Redeeming a code grants paid access and consumes a use, so both the refusal
 * paths and the exactly-once behaviour are pinned before the queries move into
 * the service layer.
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

function activeCode(overrides: Doc = {}): Doc {
  return {
    _id: 'code-1',
    code: 'WELCOME',
    isActive: true,
    course: COURSE_ID,
    tenant: 'tenant-1',
    currentUses: 0,
    maxUses: 0,
    ...overrides,
  }
}

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function redeem(body: unknown) {
  const { POST } = await import('@/app/api/entitlements/redeem/route')
  const response = await POST(
    new NextRequest('http://localhost/api/entitlements/redeem', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
  return { status: response.status, body: await response.json() }
}

describe('POST /api/entitlements/redeem', () => {
  beforeEach(() => {
    seed({ 'access-codes': [activeCode()] })
    mockGetWebUser.mockReset()
    mockGetWebUser.mockResolvedValue({ id: USER_ID, role: 'student' })
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    const { status, body } = await redeem({ code: 'WELCOME' })

    expect(status).toBe(401)
    expect(body).toEqual({ success: false, error: 'authentication_required' })
  })

  it('rejects a missing or empty code', async () => {
    expect(await redeem({})).toMatchObject({
      status: 400,
      body: { success: false, error: 'code_required' },
    })
    expect(await redeem({ code: '   ' })).toMatchObject({ status: 400 })
  })

  it('rejects a code that does not exist', async () => {
    const { status, body } = await redeem({ code: 'NOPE' })

    expect(status).toBe(404)
    expect(body).toEqual({ success: false, error: 'invalid_code' })
  })

  it('uppercases the submitted code before looking it up', async () => {
    const { status, body } = await redeem({ code: '  welcome  ' })

    expect(status).toBe(200)
    expect(body).toEqual({ success: true, courseId: COURSE_ID })
  })

  it('rejects a deactivated code', async () => {
    seed({ 'access-codes': [activeCode({ isActive: false })] })

    expect(await redeem({ code: 'WELCOME' })).toMatchObject({
      status: 400,
      body: { error: 'code_inactive' },
    })
  })

  it('rejects an expired code', async () => {
    seed({ 'access-codes': [activeCode({ expiresAt: new Date('2000-01-01') })] })

    expect(await redeem({ code: 'WELCOME' })).toMatchObject({
      status: 400,
      body: { error: 'code_expired' },
    })
  })

  it('rejects a code whose uses are exhausted', async () => {
    seed({ 'access-codes': [activeCode({ maxUses: 1, currentUses: 1 })] })

    expect(await redeem({ code: 'WELCOME' })).toMatchObject({
      status: 409,
      body: { error: 'code_exhausted' },
    })
  })

  it('refuses when the user already has an entitlement', async () => {
    seed({
      'access-codes': [activeCode()],
      'user-entitlements': [{ user: USER_ID, course: COURSE_ID }],
    })

    expect(await redeem({ code: 'WELCOME' })).toMatchObject({
      status: 409,
      body: { error: 'already_entitled' },
    })
  })

  it('refuses when the user already has an active enrollment', async () => {
    seed({
      'access-codes': [activeCode()],
      enrollments: [{ user: USER_ID, course: COURSE_ID, status: 'active' }],
    })

    expect(await redeem({ code: 'WELCOME' })).toMatchObject({
      status: 409,
      body: { error: 'already_entitled' },
    })
  })

  it('does not count a cancelled enrollment as already entitled', async () => {
    seed({
      'access-codes': [activeCode()],
      enrollments: [{ user: USER_ID, course: COURSE_ID, status: 'cancelled' }],
    })

    expect(await redeem({ code: 'WELCOME' })).toMatchObject({ status: 200 })
  })

  it('grants an entitlement and an enrollment, and consumes one use', async () => {
    const fake = seed({ 'access-codes': [activeCode({ maxUses: 5 })] })

    const { status, body } = await redeem({ code: 'WELCOME' })

    expect(status).toBe(200)
    expect(body).toEqual({ success: true, courseId: COURSE_ID })
    expect(fake.collections['user-entitlements']).toHaveLength(1)
    expect(fake.collections['user-entitlements'][0]).toMatchObject({
      grantMethod: 'code',
      contentType: 'course',
      accessCode: 'code-1',
    })
    expect(fake.collections.enrollments).toHaveLength(1)
    expect(fake.collections.enrollments[0]).toMatchObject({ status: 'active', grantMethod: 'code' })
    expect(fake.collections['access-codes'][0].currentUses).toBe(1)
  })

  it('grants nothing when the code could not be consumed', async () => {
    const fake = seed({ 'access-codes': [activeCode({ maxUses: 1, currentUses: 1 })] })

    await redeem({ code: 'WELCOME' })

    expect(fake.collections['user-entitlements'] ?? []).toHaveLength(0)
    expect(fake.collections.enrollments ?? []).toHaveLength(0)
  })
})
