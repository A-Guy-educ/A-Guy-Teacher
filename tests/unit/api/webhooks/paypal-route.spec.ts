/**
 * Unit tests for POST /api/webhooks/paypal.
 *
 * The handler was a 410 stub until this PR. These tests pin the new contract:
 *   - bad JSON / bad signature → 400 (PayPal will NOT retry)
 *   - transient signature-verify failure → 500 (PayPal WILL retry)
 *   - CHECKOUT.ORDER.APPROVED → call capture, flip to succeeded with captureId
 *   - PAYMENT.CAPTURE.COMPLETED → flip to succeeded with the event's capture ID
 *   - already-settled transaction (succeeded + captureId + emailSentAt +
 *     entitlementsGrantedAt) → no DB write (idempotency)
 *   - unknown order ID → 200 acknowledge, no DB write
 *   - entitlement grant invoked after status flip with the userId/productId
 *     forwarded from the transaction row.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/payment/paypal', () => ({
  verifyPayPalWebhook: vi.fn(),
  capturePayPalOrder: vi.fn(),
}))

const grantEntitlementsMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/payment/grant-entitlements', () => ({
  grantProductEntitlements: grantEntitlementsMock,
}))

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
        insertOne: vi.fn().mockResolvedValue({ insertedId: 'fake' }),
      }),
    })),
  }
})

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createRequestLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

const sendReceiptMock = vi.fn().mockResolvedValue({ sent: true })
vi.mock('@/server/email/services/purchase-receipt-service', () => ({
  sendPurchaseReceipt: sendReceiptMock,
}))

const ORDER_ID = 'PAYPAL_ORDER_123'
const CAPTURE_ID = 'PAYPAL_CAPTURE_456'
const TX_ID = '507f1f77bcf86cd799439011'
const USER_ID = '507f191e810c19729de860ea'
const PRODUCT_ID = '507f191e810c19729de860eb'

function buildRequest(body: unknown, signed = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signed) {
    headers['paypal-transmission-id'] = 'tid'
    headers['paypal-transmission-time'] = '2026-06-15T10:00:00Z'
    headers['paypal-transmission-sig'] = 'sig'
    headers['paypal-cert-url'] = 'https://api.sandbox.paypal.com/cert'
    headers['paypal-auth-algo'] = 'SHA256withRSA'
  }
  return new NextRequest('https://www.aguy.co.il/api/webhooks/paypal', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function orderApprovedEvent(orderId: string = ORDER_ID) {
  return {
    id: 'EVT_ORDER_APPROVED_1',
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: { id: orderId },
  }
}

function captureCompletedEvent(captureId: string = CAPTURE_ID, orderId: string = ORDER_ID) {
  return {
    id: 'EVT_CAPTURE_COMPLETED_1',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: captureId,
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  }
}

function pendingTransaction() {
  return {
    _id: TX_ID,
    user: USER_ID,
    product: PRODUCT_ID,
    providerTransactionId: ORDER_ID,
    status: 'pending',
    amount: 4900,
    currency: 'ILS',
  }
}

function settledTransaction(overrides: Record<string, unknown> = {}) {
  return {
    _id: TX_ID,
    providerTransactionId: ORDER_ID,
    status: 'succeeded',
    captureId: CAPTURE_ID,
    emailSentAt: new Date('2026-06-15T10:00:00Z'),
    entitlementsGrantedAt: new Date('2026-06-15T10:00:01Z'),
    ...overrides,
  }
}

describe('POST /api/webhooks/paypal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grantEntitlementsMock.mockResolvedValue(undefined)
  })

  it('returns 400 for an invalid JSON body and never tries to verify', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    const { POST } = await import('@/app/api/webhooks/paypal/route')

    const res = await POST(
      new NextRequest('https://www.aguy.co.il/api/webhooks/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    )

    expect(res.status).toBe(400)
    expect(verifyPayPalWebhook).not.toHaveBeenCalled()
  })

  it('returns 400 when the signature is invalid (no retry from PayPal)', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(400)
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('returns 500 when the signature verifier throws a transient error (PayPal retries)', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network ECONNREFUSED'),
    )

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(500)
  })

  it('returns 400 when PayPal env is missing (PayPal will NOT retry — config bug)', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Missing required PayPal environment variables: PAYPAL_WEBHOOK_ID'),
    )

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(400)
  })

  it('on CHECKOUT.ORDER.APPROVED: captures, flips succeeded, grants entitlements, and triggers the receipt', async () => {
    const { verifyPayPalWebhook, capturePayPalOrder } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(capturePayPalOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      captureId: CAPTURE_ID,
    })

    findOneMock.mockResolvedValueOnce(pendingTransaction())

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(200)
    expect(capturePayPalOrder).toHaveBeenCalledWith(ORDER_ID)

    // First updateOne: status flip with captureId + capturedAt.
    const statusUpdate = updateOneMock.mock.calls[0]?.[1]?.$set as Record<string, unknown>
    expect(statusUpdate.status).toBe('succeeded')
    expect(statusUpdate.captureId).toBe(CAPTURE_ID)
    expect(statusUpdate.capturedAt).toBeInstanceOf(Date)

    // Entitlements: routed through the grant function with normalised IDs.
    expect(grantEntitlementsMock).toHaveBeenCalledTimes(1)
    expect(grantEntitlementsMock).toHaveBeenCalledWith(USER_ID, PRODUCT_ID, TX_ID)

    // Second updateOne: stamp entitlementsGrantedAt. verify by inspecting
    // any updateOne whose $set has the field, regardless of order.
    const stamped = updateOneMock.mock.calls
      .map((call) => (call?.[1]?.$set ?? {}) as Record<string, unknown>)
      .find((set) => 'entitlementsGrantedAt' in set)
    expect(stamped).toBeDefined()
    expect(stamped?.entitlementsGrantedAt).toBeInstanceOf(Date)

    // Receipt service is triggered after the status flip. The service is
    // mocked so we don't actually email anyone — just that the wiring is
    // in place and that user/product/amount/currency/capturedAt are forwarded.
    expect(sendReceiptMock).toHaveBeenCalledTimes(1)
    expect(sendReceiptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: TX_ID,
        userId: USER_ID,
        productId: PRODUCT_ID,
        providerTransactionId: ORDER_ID,
        amount: 4900,
        currency: 'ILS',
        capturedAt: statusUpdate.capturedAt,
      }),
    )
  })

  it('on CHECKOUT.ORDER.APPROVED for an already-captured order: still marks succeeded, omits captureId update', async () => {
    // capturePayPalOrder returns captureId: null when PayPal replies
    // ORDER_ALREADY_CAPTURED. We still flip to succeeded but don't overwrite
    // the captureId — PAYMENT.CAPTURE.COMPLETED is the authoritative source.
    const { verifyPayPalWebhook, capturePayPalOrder } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(capturePayPalOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      captureId: null,
    })

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      user: USER_ID,
      product: PRODUCT_ID,
      providerTransactionId: ORDER_ID,
      status: 'pending',
      amount: 4900,
      currency: 'ILS',
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(200)
    const statusUpdate = updateOneMock.mock.calls[0]?.[1]?.$set as Record<string, unknown>
    expect(statusUpdate.status).toBe('succeeded')
    expect(statusUpdate.captureId).toBeUndefined()
    // Still triggers entitlements on the first capture-success path.
    expect(grantEntitlementsMock).toHaveBeenCalledTimes(1)
  })

  it('on PAYMENT.CAPTURE.COMPLETED: flips status to succeeded, grants entitlements, and triggers the receipt', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    // Mirror the APPROVED test: include user/product/amount/currency so the
    // receipt-trigger wiring actually fires (the maybeSendReceipt guard
    // short-circuits silently if any of those are missing).
    findOneMock.mockResolvedValueOnce(pendingTransaction())

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(captureCompletedEvent()))

    expect(res.status).toBe(200)
    const statusUpdate = updateOneMock.mock.calls[0]?.[1]?.$set as Record<string, unknown>
    expect(statusUpdate.status).toBe('succeeded')
    expect(statusUpdate.captureId).toBe(CAPTURE_ID)

    expect(grantEntitlementsMock).toHaveBeenCalledTimes(1)
    expect(grantEntitlementsMock).toHaveBeenCalledWith(USER_ID, PRODUCT_ID, TX_ID)

    expect(sendReceiptMock).toHaveBeenCalledTimes(1)
    expect(sendReceiptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: TX_ID,
        userId: USER_ID,
        productId: PRODUCT_ID,
        providerTransactionId: ORDER_ID,
        amount: 4900,
        currency: 'ILS',
        capturedAt: statusUpdate.capturedAt,
      }),
    )
  })

  it('is idempotent when CHECKOUT.ORDER.APPROVED arrives for an already-settled row', async () => {
    // Fully-settled row: succeeded, captureId, emailSentAt, AND
    // entitlementsGrantedAt all set. All post-flip steps completed → no
    // re-entry, no DB writes.
    const { verifyPayPalWebhook, capturePayPalOrder } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce(settledTransaction())

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(200)
    expect(capturePayPalOrder).not.toHaveBeenCalled()
    expect(updateOneMock).not.toHaveBeenCalled()
    expect(sendReceiptMock).not.toHaveBeenCalled()
    expect(grantEntitlementsMock).not.toHaveBeenCalled()
  })

  it('is idempotent when PAYMENT.CAPTURE.COMPLETED replays for an already-settled row', async () => {
    findOneMock.mockResolvedValueOnce(settledTransaction())

    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(captureCompletedEvent()))

    expect(res.status).toBe(200)
    expect(updateOneMock).not.toHaveBeenCalled()
    expect(sendReceiptMock).not.toHaveBeenCalled()
    expect(grantEntitlementsMock).not.toHaveBeenCalled()
  })

  it('re-enters the grant path if entitlementsGrantedAt is missing (prior rollback or crash)', async () => {
    // If the entitlement grant threw mid-flight on a prior delivery, the row
    // is succeeded+receipt-sent but un-granted. The retry must re-enter the
    // grant path. status+captureId are no-op updates.
    const { verifyPayPalWebhook, capturePayPalOrder } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(capturePayPalOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      captureId: CAPTURE_ID,
    })

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      user: USER_ID,
      product: PRODUCT_ID,
      providerTransactionId: ORDER_ID,
      status: 'succeeded',
      captureId: CAPTURE_ID,
      emailSentAt: new Date('2026-06-15T10:00:00Z'),
      amount: 4900,
      currency: 'ILS',
      // entitlementsGrantedAt deliberately missing — prior attempt rolled back
      // or crashed before stamping the field.
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(200)
    expect(grantEntitlementsMock).toHaveBeenCalledTimes(1)
    expect(grantEntitlementsMock).toHaveBeenCalledWith(USER_ID, PRODUCT_ID, TX_ID)
  })

  it('acknowledges (200) without DB writes when the order ID is unknown', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent('UNKNOWN_ORDER')))

    expect(res.status).toBe(200)
    expect(updateOneMock).not.toHaveBeenCalled()
    expect(grantEntitlementsMock).not.toHaveBeenCalled()
  })

  it('on PAYMENT.CAPTURE.COMPLETED retry: re-enters the send path when emailSentAt is missing after a prior rollback', async () => {
    // Mirror of the CHECKOUT.ORDER.APPROVED retry test above: if the receipt
    // service rolled back its claim (DB blip during user/product lookup),
    // PayPal's retry should re-attempt the send.
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      user: USER_ID,
      product: PRODUCT_ID,
      providerTransactionId: ORDER_ID,
      status: 'succeeded',
      captureId: CAPTURE_ID,
      amount: 4900,
      currency: 'ILS',
      entitlementsGrantedAt: new Date('2026-06-15T10:00:01Z'),
      // NB: no emailSentAt — prior attempt rolled back.
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(captureCompletedEvent()))

    expect(res.status).toBe(200)
    expect(sendReceiptMock).toHaveBeenCalledTimes(1)
    // entitlementsGrantedAt already set → grant wrapper is a no-op.
    expect(grantEntitlementsMock).not.toHaveBeenCalled()
  })

  it('on PAYMENT.CAPTURE.COMPLETED: returns 500 when sendPurchaseReceipt returns error (PayPal retries)', async () => {
    // When sendPurchaseReceipt returns { sent: false, reason: 'error' } (Resend
    // result-level error), maybeSendReceipt throws so PayPal retries.
    // The sendReceiptMock is set to return error below.
    sendReceiptMock.mockResolvedValueOnce({ sent: false, reason: 'error' })

    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      user: USER_ID,
      product: PRODUCT_ID,
      providerTransactionId: ORDER_ID,
      status: 'succeeded',
      captureId: CAPTURE_ID,
      amount: 4900,
      currency: 'ILS',
      entitlementsGrantedAt: new Date('2026-06-15T10:00:01Z'),
      // emailSentAt missing — prior attempt's rollback means we can re-enter.
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(captureCompletedEvent()))

    expect(res.status).toBe(500)
    expect(sendReceiptMock).toHaveBeenCalledTimes(1)
  })

  it('on CHECKOUT.ORDER.APPROVED: returns 500 when grantProductEntitlements throws (PayPal retries)', async () => {
    // Transient grant failure must surface as 500 so PayPal retries and we
    // get another shot. The status flip already happened — the next delivery
    // will see status='succeeded', entitlementsGrantedAt unset, and re-enter
    // the grant path.
    const grantModule = await import('@/lib/payment/grant-entitlements')
    ;(
      grantModule.grantProductEntitlements as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('DB timeout'))

    const { verifyPayPalWebhook, capturePayPalOrder } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(capturePayPalOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      captureId: CAPTURE_ID,
    })

    findOneMock.mockResolvedValueOnce(pendingTransaction())

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(500)
    expect(grantModule.grantProductEntitlements).toHaveBeenCalledTimes(1)
  })

  it('acknowledges (200) for unhandled event types without DB writes', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(
      buildRequest({
        id: 'EVT_DUMMY',
        event_type: 'PAYMENT.SALE.DENIED',
        resource: { id: 'whatever' },
      }),
    )

    expect(res.status).toBe(200)
    expect(updateOneMock).not.toHaveBeenCalled()
    expect(grantEntitlementsMock).not.toHaveBeenCalled()
  })
})
