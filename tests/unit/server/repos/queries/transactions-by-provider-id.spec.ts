/**
 * Unit tests for queryTransactionByProviderId — the lookup the
 * /checkout/success page uses to resolve a Stripe session ID or PayPal
 * order ID back to a transaction row + product name.
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

const ORDER_ID = 'PAYPAL_ORDER_4NC1596173497311Y'
const TX_ID_HEX = '507f1f77bcf86cd799439011'

describe('queryTransactionByProviderId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toArrayMock.mockResolvedValue([])
  })

  it('matches on providerTransactionId and limits to one row', async () => {
    const { queryTransactionByProviderId } = await import('@/server/repos/queries/transactions')

    await queryTransactionByProviderId(ORDER_ID)

    const pipeline = aggregateMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>
    expect(pipeline[0]).toEqual({ $match: { providerTransactionId: ORDER_ID } })
    expect(pipeline[1]).toEqual({ $limit: 1 })
  })

  it('returns null when no row matches the provider id', async () => {
    const { queryTransactionByProviderId } = await import('@/server/repos/queries/transactions')

    const result = await queryTransactionByProviderId('does-not-exist')

    expect(result).toBeNull()
  })

  it('returns id + status + joined productName for a matching row', async () => {
    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(TX_ID_HEX),
        providerTransactionId: ORDER_ID,
        status: 'succeeded',
        productDoc: { name: 'Test Product', slug: 'test' },
      },
    ])

    const { queryTransactionByProviderId } = await import('@/server/repos/queries/transactions')
    const result = await queryTransactionByProviderId(ORDER_ID)

    expect(result).toEqual({
      id: TX_ID_HEX,
      status: 'succeeded',
      productName: 'Test Product',
    })
  })

  it('falls back to product.title when name is missing and tolerates a missing join', async () => {
    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(TX_ID_HEX),
        providerTransactionId: ORDER_ID,
        status: 'pending',
        productDoc: { title: 'Fallback Title' },
      },
    ])

    const { queryTransactionByProviderId } = await import('@/server/repos/queries/transactions')
    const result1 = await queryTransactionByProviderId(ORDER_ID)
    expect(result1?.productName).toBe('Fallback Title')

    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(TX_ID_HEX),
        providerTransactionId: ORDER_ID,
        status: 'pending',
        // No productDoc — product field was bad or product was deleted.
      },
    ])

    const result2 = await queryTransactionByProviderId(ORDER_ID)
    expect(result2?.productName).toBeNull()
  })

  it('does not leak user / amount / tenant fields back to the page', async () => {
    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(TX_ID_HEX),
        providerTransactionId: ORDER_ID,
        status: 'succeeded',
        user: new ObjectId(),
        tenant: 'tenant_a',
        amount: 4900,
        productDoc: { name: 'P' },
      },
    ])

    const { queryTransactionByProviderId } = await import('@/server/repos/queries/transactions')
    const result = await queryTransactionByProviderId(ORDER_ID)

    expect(Object.keys(result ?? {})).toEqual(['id', 'status', 'productName'])
  })
})
