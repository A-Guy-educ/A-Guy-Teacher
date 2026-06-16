/**
 * Unit tests for POST /api/webhooks/paypal.
 *
 * The handler was a 410 stub until this PR. These tests pin the new contract:
 *   - bad JSON / bad signature → 400 (PayPal will NOT retry)
 *   - transient signature-verify failure → 500 (PayPal WILL retry)
 *   - CHECKOUT.ORDER.APPROVED → call capture, flip to succeeded with captureId
 *   - PAYMENT.CAPTURE.COMPLETED → flip to succeeded with the event's capture ID
 *   - already-succeeded transaction → no DB write (idempotency)
 *   - unknown order ID → 200 acknowledge, no DB write
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/payment/paypal', () => ({
  verifyPayPalWebhook: vi.fn(),
  capturePayPalOrder: vi.fn(),
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
      }),
    })),
  }
})

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createRequestLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

const ORDER_ID = 'PAYPAL_ORDER_123'
const CAPTURE_ID = 'PAYPAL_CAPTURE_456'
const TX_ID = '507f1f77bcf86cd799439011'

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

describe('POST /api/webhooks/paypal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('on CHECKOUT.ORDER.APPROVED: captures, then marks the transaction succeeded with the captureId', async () => {
    const { verifyPayPalWebhook, capturePayPalOrder } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(capturePayPalOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      captureId: CAPTURE_ID,
    })

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      providerTransactionId: ORDER_ID,
      status: 'pending',
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(200)
    expect(capturePayPalOrder).toHaveBeenCalledWith(ORDER_ID)
    expect(updateOneMock).toHaveBeenCalledTimes(1)
    const update = updateOneMock.mock.calls[0]?.[1]?.$set as Record<string, unknown>
    expect(update.status).toBe('succeeded')
    expect(update.captureId).toBe(CAPTURE_ID)
    expect(update.capturedAt).toBeInstanceOf(Date)
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
      providerTransactionId: ORDER_ID,
      status: 'pending',
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(200)
    const update = updateOneMock.mock.calls[0]?.[1]?.$set as Record<string, unknown>
    expect(update.status).toBe('succeeded')
    expect(update.captureId).toBeUndefined()
  })

  it('on PAYMENT.CAPTURE.COMPLETED: flips status to succeeded with the event capture ID', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      providerTransactionId: ORDER_ID,
      status: 'pending',
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(captureCompletedEvent()))

    expect(res.status).toBe(200)
    const update = updateOneMock.mock.calls[0]?.[1]?.$set as Record<string, unknown>
    expect(update.status).toBe('succeeded')
    expect(update.captureId).toBe(CAPTURE_ID)
  })

  it('is idempotent when CHECKOUT.ORDER.APPROVED arrives for a row already succeeded with a captureId', async () => {
    const { verifyPayPalWebhook, capturePayPalOrder } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      providerTransactionId: ORDER_ID,
      status: 'succeeded',
      captureId: CAPTURE_ID,
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent()))

    expect(res.status).toBe(200)
    expect(capturePayPalOrder).not.toHaveBeenCalled()
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('is idempotent when PAYMENT.CAPTURE.COMPLETED replays for the same capture ID', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce({
      _id: TX_ID,
      providerTransactionId: ORDER_ID,
      status: 'succeeded',
      captureId: CAPTURE_ID,
    })

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(captureCompletedEvent()))

    expect(res.status).toBe(200)
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('acknowledges (200) without DB writes when the order ID is unknown', async () => {
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    ;(verifyPayPalWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    findOneMock.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/webhooks/paypal/route')
    const res = await POST(buildRequest(orderApprovedEvent('UNKNOWN_ORDER')))

    expect(res.status).toBe(200)
    expect(updateOneMock).not.toHaveBeenCalled()
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
  })
})
