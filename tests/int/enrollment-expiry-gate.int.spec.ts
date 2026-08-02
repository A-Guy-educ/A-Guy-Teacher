// @vitest-environment node
/**
 * Integration tests: Enrollments expiry gates web-side access
 *
 * Verifies that all three web-side entitlement checks —
 *   - `hasEntitlement`         (Payload find, /courses/[slug] SSR)
 *   - `checkPaidAccess`        (raw MongoDB, page render)
 *   - `findCourseAccessGrants` (raw MongoDB, /api/entitlements/check
 *                               + /api/diag/access-check)
 * honor the enrollments `expiresAt` field. Between hourly sweeper runs the row
 * may still be `status: 'active'` past its expiry window, so every read path
 * must filter on expiresAt directly (defense-in-depth).
 *
 * Coverage per gate:
 *   (a) active + expiresAt in the past      → denies
 *   (b) active + expiresAt in the future    → grants
 *   (c) active + no expiresAt (lifetime)    → grants
 *   (d) active + expiresAt: null (lifetime) → grants
 *
 * Seeds Mongo directly rather than via Payload — the `payload` package is not
 * available in this repo's active integration-test env (see how
 * paypal-concurrent-webhook-race.int.spec.ts takes the same approach).
 *
 * @fileType integration-test
 * @domain entitlements
 * @ai-summary Read-path filter must exclude past-expiresAt enrollments even when status is still 'active'
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getContentDb } from '@/infra/db/content-db'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

const mockGetAuthenticatedUserServer = vi.hoisted(() => vi.fn())

vi.mock('@/server/utils/access-gate-server', () => ({
  getAuthenticatedUserServer: mockGetAuthenticatedUserServer,
  isAuthenticatedServer: vi.fn(),
}))

let mongoUri: string | undefined
let originalDatabaseUrl: string | undefined

let tenantId: ObjectId
let courseId: ObjectId
// Four users, one per scenario, so the unique {user, course} index on
// enrollments doesn't force us to mutate a single row between assertions.
let userExpired: ObjectId
let userFuture: ObjectId
let userNoExpires: ObjectId
let userNullExpires: ObjectId

async function seedEnrollment(userId: ObjectId, expiresAt: Date | null | undefined): Promise<void> {
  const db = await getContentDb()
  const doc: Record<string, unknown> = {
    user: userId,
    course: courseId,
    status: 'active',
    grantMethod: 'admin',
    source: 'dashboard',
    enrolledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  // `undefined` → omit the field entirely (lifetime enrollment).
  // `null` → explicit null (lifetime re-purchase that cleared prior expiry).
  // `Date` → time-limited.
  if (expiresAt !== undefined) {
    doc.expiresAt = expiresAt
  }
  await db.collection('enrollments').insertOne(doc as any)
}

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const db = await getContentDb()

  tenantId = new ObjectId()
  await db.collection('tenants').insertOne({ _id: tenantId } as any)

  courseId = new ObjectId()
  await db.collection('courses').insertOne({ _id: courseId } as any)

  userExpired = new ObjectId()
  userFuture = new ObjectId()
  userNoExpires = new ObjectId()
  userNullExpires = new ObjectId()
  await db
    .collection('users')
    .insertMany([
      { _id: userExpired } as any,
      { _id: userFuture } as any,
      { _id: userNoExpires } as any,
      { _id: userNullExpires } as any,
    ])

  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day out
  await seedEnrollment(userExpired, pastDate)
  await seedEnrollment(userFuture, futureDate)
  await seedEnrollment(userNoExpires, undefined)
  await seedEnrollment(userNullExpires, null)
}, 180_000)

afterAll(async () => {
  if (mongoUri) {
    const db = await getContentDb()
    await db
      .collection('enrollments')
      .deleteMany({ user: { $in: [userExpired, userFuture, userNoExpires, userNullExpires] } })
    await db
      .collection('users')
      .deleteMany({ _id: { $in: [userExpired, userFuture, userNoExpires, userNullExpires] } })
    await db.collection('courses').deleteMany({ _id: courseId })
    await db.collection('tenants').deleteMany({ _id: tenantId })
  }
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

beforeEach(() => {
  mockGetAuthenticatedUserServer.mockReset()
})

// ─── checkPaidAccess (raw MongoDB) ─────────────────────────────────────────
describe('checkPaidAccess — expiresAt filter', () => {
  async function runCheck(userId: ObjectId) {
    mockGetAuthenticatedUserServer.mockResolvedValue({
      user: { id: userId.toString(), role: 'student', roles: null },
      payload: null,
    })
    const { checkPaidAccess } = await import('@/server/utils/check-paid-access')
    return checkPaidAccess(courseId.toString())
  }

  it('denies access when expiresAt is in the past', async () => {
    const result = await runCheck(userExpired)
    expect(result).toEqual({ requiresEntitlement: true, isAuthenticated: true })
  })

  it('grants access when expiresAt is in the future', async () => {
    const result = await runCheck(userFuture)
    expect(result).toEqual({ requiresEntitlement: false, isAuthenticated: true })
  })

  it('grants access when expiresAt is absent (lifetime)', async () => {
    const result = await runCheck(userNoExpires)
    expect(result).toEqual({ requiresEntitlement: false, isAuthenticated: true })
  })

  it('grants access when expiresAt is null (lifetime re-purchase)', async () => {
    const result = await runCheck(userNullExpires)
    expect(result).toEqual({ requiresEntitlement: false, isAuthenticated: true })
  })
})

// ─── hasEntitlement (Payload find) ─────────────────────────────────────────
//
// The `payload` package isn't installed in this repo's active test env, so we
// pass a fake Payload whose `find` inspects the where clause our fix
// produces, and replays it against raw MongoDB by translating just the shape
// our code uses. That way each of the four scenarios exercises real data.
type WhereClause = {
  and?: Array<Record<string, any>>
  or?: Array<Record<string, any>>
} & Record<string, any>

async function findEnrollmentsViaPayloadFake(where: WhereClause) {
  const db = await getContentDb()

  // The fix builds exactly this shape:
  //   { and: [
  //       { user:   { equals: <id> } },
  //       { course: { equals: <id> } },
  //       { status: { equals: 'active' } },
  //       { or: [
  //           { expiresAt: { exists: false } },
  //           { expiresAt: { equals: null } },
  //           { expiresAt: { greater_than: nowIso } },
  //       ] },
  //   ] }
  const conjuncts = where.and ?? []
  const userClause = conjuncts.find((c) => 'user' in c)?.user?.equals
  const courseClause = conjuncts.find((c) => 'course' in c)?.course?.equals
  const statusClause = conjuncts.find((c) => 'status' in c)?.status?.equals
  const orGroup = conjuncts.find((c) => 'or' in c)?.or as Array<Record<string, any>> | undefined

  // Assert the expiresAt guard is present — regression insurance.
  if (!orGroup) {
    throw new Error('hasEntitlement: expected an "or" group filtering expiresAt')
  }
  const hasExistsFalse = orGroup.some((c) => c.expiresAt?.exists === false)
  const hasEqualsNull = orGroup.some((c) => c.expiresAt?.equals === null)
  const hasGreaterThan = orGroup.some((c) => typeof c.expiresAt?.greater_than === 'string')
  if (!hasExistsFalse || !hasEqualsNull || !hasGreaterThan) {
    throw new Error(
      `hasEntitlement: "or" group must cover exists:false, equals:null, and greater_than — got ${JSON.stringify(orGroup)}`,
    )
  }
  const nowIso = orGroup.find((c) => typeof c.expiresAt?.greater_than === 'string')!.expiresAt
    .greater_than as string
  const nowDate = new Date(nowIso)

  const docs = await db
    .collection('enrollments')
    .find({
      user: new ObjectId(userClause),
      course: new ObjectId(courseClause),
      status: statusClause,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: nowDate } },
      ],
    })
    .toArray()

  return { docs }
}

function buildFakePayload(userId: ObjectId) {
  return {
    find: vi.fn(async (opts: any) => findEnrollmentsViaPayloadFake(opts.where)),
    findByID: vi.fn(async () => ({ id: userId.toString(), courseEntitlements: [] })),
    logger: { warn: vi.fn() },
  }
}

describe('hasEntitlement — expiresAt filter', () => {
  it('denies access when expiresAt is in the past', async () => {
    const { hasEntitlement } = await import('@/server/services/entitlement_check')
    const fakePayload = buildFakePayload(userExpired)
    const result = await hasEntitlement({
      payload: fakePayload as any,
      userId: userExpired.toString(),
      courseId: courseId.toString(),
    })
    expect(result).toBe(false)
  })

  it('grants access when expiresAt is in the future', async () => {
    const { hasEntitlement } = await import('@/server/services/entitlement_check')
    const fakePayload = buildFakePayload(userFuture)
    const result = await hasEntitlement({
      payload: fakePayload as any,
      userId: userFuture.toString(),
      courseId: courseId.toString(),
    })
    expect(result).toBe(true)
  })

  it('grants access when expiresAt is absent (lifetime)', async () => {
    const { hasEntitlement } = await import('@/server/services/entitlement_check')
    const fakePayload = buildFakePayload(userNoExpires)
    const result = await hasEntitlement({
      payload: fakePayload as any,
      userId: userNoExpires.toString(),
      courseId: courseId.toString(),
    })
    expect(result).toBe(true)
  })

  it('grants access when expiresAt is null (lifetime re-purchase)', async () => {
    const { hasEntitlement } = await import('@/server/services/entitlement_check')
    const fakePayload = buildFakePayload(userNullExpires)
    const result = await hasEntitlement({
      payload: fakePayload as any,
      userId: userNullExpires.toString(),
      courseId: courseId.toString(),
    })
    expect(result).toBe(true)
  })
})

// ─── findCourseAccessGrants (raw MongoDB, /api/entitlements/check) ────────
describe('findCourseAccessGrants — expiresAt filter', () => {
  async function grantsFor(userId: ObjectId) {
    const { findCourseAccessGrants, grantsAccess } = await import('@/server/services/course-access')
    const grants = await findCourseAccessGrants(userId.toString(), courseId.toString())
    return { grants, hasAccess: grantsAccess(grants, courseId.toString()) }
  }

  it('denies access when expiresAt is in the past', async () => {
    const { grants, hasAccess } = await grantsFor(userExpired)
    expect(grants.enrollment).toBeNull()
    expect(hasAccess).toBe(false)
  })

  it('grants access when expiresAt is in the future', async () => {
    const { grants, hasAccess } = await grantsFor(userFuture)
    expect(grants.enrollment).not.toBeNull()
    expect(hasAccess).toBe(true)
  })

  it('grants access when expiresAt is absent (lifetime)', async () => {
    const { grants, hasAccess } = await grantsFor(userNoExpires)
    expect(grants.enrollment).not.toBeNull()
    expect(hasAccess).toBe(true)
  })

  it('grants access when expiresAt is null (lifetime re-purchase)', async () => {
    const { grants, hasAccess } = await grantsFor(userNullExpires)
    expect(grants.enrollment).not.toBeNull()
    expect(hasAccess).toBe(true)
  })
})
