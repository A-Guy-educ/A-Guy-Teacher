/**
 * Unit tests for the web-direct purchase receipt sender.
 *
 * Pinned behavior:
 *   - idempotent on `emailSentAt` — second call for the same transaction skips
 *   - no-op when RESEND_API_KEY isn't set (dev / preview don't break)
 *   - missing user email or product name → skip with reason 'missing_data'
 *   - happy path: calls Resend, then marks transaction.emailSentAt
 *   - Resend SDK reject / throw → returns `error`, does NOT set emailSentAt
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ObjectId } from 'mongodb'

const sendMock = vi.fn()
vi.mock('resend', () => {
  class Resend {
    emails = { send: sendMock }
    constructor(_apiKey: string) {
      void _apiKey
    }
  }
  return { Resend }
})

const findOneMock = vi.fn()
const updateOneMock = vi.fn()
vi.mock('@/infra/db/content-db', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/db/content-db')>('@/infra/db/content-db')
  return {
    ...actual,
    getContentDb: vi.fn(async () => ({
      collection: () => ({
        findOne: findOneMock,
        updateOne: updateOneMock,
      }),
    })),
  }
})

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createRequestLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

import {
  _resetResendClient,
  sendPurchaseReceipt,
} from '@/server/email/services/purchase-receipt-service'

const TX_ID_HEX = '507f1f77bcf86cd799439011'
const USER_ID_HEX = '507f191e810c19729de860ea'
const PRODUCT_ID_HEX = '507f191e810c19729de860eb'

function buildOptions(overrides: Partial<Parameters<typeof sendPurchaseReceipt>[0]> = {}) {
  return {
    transactionId: TX_ID_HEX,
    userId: USER_ID_HEX,
    productId: PRODUCT_ID_HEX,
    providerTransactionId: 'PAYPAL_ORDER_X',
    amount: 4900,
    currency: 'ILS',
    appliedCoupon: null,
    ...overrides,
  }
}

describe('sendPurchaseReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetResendClient()
    process.env.RESEND_API_KEY = 're_test_key'
    // Default DB shape: transaction (without emailSentAt), user with email, product with name.
    findOneMock.mockImplementation(async (filter: { _id: unknown; projection?: unknown }) => {
      // findOne is called three times: transactions (idempotency), users, products.
      const id = filter._id instanceof ObjectId ? filter._id.toString() : String(filter._id)
      if (id === TX_ID_HEX) return { _id: new ObjectId(TX_ID_HEX) /* no emailSentAt */ }
      if (id === USER_ID_HEX) return { email: 'buyer@example.com', locale: 'he' }
      if (id === PRODUCT_ID_HEX) return { name: 'Test Product' }
      return null
    })
    updateOneMock.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
    sendMock.mockResolvedValue({ data: { id: 'msg_abc' }, error: null })
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    _resetResendClient()
  })

  it('returns already_sent and skips Resend when emailSentAt is already set', async () => {
    findOneMock.mockImplementationOnce(async () => ({
      _id: new ObjectId(TX_ID_HEX),
      emailSentAt: new Date('2026-06-15T10:00:00Z'),
    }))

    const result = await sendPurchaseReceipt(buildOptions())

    expect(result).toEqual({ sent: false, reason: 'already_sent' })
    expect(sendMock).not.toHaveBeenCalled()
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('returns no_adapter when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    _resetResendClient()

    const result = await sendPurchaseReceipt(buildOptions())

    expect(result).toEqual({ sent: false, reason: 'no_adapter' })
    expect(sendMock).not.toHaveBeenCalled()
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('returns missing_data when user has no email', async () => {
    findOneMock.mockImplementation(async (filter: { _id: unknown }) => {
      const id = filter._id instanceof ObjectId ? filter._id.toString() : String(filter._id)
      if (id === TX_ID_HEX) return { _id: new ObjectId(TX_ID_HEX) }
      if (id === USER_ID_HEX) return { /* no email */ locale: 'he' }
      if (id === PRODUCT_ID_HEX) return { name: 'Test Product' }
      return null
    })

    const result = await sendPurchaseReceipt(buildOptions())

    expect(result).toEqual({ sent: false, reason: 'missing_data' })
    expect(sendMock).not.toHaveBeenCalled()
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('falls back to product.title when product.name is missing', async () => {
    findOneMock.mockImplementation(async (filter: { _id: unknown }) => {
      const id = filter._id instanceof ObjectId ? filter._id.toString() : String(filter._id)
      if (id === TX_ID_HEX) return { _id: new ObjectId(TX_ID_HEX) }
      if (id === USER_ID_HEX) return { email: 'buyer@example.com' }
      if (id === PRODUCT_ID_HEX) return { title: 'Title Fallback' }
      return null
    })

    const result = await sendPurchaseReceipt(buildOptions())

    expect(result).toEqual({ sent: true })
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]?.[0].html).toContain('Title Fallback')
  })

  it('sends via Resend with the right from/to/subject and marks transaction.emailSentAt', async () => {
    const result = await sendPurchaseReceipt(buildOptions())

    expect(result).toEqual({ sent: true })
    expect(sendMock).toHaveBeenCalledTimes(1)
    const sendArg = sendMock.mock.calls[0]?.[0] as {
      from: string
      to: string
      subject: string
      html: string
    }
    expect(sendArg.from).toBe('support@aguy.co.il')
    expect(sendArg.to).toBe('buyer@example.com')
    expect(typeof sendArg.subject).toBe('string')
    expect(sendArg.html).toContain('Test Product')

    // The third call to updateOne stamps emailSentAt.
    const lastUpdate = updateOneMock.mock.calls.at(-1)
    expect(lastUpdate?.[1]?.$set).toMatchObject({ emailSentAt: expect.any(Date) })
  })

  it('returns error when Resend resolves with an error payload — does NOT set emailSentAt', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', message: 'Invalid to address' },
    })

    const result = await sendPurchaseReceipt(buildOptions())

    expect(result).toEqual({ sent: false, reason: 'error' })
    expect(updateOneMock).not.toHaveBeenCalled() // emailSentAt would only be set on success
  })

  it('returns error when Resend SDK throws — does NOT set emailSentAt', async () => {
    sendMock.mockRejectedValueOnce(new Error('network timeout'))

    const result = await sendPurchaseReceipt(buildOptions())

    expect(result).toEqual({ sent: false, reason: 'error' })
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('passes coupon details into the template when an applied coupon is provided', async () => {
    await sendPurchaseReceipt(
      buildOptions({
        appliedCoupon: {
          code: 'WELCOME10',
          discountType: 'percentage',
          discountValue: 10,
          originalAmount: 5000,
          discountedAmount: 4500,
        },
      }),
    )

    expect(sendMock).toHaveBeenCalledTimes(1)
    const html = sendMock.mock.calls[0]?.[0].html as string
    expect(html).toContain('WELCOME10')
  })
})
