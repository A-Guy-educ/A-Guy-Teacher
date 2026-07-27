/**
 * Unit Tests for PayPal Payment Service
 *
 * Tests the PayPal payment provider functions:
 * - createPayPalOrder: creates a PayPal order
 * - verifyPayPalWebhook: verifies webhook signatures
 * - refundPayPal: processes refunds
 */
import { ObjectId } from 'mongodb'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resetPaymentEnvCache } from '@/lib/payment/env'

// Mock content-db so the subscription-plan helper's persistence call doesn't
// need a real Mongo — we only care that fetch is invoked the expected number
// of times, not that the update actually round-trips.
const mockUpdateOne = vi.fn(async () => ({ acknowledged: true, modifiedCount: 1 }))
vi.mock('@/infra/db/content-db', () => ({
  getContentDb: vi.fn(async () => ({
    collection: () => ({ updateOne: mockUpdateOne }),
  })),
}))

// Store original fetch
const originalFetch = globalThis.fetch

describe('PayPal Payment Service', () => {
  const mockOptions = {
    productId: 'prod_123',
    productName: 'Test Product',
    amount: 1000,
    currency: 'ILS' as const,
    userId: 'user_456',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    provider: 'paypal' as const,
  }

  const mockTokenResponse = {
    access_token: 'test_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
  }

  const mockOrderResponse = {
    id: 'ORDER123',
    status: 'CREATED',
    links: [
      { href: 'https://paypal.com/approve', rel: 'approve' },
      { href: 'https://paypal.com/capture', rel: 'capture' },
    ],
  }

  beforeEach(() => {
    // Reset modules to clear token cache
    vi.resetModules()
    // Reset env cache
    resetPaymentEnvCache()
    // Set all required payment env vars
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_xxx'
    process.env.PAYPAL_WEBHOOK_ID = 'webhook_test_xxx'
  })

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch
    // Reset modules after each test to ensure clean state
    vi.resetModules()
  })

  describe('createPayPalOrder', () => {
    it('should throw error when PAYPAL_CLIENT_ID is missing', async () => {
      delete process.env.PAYPAL_CLIENT_ID
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      const { createPayPalOrder } = await import('@/lib/payment/paypal')

      await expect(createPayPalOrder(mockOptions)).rejects.toThrow(
        'Missing required PayPal environment variables: PAYPAL_CLIENT_ID',
      )
    })

    it('should throw error when PAYPAL_CLIENT_SECRET is missing', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      delete process.env.PAYPAL_CLIENT_SECRET
      resetPaymentEnvCache()

      const { createPayPalOrder } = await import('@/lib/payment/paypal')

      await expect(createPayPalOrder(mockOptions)).rejects.toThrow(
        'Missing required PayPal environment variables: PAYPAL_CLIENT_SECRET',
      )
    })

    it('should fetch token then create order', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let tokenCalled = false
      let orderCalled = false

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          tokenCalled = true
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          orderCalled = true
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')
      const result = await createPayPalOrder(mockOptions)

      expect(tokenCalled).toBe(true)
      expect(orderCalled).toBe(true)
      expect(result.providerSessionId).toBe('ORDER123')
    })

    it('should cache token on first call', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let tokenCallCount = 0

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          tokenCallCount++
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')

      await createPayPalOrder(mockOptions)
      await createPayPalOrder(mockOptions)

      // Token should only be fetched once due to caching
      expect(tokenCallCount).toBe(1)
    })

    it('should return checkoutUrl and providerSessionId', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      process.env.PAYPAL_WEBHOOK_ID = 'webhook_id_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')
      const result = await createPayPalOrder(mockOptions)

      expect(result.checkoutUrl).toBe('https://paypal.com/approve')
      expect(result.providerSessionId).toBe('ORDER123')
    })

    it('should use production API URL when PAYPAL_SANDBOX=false', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      process.env.PAYPAL_WEBHOOK_ID = 'webhook_id_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      process.env.PAYPAL_SANDBOX = 'false'
      resetPaymentEnvCache()

      const capturedUrls: string[] = []

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url)
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder, resetPayPalTokenCache } = await import('@/lib/payment/paypal')
      resetPayPalTokenCache()
      await createPayPalOrder(mockOptions)

      // Verify production URL is used when PAYPAL_SANDBOX=false
      // First URL should be token, second should be checkout
      expect(capturedUrls[0]).toMatch(/^https:\/\/api-m\.paypal\.com\/v1\/oauth2\/token$/)
      expect(capturedUrls[1]).toMatch(/^https:\/\/api-m\.paypal\.com\/v2\/checkout\/orders$/)
    })

    it('should use sandbox API URL when PAYPAL_SANDBOX=true', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      process.env.PAYPAL_WEBHOOK_ID = 'webhook_id_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      process.env.PAYPAL_SANDBOX = 'true'
      resetPaymentEnvCache()

      const capturedUrls: string[] = []

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url)
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder, resetPayPalTokenCache } = await import('@/lib/payment/paypal')
      resetPayPalTokenCache()
      await createPayPalOrder(mockOptions)

      // Verify sandbox URL is used when PAYPAL_SANDBOX=true
      // First URL should be token, second should be checkout
      expect(capturedUrls[0]).toMatch(/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/oauth2\/token$/)
      expect(capturedUrls[1]).toMatch(
        /^https:\/\/api-m\.sandbox\.paypal\.com\/v2\/checkout\/orders$/,
      )
    })

    it('should convert amount from smallest unit', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let capturedBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')
      await createPayPalOrder({ ...mockOptions, amount: 1000 }) // 10.00 in smallest unit

      expect(capturedBody).toBeDefined()
      const body = JSON.parse(capturedBody!)
      expect(body.purchase_units[0].amount.value).toBe('10.00')
    })
  })

  describe('verifyPayPalWebhook', () => {
    const mockHeaders = {
      'paypal-transmission-id': 'trans_id',
      'paypal-transmission-time': '2024-01-01T00:00:00Z',
      'paypal-cert-url': 'https://api.paypal.com/cert',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'test_signature',
    }

    it('should throw error when PAYPAL_WEBHOOK_ID is missing', async () => {
      delete process.env.PAYPAL_WEBHOOK_ID
      resetPaymentEnvCache()
      vi.resetModules()

      const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')

      await expect(verifyPayPalWebhook({ type: 'test' }, mockHeaders)).rejects.toThrow(
        'Missing required PayPal environment variables: PAYPAL_WEBHOOK_ID',
      )
    })

    it('should throw error with missing headers', async () => {
      process.env.PAYPAL_WEBHOOK_ID = 'webhook_id'
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      const incompleteHeaders = {
        'paypal-transmission-id': 'trans_id',
        // Missing other required headers
      }

      const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')

      await expect(verifyPayPalWebhook({ type: 'test' }, incompleteHeaders)).rejects.toThrow(
        'Missing required PayPal webhook headers',
      )
    })

    it('should return true on SUCCESS verification', async () => {
      process.env.PAYPAL_WEBHOOK_ID = 'webhook_id'
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/notifications/verify-webhook-signature')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ verification_status: 'SUCCESS' }),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
      const result = await verifyPayPalWebhook({ type: 'test' }, mockHeaders)

      expect(result).toBe(true)
    })
  })

  describe('refundPayPal', () => {
    it('should POST to capture refund endpoint', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      let capturedUrl: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/payments/captures/')) {
          capturedUrl = url
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { refundPayPal } = await import('@/lib/payment/paypal')
      await refundPayPal('CAPTURE123')

      expect(capturedUrl).toContain('/v2/payments/captures/CAPTURE123/refund')
    })

    it('should include amount when provided', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      let capturedBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/payments/captures/')) {
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { refundPayPal } = await import('@/lib/payment/paypal')
      await refundPayPal('CAPTURE123', 500)

      expect(capturedBody).toBeDefined()
      const body = JSON.parse(capturedBody!)
      expect(body.amount).toBeDefined()
      expect(body.amount.value).toBe('5.00')
    })

    it('should use ILS currency when specified', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      let capturedBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/payments/captures/')) {
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { refundPayPal } = await import('@/lib/payment/paypal')
      await refundPayPal('CAPTURE123', 500, 'ILS')

      expect(capturedBody).toBeDefined()
      const body = JSON.parse(capturedBody!)
      expect(body.amount).toBeDefined()
      expect(body.amount.currency_code).toBe('ILS')
    })
  })

  describe('ensurePayPalSubscriptionPlan', () => {
    const mockProductDoc = {
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      name: 'Premium Plan',
      price: 29.9,
      currency: 'ILS',
      interval: 'month' as const,
    }

    it('should skip PayPal when product already has both IDs (cached path)', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      const fetchMock = vi.fn()
      globalThis.fetch = fetchMock as unknown as typeof fetch
      mockUpdateOne.mockClear()

      const { ensurePayPalSubscriptionPlan } = await import('@/lib/payment/paypal')
      const result = await ensurePayPalSubscriptionPlan({
        ...mockProductDoc,
        paypalProductId: 'PROD-CACHED',
        paypalPlanId: 'P-CACHED',
      })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(result).toEqual({ paypalProductId: 'PROD-CACHED', paypalPlanId: 'P-CACHED' })
    })

    it('should create catalog product then billing plan and persist IDs', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      mockUpdateOne.mockClear()

      let catalogCalled = false
      let planCalled = false
      let capturedPlanBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/catalogs/products')) {
          catalogCalled = true
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'PROD-NEW-123' }),
          }) as unknown as Response
        }
        if (url.includes('/v1/billing/plans')) {
          planCalled = true
          capturedPlanBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'P-NEW-456' }),
          }) as unknown as Response
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { ensurePayPalSubscriptionPlan, resetPayPalTokenCache } =
        await import('@/lib/payment/paypal')
      resetPayPalTokenCache()

      const result = await ensurePayPalSubscriptionPlan(mockProductDoc)

      expect(catalogCalled).toBe(true)
      expect(planCalled).toBe(true)
      expect(result).toEqual({ paypalProductId: 'PROD-NEW-123', paypalPlanId: 'P-NEW-456' })

      const planBody = JSON.parse(capturedPlanBody!)
      expect(planBody.product_id).toBe('PROD-NEW-123')
      expect(planBody.billing_cycles[0].frequency.interval_unit).toBe('MONTH')
      expect(planBody.billing_cycles[0].pricing_scheme.fixed_price.value).toBe('29.90')
      expect(planBody.billing_cycles[0].pricing_scheme.fixed_price.currency_code).toBe('ILS')
      expect(planBody.billing_cycles[0].total_cycles).toBe(0)
      expect(planBody.payment_preferences.auto_bill_outstanding).toBe(true)

      // Verifies the lazy-cache write-back onto the local product doc.
      expect(mockUpdateOne).toHaveBeenCalledTimes(1)
      const [filter, update] = mockUpdateOne.mock.calls[0] as [
        { _id: ObjectId },
        { $set: { paypalProductId: string; paypalPlanId: string } },
      ]
      expect(filter._id.toString()).toBe(mockProductDoc._id.toString())
      expect(update.$set.paypalProductId).toBe('PROD-NEW-123')
      expect(update.$set.paypalPlanId).toBe('P-NEW-456')
    })

    it('should send YEAR interval when product.interval is "year"', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      let capturedPlanBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/catalogs/products')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'PROD-Y' }),
          }) as unknown as Response
        }
        if (url.includes('/v1/billing/plans')) {
          capturedPlanBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'P-Y' }),
          }) as unknown as Response
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { ensurePayPalSubscriptionPlan, resetPayPalTokenCache } =
        await import('@/lib/payment/paypal')
      resetPayPalTokenCache()

      await ensurePayPalSubscriptionPlan({ ...mockProductDoc, interval: 'year' })

      const planBody = JSON.parse(capturedPlanBody!)
      expect(planBody.billing_cycles[0].frequency.interval_unit).toBe('YEAR')
    })
  })

  describe('createPayPalSubscription', () => {
    it('should POST to subscriptions endpoint and return approvalUrl + subscriptionId', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      let capturedUrl: string | undefined
      let capturedBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/billing/subscriptions')) {
          capturedUrl = url
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'I-SUB-123',
                status: 'APPROVAL_PENDING',
                links: [
                  { href: 'https://paypal.com/approve-sub', rel: 'approve' },
                  { href: 'https://paypal.com/self', rel: 'self' },
                ],
              }),
          }) as unknown as Response
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { createPayPalSubscription, resetPayPalTokenCache } =
        await import('@/lib/payment/paypal')
      resetPayPalTokenCache()

      const result = await createPayPalSubscription({
        planId: 'P-PLAN-1',
        productId: 'prod_local_123',
        userId: 'user_456',
        returnUrl: 'https://example.com/checkout/success',
        cancelUrl: 'https://example.com/checkout/cancel',
      })

      expect(capturedUrl).toContain('/v1/billing/subscriptions')
      expect(result.subscriptionId).toBe('I-SUB-123')
      expect(result.approvalUrl).toBe('https://paypal.com/approve-sub')

      const body = JSON.parse(capturedBody!)
      expect(body.plan_id).toBe('P-PLAN-1')
      expect(body.custom_id).toBe('user_456')
      expect(body.application_context.return_url).toBe('https://example.com/checkout/success')
      expect(body.application_context.cancel_url).toBe('https://example.com/checkout/cancel')
      expect(body.application_context.user_action).toBe('SUBSCRIBE_NOW')
    })
  })

  describe('cancelPayPalSubscription', () => {
    it('should POST to the cancel endpoint on happy path', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      let capturedUrl: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/billing/subscriptions/') && url.endsWith('/cancel')) {
          capturedUrl = url
          // PayPal returns 204 No Content on success.
          return Promise.resolve({ ok: true, status: 204 }) as unknown as Response
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { cancelPayPalSubscription, resetPayPalTokenCache } =
        await import('@/lib/payment/paypal')
      resetPayPalTokenCache()

      await expect(cancelPayPalSubscription('I-ALREADY-ACTIVE')).resolves.toBeUndefined()
      expect(capturedUrl).toContain('/v1/billing/subscriptions/I-ALREADY-ACTIVE/cancel')
    })

    it('should treat 422 SUBSCRIPTION_STATUS_INVALID as a no-op (idempotent)', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/billing/subscriptions/') && url.endsWith('/cancel')) {
          return Promise.resolve({
            ok: false,
            status: 422,
            text: () =>
              Promise.resolve(
                '{"name":"UNPROCESSABLE_ENTITY","details":[{"issue":"SUBSCRIPTION_STATUS_INVALID"}]}',
              ),
          }) as unknown as Response
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { cancelPayPalSubscription, resetPayPalTokenCache } =
        await import('@/lib/payment/paypal')
      resetPayPalTokenCache()

      await expect(cancelPayPalSubscription('I-ALREADY-CANCELLED')).resolves.toBeUndefined()
    })

    it('should throw on non-idempotent errors', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
      resetPaymentEnvCache()

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/billing/subscriptions/') && url.endsWith('/cancel')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: () => Promise.resolve('{"name":"RESOURCE_NOT_FOUND"}'),
          }) as unknown as Response
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { cancelPayPalSubscription, resetPayPalTokenCache } =
        await import('@/lib/payment/paypal')
      resetPayPalTokenCache()

      await expect(cancelPayPalSubscription('I-DOES-NOT-EXIST')).rejects.toThrow(
        /PayPal subscription cancel failed: 404/,
      )
    })
  })
})
