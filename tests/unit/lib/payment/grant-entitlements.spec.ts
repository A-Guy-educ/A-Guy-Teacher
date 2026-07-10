/**
 * Unit tests for grantProductEntitlements (#689 spec).
 *
 * The function walks `product.contents`, and for every `courseBlock` it
 * inserts (idempotently) into `user-entitlements` and `enrollments`. These
 * tests pin that contract end-to-end with a mocked Mongo collection —
 * verifying the right documents are inserted, the idempotency check fires,
 * and the missing-product case propagates.
 */
import { ObjectId } from 'mongodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Row {
  [key: string]: unknown
}

const productRows: Row[] = []
const enrollmentRows: Row[] = []
const entitlementRows: Row[] = []

const productsState: { findOne: ReturnType<typeof vi.fn> } = {
  findOne: vi.fn(
    async (filter: Record<string, unknown>) => productRows.find((r) => matches(r, filter)) ?? null,
  ),
}

function matches(row: Row, filter: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(filter)) {
    const rowValue = row[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const ops = value as Record<string, unknown>
      if ('$in' in ops) {
        const allowed = (ops.$in as unknown[]).map((v) => String(v))
        if (!allowed.some((v) => v === String(rowValue) || matchesObjectId(rowValue, v)))
          return false
      } else if ('$ne' in ops) {
        const ne = ops.$ne
        if (String(rowValue) === String(ne)) return false
      }
    } else if (typeof value === 'string' || value instanceof ObjectId) {
      if (
        String(rowValue) !== String(value) &&
        !(rowValue instanceof ObjectId && String(rowValue) === String(value))
      ) {
        return false
      }
    } else if (rowValue !== value) {
      return false
    }
  }
  return true
}

function matchesObjectId(value: unknown, target: string): boolean {
  if (value instanceof ObjectId) return value.toString() === target
  return false
}

function collectionMock(rows: Row[]) {
  return {
    findOne: vi.fn(
      async (filter: Record<string, unknown>) => rows.find((r) => matches(r, filter)) ?? null,
    ),
    insertOne: vi.fn(async (doc: Row) => {
      rows.push(doc)
      return { insertedId: 'fake' }
    }),
  }
}

vi.mock('@/infra/db/content-db', () => ({
  getContentDb: vi.fn(async () => ({
    collection: (name: string) => {
      if (name === 'products') return productsState
      if (name === 'user-entitlements') return collectionMock(entitlementRows)
      if (name === 'enrollments') return collectionMock(enrollmentRows)
      throw new Error(`Unexpected collection: ${name}`)
    },
  })),
  relationId: (value: unknown) => {
    if (value instanceof ObjectId) return value.toString()
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const v = value as { id?: unknown; _id?: unknown }
      if (typeof v.id === 'string' || v.id instanceof ObjectId) return String(v.id)
      if (typeof v._id === 'string' || v._id instanceof ObjectId) return String(v._id)
    }
    return null
  },
}))

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createRequestLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

import { grantProductEntitlements } from '@/lib/payment/grant-entitlements'

const PRODUCT_ID = new ObjectId().toString()
const USER_ID = new ObjectId().toString()
const COURSE_ID = new ObjectId().toString()
const TX_ID = new ObjectId().toString()
const TENANT_ID = new ObjectId().toString()

function seedProduct(overrides: Record<string, unknown> = {}) {
  productRows.length = 0
  productRows.push({
    _id: new ObjectId(PRODUCT_ID),
    tenant: new ObjectId(TENANT_ID),
    contents: [{ blockType: 'courseBlock', course: new ObjectId(COURSE_ID) }],
    ...overrides,
  })
}

