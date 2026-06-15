/**
 * Regression guard for /api/payments/checkout provider routing.
 *
 * The previous version of the route hard-rejected every `provider: 'paypal'`
 * request with HTTP 503 / `payment_provider_not_configured`, before any env
 * variable was consulted. That meant a PayPal-configured deployment was
 * unreachable. This test pins down the new behavior: each provider value
 * dispatches to its lib/payment helper, and a missing-env error from either
 * helper surfaces as the same 503 the UI already knows how to render.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/infra/web-api/mongo-payload', () => ({
  getWebUser: vi.fn(),
}))

const findOneMock = vi.fn()
const insertOneMock = vi.fn()
vi.mock('@/infra/db/content-db', () => ({
  getContentDb: vi.fn(async () => ({
    collection: () => ({
      findOne: findOneMock,
      insertOne: insertOneMock,
      find: () => ({ toArray: vi.fn(async () => []) }),
    }),
  })),
  relationId: (v: unknown) => (typeof v === 'string' ? v : null),
}))

vi.mock('@/lib/payment/paypal', () => ({
  createPayPalOrder: vi.fn(),
}))
vi.mock('@/lib/payment/stripe', () => ({
  createStripeCheckout: vi.fn(),
}))

const PRODUCT_ID = '507f1f77bcf86cd799439011'
const USER_ID = '507f191e810c19729de860ea'

function buildRequest(body: object) {
  return new NextRequest('https://www.aguy.co.il/api/payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/payments/checkout — provider routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findOneMock.mockResolvedValue({
      _id: PRODUCT_ID,
      name: 'Test Product',
      price: 49,
      currency: 'ILS',
      isActive: true,
      tenant: 'tenant_a',
      items: [],
    })
    insertOneMock.mockResolvedValue({ insertedId: 'tx_inserted_id' })
  })

  it('dispatches paypal provider to createPayPalOrder and returns its checkoutUrl', async () => {
    const { getWebUser } = await import('@/infra/web-api/mongo-payload')
    ;(getWebUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_ID })

    const { createPayPalOrder } = await import('@/lib/payment/paypal')
    ;(createPayPalOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      checkoutUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123',
      providerSessionId: 'ORDER123',
    })

    const { POST } = await import('@/app/api/payments/checkout/route')
    const res = await POST(buildRequest({ productId: PRODUCT_ID, provider: 'paypal' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.checkoutUrl).toBe('https://www.sandbox.paypal.com/checkoutnow?token=ORDER123')
    expect(createPayPalOrder).toHaveBeenCalledTimes(1)
    const arg = (createPayPalOrder as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      productId: string
      userId: string
      amount: number
      currency: string
      successUrl: string
    }
    expect(arg.productId).toBe(PRODUCT_ID)
    expect(arg.userId).toBe(USER_ID)
    expect(arg.amount).toBe(4900)
    expect(arg.currency).toBe('ILS')
    expect(arg.successUrl.endsWith('/checkout/success')).toBe(true)
    // PayPal's redirect appends its own ?token=... so the Stripe-only
    // {CHECKOUT_SESSION_ID} placeholder must NOT appear in the URL.
    expect(arg.successUrl).not.toContain('{CHECKOUT_SESSION_ID}')

    const { createStripeCheckout } = await import('@/lib/payment/stripe')
    expect(createStripeCheckout).not.toHaveBeenCalled()
  })

  it('surfaces a missing-PayPal-env error as 503 payment_provider_not_configured', async () => {
    const { getWebUser } = await import('@/infra/web-api/mongo-payload')
    ;(getWebUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_ID })

    const { createPayPalOrder } = await import('@/lib/payment/paypal')
    ;(createPayPalOrder as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Missing required PayPal environment variables: PAYPAL_CLIENT_ID'),
    )

    const { POST } = await import('@/app/api/payments/checkout/route')
    const res = await POST(buildRequest({ productId: PRODUCT_ID, provider: 'paypal' }))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe('payment_provider_not_configured')
  })

  it('surfaces a missing-Stripe-env error as 503 payment_provider_not_configured', async () => {
    const { getWebUser } = await import('@/infra/web-api/mongo-payload')
    ;(getWebUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_ID })

    const { createStripeCheckout } = await import('@/lib/payment/stripe')
    ;(createStripeCheckout as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Missing required Stripe environment variables: STRIPE_SECRET_KEY'),
    )

    const { POST } = await import('@/app/api/payments/checkout/route')
    const res = await POST(buildRequest({ productId: PRODUCT_ID, provider: 'stripe' }))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe('payment_provider_not_configured')
  })

  it('returns checkout_failed (500) on non-env errors from the provider helper', async () => {
    const { getWebUser } = await import('@/infra/web-api/mongo-payload')
    ;(getWebUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_ID })

    const { createPayPalOrder } = await import('@/lib/payment/paypal')
    ;(createPayPalOrder as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('PayPal order creation failed: 500'),
    )

    const { POST } = await import('@/app/api/payments/checkout/route')
    const res = await POST(buildRequest({ productId: PRODUCT_ID, provider: 'paypal' }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('checkout_failed')
  })

  it('rejects unauthenticated requests with 401', async () => {
    const { getWebUser } = await import('@/infra/web-api/mongo-payload')
    ;(getWebUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { POST } = await import('@/app/api/payments/checkout/route')
    const res = await POST(buildRequest({ productId: PRODUCT_ID, provider: 'paypal' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('authentication_required')
  })
})
