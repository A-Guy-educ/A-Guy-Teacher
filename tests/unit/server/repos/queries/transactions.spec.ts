/**
 * Unit tests for queryUserTransactions.
 *
 * The /account/purchases page passed an empty array until this PR. The query
 * is now what drives that page, so we lock in:
 *   - matches user as both ObjectId and string (historical rows store either)
 *   - sorted newest-first, capped at 100
 *   - JOIN'd against products via $lookup → productName / productSlug
 *   - serializes ObjectIds and Dates to the shape PurchasesPageContent expects
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

const toArrayMock = vi.fn()
const aggregateMock = vi.fn(() => ({ toArray: toArrayMock }))
vi.mock('@/infra/db/content-db', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/db/content-db')>('@/infra/db/content-db')
  return {
    ...actual,
    getContentDb: vi.fn(async () => ({
      collection: () => ({ aggregate: aggregateMock }),
    })),
  }
})

const USER_ID_HEX = '507f191e810c19729de860ea'
const TX_ID_HEX = '507f1f77bcf86cd799439011'

describe('queryUserTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toArrayMock.mockResolvedValue([])
  })

  it('matches user as both ObjectId and string so legacy rows are not hidden', async () => {
    const { queryUserTransactions } = await import('@/server/repos/queries/transactions')

    await queryUserTransactions(USER_ID_HEX)

    const pipeline = aggregateMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>
    const match = pipeline[0] as { $match: { $or: Array<Record<string, unknown>> } }
    expect(match.$match.$or).toEqual(
      expect.arrayContaining([{ user: USER_ID_HEX }, { user: expect.any(ObjectId) }]),
    )
  })

  it('only matches user as a string when the id is not ObjectId-shaped', async () => {
    const { queryUserTransactions } = await import('@/server/repos/queries/transactions')

    await queryUserTransactions('user@example.com')

    const pipeline = aggregateMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>
    const match = pipeline[0] as { $match: { $or: Array<Record<string, unknown>> } }
    expect(match.$match.$or).toEqual([{ user: 'user@example.com' }])
  })

  it('sorts newest-first and limits the result set', async () => {
    const { queryUserTransactions } = await import('@/server/repos/queries/transactions')

    await queryUserTransactions(USER_ID_HEX)

    const pipeline = aggregateMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>
    expect(pipeline[1]).toEqual({ $sort: { createdAt: -1 } })
    expect(pipeline[2]).toEqual({ $limit: 100 })
  })

  it('serializes joined Mongo rows into the TransactionWithProduct shape', async () => {
    const createdAt = new Date('2026-06-15T10:00:00Z')
    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(TX_ID_HEX),
        user: new ObjectId(USER_ID_HEX),
        product: new ObjectId(),
        status: 'succeeded',
        provider: 'paypal',
        amount: 4900,
        currency: 'ILS',
        createdAt,
        metadata: { appliedCoupon: { code: 'WELCOME10' } },
        productDoc: { name: 'Test Product', slug: 'test' },
      },
    ])

    const { queryUserTransactions } = await import('@/server/repos/queries/transactions')
    const [row] = await queryUserTransactions(USER_ID_HEX)

    expect(row).toEqual({
      id: TX_ID_HEX,
      status: 'succeeded',
      amount: 4900,
      currency: 'ILS',
      createdAt: '2026-06-15T10:00:00.000Z',
      provider: 'paypal',
      productName: 'Test Product',
      productSlug: 'test',
      couponCode: 'WELCOME10',
      refundedAmount: null,
      refundedAt: null,
    })
  })

  it('falls back to product.title when product.name is missing, and tolerates missing joins', async () => {
    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(TX_ID_HEX),
        user: USER_ID_HEX,
        status: 'pending',
        provider: 'paypal',
        amount: 100,
        currency: 'USD',
        createdAt: '2026-06-15T10:00:00Z',
        productDoc: { title: 'Fallback Title' },
      },
      {
        _id: new ObjectId(),
        user: USER_ID_HEX,
        status: 'pending',
        provider: 'paypal',
        amount: 100,
        currency: 'USD',
        createdAt: '2026-06-15T10:00:00Z',
        // No productDoc — JOIN missed the product (deleted, or product field was bad).
      },
    ])

    const { queryUserTransactions } = await import('@/server/repos/queries/transactions')
    const rows = await queryUserTransactions(USER_ID_HEX)

    expect(rows[0]?.productName).toBe('Fallback Title')
    expect(rows[1]?.productName).toBeNull()
    expect(rows[1]?.productSlug).toBeNull()
  })
})
