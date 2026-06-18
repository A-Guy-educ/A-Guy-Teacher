/**
 * Unit tests for the web-direct purchase receipt sender.
 *
 * Pinned behavior:
 *   - no_adapter when RESEND_API_KEY is missing — checked FIRST so dev /
 *     preview deployments don't even open a DB connection per webhook
 *   - atomic claim via findOneAndUpdate({...emailSentAt: $exists: false}):
 *       - claim returns null → already_sent, no send
 *       - claim returns the doc → proceeds
 *   - rollback ($unset emailSentAt) on missing_data, Resend error, or SDK throw
 *     so a later retry can re-claim
 *   - Resend send called with idempotencyKey = transactionId
 *   - currency-aware fixed-coupon rendering
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
const findOneAndUpdateMock = vi.fn()
const updateOneMock = vi.fn()
vi.mock('@/infra/db/content-db', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/db/content-db')>('@/infra/db/content-db')
  return {
    ...actual,
    getContentDb: vi.fn(async () => ({
      collection: () => ({
        findOne: findOneMock,
        findOneAndUpdate: findOneAndUpdateMock,
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

function setupHappyPathMocks() {
  // The atomic claim succeeds (returns the row that just had emailSentAt set).
  findOneAndUpdateMock.mockResolvedValue({ _id: new ObjectId(TX_ID_HEX) })
  // Users + products lookups: route by collection isn't trivial since we
  // share one findOne mock, so route by _id payload.
  findOneMock.mockImplementation(async (filter: { _id: unknown }) => {
    const id = filter._id instanceof ObjectId ? filter._id.toString() : String(filter._id)
    if (id === USER_ID_HEX) return { email: 'buyer@example.com', locale: 'he' }
    if (id === PRODUCT_ID_HEX) return { name: 'Test Product' }
    return null
  })
  sendMock.mockResolvedValue({ data: { id: 'msg_abc' }, error: null })
  updateOneMock.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
}

describe('sendPurchaseReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetResendClient()
    process.env.RESEND_API_KEY = 're_test_key'
    setupHappyPathMocks()
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    _resetResendClient()
  })

  describe('adapter-missing short-circuit', () => {
    it('returns no_adapter when RESEND_API_KEY is missing — and makes zero DB calls', async () => {
      delete process.env.RESEND_API_KEY
      _resetResendClient()

      const result = await sendPurchaseReceipt(buildOptions())

      expect(result).toEqual({ sent: false, reason: 'no_adapter' })
      expect(sendMock).not.toHaveBeenCalled()
      expect(findOneMock).not.toHaveBeenCalled()
      expect(findOneAndUpdateMock).not.toHaveBeenCalled()
      expect(updateOneMock).not.toHaveBeenCalled()
    })
  })

  describe('atomic claim', () => {
    it('uses findOneAndUpdate with an emailSentAt-not-set filter, not a read-then-write', async () => {
      await sendPurchaseReceipt(buildOptions())

      expect(findOneAndUpdateMock).toHaveBeenCalledTimes(1)
      const [filter, update] = findOneAndUpdateMock.mock.calls[0] ?? []
      expect(filter).toMatchObject({ emailSentAt: { $exists: false } })
      expect((update as Record<string, Record<string, unknown>>).$set).toMatchObject({
        emailSentAt: expect.any(Date),
      })
    })

    it('returns already_sent and skips Resend when the claim returns null (concurrent caller already won)', async () => {
      findOneAndUpdateMock.mockResolvedValueOnce(null)

      const result = await sendPurchaseReceipt(buildOptions())

      expect(result).toEqual({ sent: false, reason: 'already_sent' })
      expect(sendMock).not.toHaveBeenCalled()
      // Also: should NOT have done any user/product reads — claim failure
      // means another invocation already owns this transaction.
      expect(findOneMock).not.toHaveBeenCalled()
    })
  })

  describe('missing data after claim', () => {
    it('rolls back the claim ($unset emailSentAt) when user has no email', async () => {
      findOneMock.mockImplementation(async (filter: { _id: unknown }) => {
        const id = filter._id instanceof ObjectId ? filter._id.toString() : String(filter._id)
        if (id === USER_ID_HEX) return { /* no email */ locale: 'he' }
        if (id === PRODUCT_ID_HEX) return { name: 'Test Product' }
        return null
      })

      const result = await sendPurchaseReceipt(buildOptions())

      expect(result).toEqual({ sent: false, reason: 'missing_data' })
      expect(sendMock).not.toHaveBeenCalled()
      expect(updateOneMock).toHaveBeenCalledTimes(1)
      const [, update] = updateOneMock.mock.calls[0] ?? []
      expect((update as Record<string, unknown>).$unset).toEqual({ emailSentAt: '' })
    })

    it('falls back to product.title when product.name is missing — happy send path', async () => {
      findOneMock.mockImplementation(async (filter: { _id: unknown }) => {
        const id = filter._id instanceof ObjectId ? filter._id.toString() : String(filter._id)
        if (id === USER_ID_HEX) return { email: 'buyer@example.com' }
        if (id === PRODUCT_ID_HEX) return { title: 'Title Fallback' }
        return null
      })

      const result = await sendPurchaseReceipt(buildOptions())

      expect(result).toEqual({ sent: true })
      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock.mock.calls[0]?.[0].html).toContain('Title Fallback')
    })
  })

  describe('capturedAt → payment date', () => {
    it('uses the caller-supplied capturedAt as the rendered payment date, not new Date()', async () => {
      // Pre-pandemic-ish, definitely not "today" — if the service is leaking
      // new Date() into the payment-date field this assertion will fail.
      const capturedAt = new Date('2025-08-15T10:00:00Z')

      // Force English locale via the userLocale override so the rendered date
      // string is predictable regardless of the user doc's locale.
      await sendPurchaseReceipt(buildOptions({ userLocale: 'en', capturedAt }))

      const html = sendMock.mock.calls[0]?.[0].html as string
      expect(html).toMatch(/August 15, 2025/)
    })
  })

  describe('happy path', () => {
    it('sends with right from/to/subject and passes idempotencyKey = transactionId', async () => {
      const result = await sendPurchaseReceipt(buildOptions())

      expect(result).toEqual({ sent: true })
      expect(sendMock).toHaveBeenCalledTimes(1)

      const [payload, sendOptions] = sendMock.mock.calls[0] ?? []
      const p = payload as { from: string; to: string; subject: string; html: string }
      expect(p.from).toBe('support@aguy.co.il')
      expect(p.to).toBe('buyer@example.com')
      expect(typeof p.subject).toBe('string')
      expect(p.html).toContain('Test Product')
      // Critical for review: Resend's server-side dedup needs the
      // idempotencyKey so two sends with the same key collapse to one mail.
      expect(sendOptions as { idempotencyKey?: string }).toEqual({ idempotencyKey: TX_ID_HEX })

      // No extra updateOne after success — the claim itself stamped emailSentAt.
      expect(updateOneMock).not.toHaveBeenCalled()
    })
  })

  describe('DB throw between claim and send', () => {
    // Without rollback on this path the claim would stay set, the webhook's
    // outer try/catch would return 500, PayPal would retry, and the retry's
    // status === 'succeeded' early-return would skip the receipt forever.
    // Symmetric with the Resend rollback below.
    it('rolls back the claim and re-throws when the user/product findOne rejects', async () => {
      const dbErr = new Error('mongo: primary unreachable')
      findOneMock.mockRejectedValueOnce(dbErr)

      await expect(sendPurchaseReceipt(buildOptions())).rejects.toBe(dbErr)

      expect(sendMock).not.toHaveBeenCalled()
      expect(updateOneMock).toHaveBeenCalledTimes(1)
      const [, update] = updateOneMock.mock.calls[0] ?? []
      expect((update as Record<string, unknown>).$unset).toEqual({ emailSentAt: '' })
    })
  })

  describe('failure rollback', () => {
    it('returns error and rolls back the claim when Resend resolves with an error payload', async () => {
      sendMock.mockResolvedValueOnce({
        data: null,
        error: { name: 'validation_error', message: 'Invalid to address' },
      })

      const result = await sendPurchaseReceipt(buildOptions())

      expect(result).toEqual({ sent: false, reason: 'error' })
      expect(updateOneMock).toHaveBeenCalledTimes(1)
      const [, update] = updateOneMock.mock.calls[0] ?? []
      expect((update as Record<string, unknown>).$unset).toEqual({ emailSentAt: '' })
    })

    it('returns error and rolls back the claim when the Resend SDK throws', async () => {
      sendMock.mockRejectedValueOnce(new Error('network timeout'))

      const result = await sendPurchaseReceipt(buildOptions())

      expect(result).toEqual({ sent: false, reason: 'error' })
      expect(updateOneMock).toHaveBeenCalledTimes(1)
      const [, update] = updateOneMock.mock.calls[0] ?? []
      expect((update as Record<string, unknown>).$unset).toEqual({ emailSentAt: '' })
    })
  })

  describe('coupon currency awareness', () => {
    it('renders a fixed-amount coupon in the transaction currency (₪ for ILS, NOT $)', async () => {
      await sendPurchaseReceipt(
        buildOptions({
          currency: 'ILS',
          appliedCoupon: {
            code: 'TENOFF',
            discountType: 'fixed',
            discountValue: 1000, // 10.00 of whatever currency
            originalAmount: 5000,
            discountedAmount: 4000,
          },
        }),
      )

      const html = sendMock.mock.calls[0]?.[0].html as string
      // Coupon line should show ₪10.00 (project is ILS-first); $10.00 would
      // be the old hardcoded-symbol bug.
      expect(html).toContain('₪10.00')
      expect(html).not.toContain('$10.00')
    })

    it('falls back to using the currency code as a prefix for unknown currencies', async () => {
      await sendPurchaseReceipt(
        buildOptions({
          currency: 'GBP',
          appliedCoupon: {
            code: 'GBPOFF',
            discountType: 'fixed',
            discountValue: 500,
            originalAmount: 5000,
            discountedAmount: 4500,
          },
        }),
      )

      const html = sendMock.mock.calls[0]?.[0].html as string
      expect(html).toContain('GBP5.00')
    })

    it('renders nothing instead of "₪NaN" when a corrupted coupon has a non-numeric discountValue', async () => {
      // Defense against DB corruption / manual edits / schema drift — without
      // the Number.isFinite guard, fixed/(discountValue/100).toFixed(2) would
      // emit "₪NaN" in the buyer's receipt.
      await sendPurchaseReceipt(
        buildOptions({
          appliedCoupon: {
            code: 'BAD_COUPON',
            discountType: 'fixed',
            discountValue: Number.NaN,
            originalAmount: 5000,
          },
        }),
      )

      const html = sendMock.mock.calls[0]?.[0].html as string
      expect(html).not.toContain('NaN')
      expect(html).not.toContain('₪NaN')
    })

    it('still works for percentage-discount coupons (no currency involved)', async () => {
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

      const html = sendMock.mock.calls[0]?.[0].html as string
      expect(html).toContain('WELCOME10')
      expect(html).toContain('10%')
    })
  })
})