describe('grantProductEntitlements', () => {
  beforeEach(() => {
    productRows.length = 0
    entitlementRows.length = 0
    enrollmentRows.length = 0
    productsState.findOne.mockClear()
  })

  it('throws when the product does not exist (so the webhook returns 500 → PayPal retries)', async () => {
    await expect(grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)).rejects.toThrow(
      /product not found/i,
    )
  })

  it('grants a course entitlement for a single courseBlock', async () => {
    seedProduct()

    await grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)

    expect(entitlementRows).toHaveLength(1)
    expect(enrollmentRows).toHaveLength(1)

    const entitlementDoc = entitlementRows[0]!
    expect(entitlementDoc.contentType).toBe('course')
    expect(entitlementDoc.grantMethod).toBe('purchase')
    expect(String(entitlementDoc.transaction)).toBe(TX_ID)
    expect(String(entitlementDoc.user)).toBe(USER_ID)
    expect(String(entitlementDoc.course)).toBe(COURSE_ID)
    expect(String(entitlementDoc.tenant)).toBe(TENANT_ID)
    expect(entitlementDoc.createdAt).toBeInstanceOf(Date)
    expect(entitlementDoc.updatedAt).toBeInstanceOf(Date)

    const enrollmentDoc = enrollmentRows[0]!
    expect(enrollmentDoc.status).toBe('active')
    expect(enrollmentDoc.grantMethod).toBe('purchase')
    expect(enrollmentDoc.source).toBe('self')
    expect(String(enrollmentDoc.user)).toBe(USER_ID)
    expect(String(enrollmentDoc.course)).toBe(COURSE_ID)
    expect((enrollmentDoc.metadata as { transactionId: string }).transactionId).toBe(TX_ID)
  })

  it('is idempotent — does not re-insert when an entitlement already exists', async () => {
    seedProduct()
    // Pre-existing entitlement for the (user, course) pair.
    entitlementRows.push({
      _id: new ObjectId(),
      user: new ObjectId(USER_ID),
      course: new ObjectId(COURSE_ID),
    })

    await grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)

    expect(entitlementRows).toHaveLength(1)
    expect(enrollmentRows).toHaveLength(0)
  })

  it('is idempotent — does not re-insert when an active enrollment already exists', async () => {
    seedProduct()
    // No entitlement, but an existing active enrollment short-circuits the grant.
    enrollmentRows.push({
      _id: new ObjectId(),
      user: new ObjectId(USER_ID),
      course: new ObjectId(COURSE_ID),
      status: 'active',
    })

    await grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)

    expect(entitlementRows).toHaveLength(0)
    expect(enrollmentRows).toHaveLength(1)
  })

  it('treats cancelled enrollments as non-existent and re-grants', async () => {
    // A cancelled enrollment should NOT block re-granting — the buyer had
    // their access revoked and is now buying (or re-buying) the course.
    seedProduct()
    enrollmentRows.push({
      _id: new ObjectId(),
      user: new ObjectId(USER_ID),
      course: new ObjectId(COURSE_ID),
      status: 'cancelled',
    })

    await grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)

    expect(entitlementRows).toHaveLength(1)
    expect(enrollmentRows).toHaveLength(2) // existing cancelled + new active
  })

  it('skips non-courseBlock blocks (featureBlock falls outside this spec)', async () => {
    seedProduct({
      contents: [
        { blockType: 'featureBlock', feature: new ObjectId().toString() },
        { blockType: 'courseBlock', course: new ObjectId(COURSE_ID) },
      ],
    })

    await grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)

    expect(entitlementRows).toHaveLength(1)
    expect(enrollmentRows).toHaveLength(1)
    // Verify the only insert was for COURSE_ID, not the feature id.
    expect(String(entitlementRows[0]!.course)).toBe(COURSE_ID)
  })

  it('walks every courseBlock when the product bundles multiple courses', async () => {
    const secondCourseId = new ObjectId().toString()
    seedProduct({
      contents: [
        { blockType: 'courseBlock', course: new ObjectId(COURSE_ID) },
        { blockType: 'courseBlock', course: new ObjectId(secondCourseId) },
      ],
    })

    await grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)

    expect(entitlementRows).toHaveLength(2)
    expect(enrollmentRows).toHaveLength(2)

    const courses = entitlementRows.map((row) => String(row.course)).sort()
    expect(courses).toEqual([COURSE_ID, secondCourseId].sort())
  })

  it('returns silently when the product has no contents (feature-only bundle)', async () => {
    seedProduct({ contents: [] })

    await expect(grantProductEntitlements(USER_ID, PRODUCT_ID, TX_ID)).resolves.toBeUndefined()

    expect(entitlementRows).toHaveLength(0)
    expect(enrollmentRows).toHaveLength(0)
  })

  it('returns silently when any required identifier is missing', async () => {
    seedProduct()

    await grantProductEntitlements('', PRODUCT_ID, TX_ID)
    await grantProductEntitlements(USER_ID, '', TX_ID)
    await grantProductEntitlements(USER_ID, PRODUCT_ID, '')

    // No product lookup happens when an identifier is missing.
    expect(productsState.findOne).not.toHaveBeenCalled()
    expect(entitlementRows).toHaveLength(0)
    expect(enrollmentRows).toHaveLength(0)
  })
})
