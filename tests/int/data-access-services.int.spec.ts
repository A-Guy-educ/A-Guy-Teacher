// @vitest-environment node
/**
 * Integration test: the service-layer behaviours a fake database cannot show.
 *
 * The route tests added during the data-access migration run against an
 * in-memory stand-in (`tests/unit/api/helpers/fake-content-db.ts`). That is a
 * plain JavaScript object, so four things are invisible to it — and all four
 * are load-bearing:
 *
 *   1. Collation. `findAccessCode` matches case-insensitively via a collation
 *      option. The unit test passes because the route upper-cases its input,
 *      so it would keep passing if the collation were dropped.
 *   2. Unique indexes. Checkout distinguishes a double-click race from a real
 *      failure by catching duplicate-key error 11000.
 *   3. Real concurrency. `consumeAccessCodeUse` and `claimTransactionSucceeded`
 *      are conditional updates precisely so that exactly one of several
 *      simultaneous callers wins.
 *   4. Operator semantics. The fake implements `$in`, `$regex`, `$setOnInsert`
 *      and friends by hand; only a real server proves the queries mean what we
 *      think.
 *
 * These exercise the services directly rather than through routes: the routes
 * are covered by the unit tests, and what is under test here is the query.
 *
 * @fileType integration-test
 * @domain data-access
 * @pattern service-layer
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getContentDb } from '@/infra/db/content-db'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import {
  consumeAccessCodeUse,
  findAccessCode,
  grantCourseByCode,
  hasCourseGrant,
} from '@/server/services/entitlement-grants'
import { findCourseAccessGrants, grantsAccess } from '@/server/services/course-access'
import { archiveConversation, findConversationsByContext } from '@/server/services/conversations'
import { claimTransactionSucceeded } from '@/server/services/transactions'
import { getUserSettings, setTeacherProfile } from '@/server/services/user-settings'

let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  process.env.DATABASE_URL = await startMongoContainer()
}, 120_000)

afterAll(async () => {
  await stopMongoContainer()
  process.env.DATABASE_URL = originalDatabaseUrl
})

function newId() {
  return new ObjectId()
}

describe('access codes: case-insensitive matching', () => {
  it('finds a code regardless of the case it was stored in', async () => {
    // The unit test cannot show this: it passes because the route upper-cases
    // the input, so it would survive the collation being deleted.
    const db = await getContentDb()
    await db.collection('access-codes').insertOne({
      _id: newId(),
      code: 'MixedCase',
      isActive: true,
      course: newId(),
    } as any)

    expect(await findAccessCode('MIXEDCASE')).not.toBeNull()
    expect(await findAccessCode('mixedcase')).not.toBeNull()
  })

  it('does not match a different code', async () => {
    expect(await findAccessCode('NO-SUCH-CODE-AT-ALL')).toBeNull()
  })
})

describe('access codes: consuming a use under real concurrency', () => {
  it('lets exactly one of five simultaneous callers take the last use', async () => {
    const db = await getContentDb()
    const codeId = newId()
    await db.collection('access-codes').insertOne({
      _id: codeId,
      code: `LAST-USE-${Date.now()}`,
      isActive: true,
      course: newId(),
      maxUses: 1,
      currentUses: 0,
    } as any)

    const accessCode = await db.collection('access-codes').findOne({ _id: codeId })
    const results = await Promise.all(
      Array.from({ length: 5 }, () => consumeAccessCodeUse(accessCode!)),
    )

    expect(results.filter(Boolean)).toHaveLength(1)
    const after = await db.collection('access-codes').findOne({ _id: codeId })
    expect(after?.currentUses).toBe(1)
  })

  it('refuses an expired code even while it is still marked active', async () => {
    const db = await getContentDb()
    const codeId = newId()
    await db.collection('access-codes').insertOne({
      _id: codeId,
      code: `EXPIRED-${Date.now()}`,
      isActive: true,
      course: newId(),
      expiresAt: new Date('2000-01-01'),
      maxUses: 0,
      currentUses: 0,
    } as any)

    const accessCode = await db.collection('access-codes').findOne({ _id: codeId })

    expect(await consumeAccessCodeUse(accessCode!)).toBe(false)
  })

  it('allows unlimited uses when no maximum is set', async () => {
    const db = await getContentDb()
    const codeId = newId()
    await db.collection('access-codes').insertOne({
      _id: codeId,
      code: `UNLIMITED-${Date.now()}`,
      isActive: true,
      course: newId(),
      maxUses: 0,
      currentUses: 99,
    } as any)

    const accessCode = await db.collection('access-codes').findOne({ _id: codeId })

    expect(await consumeAccessCodeUse(accessCode!)).toBe(true)
  })
})

describe('course access: grants are found however the ids were stored', () => {
  it('finds an entitlement written with ObjectId references', async () => {
    const db = await getContentDb()
    const userId = newId()
    const courseId = newId()
    await db
      .collection('user-entitlements')
      .insertOne({ _id: newId(), user: userId, course: courseId } as any)

    const grants = await findCourseAccessGrants(userId.toString(), courseId.toString())

    expect(grants.entitlement).not.toBeNull()
    expect(grantsAccess(grants, courseId.toString())).toBe(true)
  })

  it('finds an enrollment written with string references', async () => {
    // Older rows stored the relation as text. The `$in` candidate list is what
    // keeps both readable, and only a real server proves it.
    const db = await getContentDb()
    const userId = newId()
    const courseId = newId()
    await db.collection('enrollments').insertOne({
      _id: newId(),
      user: userId.toString(),
      course: courseId.toString(),
      status: 'active',
    } as any)

    const grants = await findCourseAccessGrants(userId.toString(), courseId.toString())

    expect(grants.enrollment).not.toBeNull()
  })

  it('ignores a cancelled enrollment', async () => {
    const db = await getContentDb()
    const userId = newId()
    const courseId = newId()
    await db
      .collection('enrollments')
      .insertOne({ _id: newId(), user: userId, course: courseId, status: 'cancelled' } as any)

    const grants = await findCourseAccessGrants(userId.toString(), courseId.toString())

    expect(grants.enrollment).toBeNull()
    expect(grantsAccess(grants, courseId.toString())).toBe(false)
  })

  it('grants a course by code, and then reports it as already held', async () => {
    const db = await getContentDb()
    const userId = newId()
    const courseId = newId()
    const codeId = newId()
    await db
      .collection('access-codes')
      .insertOne({ _id: codeId, tenant: newId(), course: courseId } as any)
    const accessCode = await db.collection('access-codes').findOne({ _id: codeId })

    expect(await hasCourseGrant(userId.toString(), courseId.toString())).toBe(false)

    await grantCourseByCode(userId.toString(), courseId.toString(), accessCode!)

    expect(await hasCourseGrant(userId.toString(), courseId.toString())).toBe(true)
  })
})

describe('transactions: claiming a capture under real concurrency', () => {
  it('lets exactly one of five simultaneous webhooks flip the status', async () => {
    const db = await getContentDb()
    const transactionId = newId()
    await db.collection('transactions').insertOne({ _id: transactionId, status: 'pending' } as any)

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimTransactionSucceeded(transactionId.toString(), {
          captureId: 'capture-1',
          capturedAt: new Date(),
        }),
      ),
    )

    expect(results.filter(Boolean)).toHaveLength(1)
    const after = await db.collection('transactions').findOne({ _id: transactionId })
    expect(after?.status).toBe('succeeded')
    expect(after?.captureId).toBe('capture-1')
  })

  it('does not overwrite a capture id with nothing', async () => {
    const db = await getContentDb()
    const transactionId = newId()
    await db
      .collection('transactions')
      .insertOne({ _id: transactionId, status: 'pending', captureId: 'original' } as any)

    await claimTransactionSucceeded(transactionId.toString(), {
      captureId: null,
      capturedAt: new Date(),
    })

    const after = await db.collection('transactions').findOne({ _id: transactionId })
    expect(after?.captureId).toBe('original')
  })

  it('will not reclaim a transaction that already succeeded', async () => {
    const db = await getContentDb()
    const transactionId = newId()
    await db
      .collection('transactions')
      .insertOne({ _id: transactionId, status: 'succeeded' } as any)

    expect(
      await claimTransactionSucceeded(transactionId.toString(), {
        captureId: 'later',
        capturedAt: new Date(),
      }),
    ).toBe(false)
  })
})

describe('user settings: creating the record on first save', () => {
  it('creates then updates, never producing a second record', async () => {
    // Exercises the real `$setOnInsert` upsert, which the fake imitates by hand.
    const db = await getContentDb()
    const userId = newId()
    const first = newId()
    const second = newId()
    await db.collection('teacher_profiles').insertMany([
      { _id: first, slug: `first-${Date.now()}`, isEnabled: true },
      { _id: second, slug: `second-${Date.now()}`, isEnabled: true },
    ] as any)

    await setTeacherProfile(userId.toString(), first)
    await setTeacherProfile(userId.toString(), second)

    const rows = await db
      .collection('user_settings')
      .find({ user: { $in: [userId, userId.toString()] } })
      .toArray()

    expect(rows).toHaveLength(1)
    expect(String(rows[0].teacherProfile)).toBe(second.toString())
  })

  it('reports no profile for a user who has never chosen one', async () => {
    expect(await getUserSettings(newId().toString(), 'he')).toEqual({
      id: null,
      teacherProfile: null,
    })
  })
})

describe('conversations: ownership and prefix search', () => {
  it('finds a caller conversations by context prefix, and nobody else', async () => {
    const db = await getContentDb()
    const owner = newId()
    const stranger = newId()
    const prefix = `ask:course-${Date.now()}`

    await db.collection('conversations').insertMany([
      { _id: newId(), user: owner, contextKey: `${prefix}:1`, messages: [] },
      { _id: newId(), user: owner, contextKey: `${prefix}:2`, messages: [] },
      { _id: newId(), user: stranger, contextKey: `${prefix}:3`, messages: [] },
    ] as any)

    const { docs, total } = await findConversationsByContext({
      ownerId: owner.toString(),
      contextKey: null,
      contextKeyPrefix: `${prefix}:`,
      limit: 100,
    })

    expect(docs).toHaveLength(2)
    expect(total).toBe(2)
  })

  it('treats regex characters in a prefix as literal text', async () => {
    const db = await getContentDb()
    const owner = newId()
    await db
      .collection('conversations')
      .insertOne({ _id: newId(), user: owner, contextKey: 'ask:courseX:1', messages: [] } as any)

    const { docs } = await findConversationsByContext({
      ownerId: owner.toString(),
      contextKey: null,
      contextKeyPrefix: 'ask:course.:',
      limit: 100,
    })

    expect(docs).toEqual([])
  })

  it('refuses to archive a conversation belonging to someone else', async () => {
    const db = await getContentDb()
    const owner = newId()
    const stranger = newId()
    const conversationId = newId()
    await db
      .collection('conversations')
      .insertOne({ _id: conversationId, user: owner, contextKey: 'ask:x:1' } as any)

    expect(await archiveConversation(stranger.toString(), conversationId.toString())).toBe(false)

    const untouched = await db.collection('conversations').findOne({ _id: conversationId })
    expect(untouched?.archivedAt).toBeUndefined()

    expect(await archiveConversation(owner.toString(), conversationId.toString())).toBe(true)
  })
})
