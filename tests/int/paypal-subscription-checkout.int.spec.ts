// @vitest-environment node
/**
 * Integration tests: PayPal Subscription Checkout
 *
 * Verifies the /api/payments/checkout route's subscription branch:
 * - happy path creates local Subscription + Transaction with correct wiring
 * - Stripe subscriptions are rejected (out of scope for v1)
 * - coupons on subscriptions are rejected
 * - products missing `interval` are rejected
 * - cached plan IDs on the product doc skip the PayPal plan/catalog round-trips
 * - a post-provider insert failure triggers cancelPayPalSubscription for recovery
 *
 * @fileType integration-test
 * @domain payments
 * @pattern paypal-subscriptions
 * @ai-summary Tests subscription checkout branching and recovery behavior
 *
 * Seeds Mongo directly rather than using Payload (payload dep is not installed
 * in this repo's active test env — see how paypal-concurrent-webhook-race
 * takes the same approach).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Collection, ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getContentDb } from '@/infra/db/content-db'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Track calls into the PayPal subscription helpers so tests can assert wiring.
const createPayPalSubscriptionMock = vi.fn(async (opts: any) => ({
  approvalUrl: `https://paypal.example.com/approve-sub?plan=${opts.planId}`,
  subscriptionId: `I-TEST-SUB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
}))
const cancelPayPalSubscriptionMock = vi.fn(async () => {})

// Track raw PayPal HTTP calls made from the real ensurePayPalSubscriptionPlan
// helper. The cached-plan test asserts these are NOT hit on the second call.
const paypalFetchCalls: string[] = []
let originalFetch: typeof fetch

vi.mock('@/lib/payment/paypal', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('@/lib/payment/paypal')
  return {
    ...actual,
    // Real ensurePayPalSubscriptionPlan (exercises the cache short-circuit).
    ensurePayPalSubscriptionPlan: actual.ensurePayPalSubscriptionPlan,
    createPayPalSubscription: createPayPalSubscriptionMock,
    cancelPayPalSubscription: cancelPayPalSubscriptionMock,
    // Keep one-time helpers stubbed so unrelated code paths don't touch PayPal.
    createPayPalOrder: vi.fn(async () => ({
      checkoutUrl: 'https://paypal.example.com/checkout/test-order',
      providerSessionId: 'paypal_test_order_123',
    })),
    cancelPayPalOrder: vi.fn(async () => {}),
  }
})

// Stub Stripe fully — subscription route errors out before touching it, but the
// route file imports it at top level.
vi.mock('@/lib/payment/stripe', () => ({
  createStripeCheckout: vi.fn(async () => ({
    checkoutUrl: 'https://stripe.example.com/checkout/test-session',
    providerSessionId: 'stripe_test_session_123',
  })),
  cancelStripeCheckout: vi.fn(async () => ({})),
}))

// Bypass real auth — the route only reads `id` off the resolved user.
let mockUserId: ObjectId
vi.mock('@/infra/web-api/mongo-payload', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('@/infra/web-api/mongo-payload')
  return {
    ...actual,
    getWebUser: vi.fn(async () => ({ id: mockUserId.toString() })),
  }
})

// ─── Setup ──────────────────────────────────────────────────────────────────

let mongoUri: string | undefined
let originalDatabaseUrl: string | undefined
let tenantId: ObjectId
const createdProductIds: ObjectId[] = []

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  // Set fake PayPal creds so getPayPalEnv() doesn't throw when the real
  // ensurePayPalSubscriptionPlan helper actually runs.
  process.env.PAYPAL_CLIENT_ID = 'test_client_id'
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret'
  process.env.PAYPAL_WEBHOOK_ID = 'test_webhook'

  const db = await getContentDb()

  tenantId = new ObjectId()
  await db.collection('tenants').insertOne({ _id: tenantId } as any)

  mockUserId = new ObjectId()
  await db.collection('users').insertOne({ _id: mockUserId, tenant: tenantId } as any)

  originalFetch = globalThis.fetch
}, 120_000)

beforeEach(() => {
  createPayPalSubscriptionMock.mockClear()
  cancelPayPalSubscriptionMock.mockClear()
  paypalFetchCalls.length = 0

  globalThis.fetch = vi.fn(async (url: string | URL | Request, ...rest: unknown[]) => {
    const urlString = typeof url === 'string' ? url : url.toString()

    if (urlString.includes('/v1/oauth2/token')) {
      paypalFetchCalls.push(urlString)
      return new Response(
        JSON.stringify({
          access_token: 'fake_token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200 },
      )
    }
    if (urlString.includes('/v1/catalogs/products')) {
      paypalFetchCalls.push(urlString)
      return new Response(JSON.stringify({ id: 'PROD-FAKE-123' }), { status: 200 })
    }
    if (urlString.includes('/v1/billing/plans') && !urlString.includes('/subscriptions')) {
      paypalFetchCalls.push(urlString)
      return new Response(JSON.stringify({ id: 'P-FAKE-456' }), { status: 200 })
    }

    return originalFetch(url as any, ...(rest as [any]))
  }) as unknown as typeof fetch
})

afterEach(async () => {
  const db = await getContentDb()
  await db.collection('transactions').deleteMany({ user: mockUserId })
  await db.collection('subscriptions').deleteMany({ user: mockUserId })
})

afterAll(async () => {
  globalThis.fetch = originalFetch

  if (mongoUri) {
    const db = await getContentDb()
    await db.collection('products').deleteMany({ _id: { $in: createdProductIds } })
    await db.collection('users').deleteMany({ _id: mockUserId })
    await db.collection('tenants').deleteMany({ _id: tenantId })
  }
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

// ─── Helpers ────────────────────────────────────────────────────────────────

async function seedSubscriptionProduct(overrides: Record<string, unknown> = {}): Promise<ObjectId> {
  const db = await getContentDb()
  const productId = new ObjectId()
  await db.collection('products').insertOne({
    _id: productId,
    tenant: tenantId,
    name: `Sub Product ${Date.now()}`,
    slug: `sub-product-${Date.now()}-${productId.toString()}`,
    billingType: 'subscription',
    interval: 'month',
    price: 29.9,
    currency: 'ILS',
    isActive: true,
    ...overrides,
  } as any)
  createdProductIds.push(productId)
  return productId
}

async function callCheckoutEndpoint(
  productId: ObjectId,
  { provider = 'paypal', couponCode }: { provider?: 'stripe' | 'paypal'; couponCode?: string } = {},
): Promise<{ status: number; data: any }> {
  const { POST } = await import('@/app/api/payments/checkout/route')

  const headers = new Headers()
  headers.set('Content-Type', 'application/json')

  const mockRequest = new NextRequest('http://localhost:3000/api/payments/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId: productId.toString(),
      provider,
      ...(couponCode ? { couponCode } : {}),
    }),
  })

  const response = await POST(mockRequest)
  const data = await response.json()
  return { status: response.status, data }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PayPal Subscription Checkout', () => {
  it('should create a Subscription + initial Transaction with linkage on happy path', async () => {
    const productId = await seedSubscriptionProduct()

    const result = await callCheckoutEndpoint(productId)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.checkoutUrl).toContain('https://paypal.example.com/approve-sub')
    expect(result.data.transactionId).toBeDefined()
    expect(result.data.subscriptionId).toBeDefined()

    expect(createPayPalSubscriptionMock).toHaveBeenCalledTimes(1)
    expect(createPayPalSubscriptionMock.mock.calls[0]![0].planId).toBe('P-FAKE-456')

    // Verify DB rows: transaction first, sub with initialTransaction populated,
    // transaction backfilled with subscription pointer.
    const db = await getContentDb()
    const transaction = await db
      .collection('transactions')
      .findOne({ _id: new ObjectId(result.data.transactionId as string) })
    expect(transaction).toBeTruthy()
    expect(transaction!.provider).toBe('paypal')
    expect(transaction!.status).toBe('pending')
    expect(transaction!.isRenewal).toBe(false)
    expect(transaction!.subscription?.toString()).toBe(result.data.subscriptionId)

    const subscription = await db
      .collection('subscriptions')
      .findOne({ _id: new ObjectId(result.data.subscriptionId as string) })
    expect(subscription).toBeTruthy()
    expect(subscription!.provider).toBe('paypal')
    expect(subscription!.status).toBe('pending')
    expect(subscription!.initialTransaction?.toString()).toBe(result.data.transactionId)
    expect(subscription!.paypalSubscriptionId).toBe(transaction!.providerTransactionId)
  })

  it('should reject Stripe subscriptions with 400 stripe_subscriptions_not_supported', async () => {
    const productId = await seedSubscriptionProduct()

    const result = await callCheckoutEndpoint(productId, { provider: 'stripe' })

    expect(result.status).toBe(400)
    expect(result.data.error).toBe('stripe_subscriptions_not_supported')
    expect(createPayPalSubscriptionMock).not.toHaveBeenCalled()
  })

  it('should reject coupons on subscriptions with 400 coupons_not_supported_on_subscriptions', async () => {
    const productId = await seedSubscriptionProduct()

    const result = await callCheckoutEndpoint(productId, { couponCode: 'ANYCODE' })

    expect(result.status).toBe(400)
    expect(result.data.error).toBe('coupons_not_supported_on_subscriptions')
    expect(createPayPalSubscriptionMock).not.toHaveBeenCalled()
  })

  it('should reject subscription products missing interval with 400 product_missing_interval', async () => {
    // Seed with interval explicitly set to null so the falsy check fires.
    const productId = await seedSubscriptionProduct({ interval: null })

    const result = await callCheckoutEndpoint(productId)

    expect(result.status).toBe(400)
    expect(result.data.error).toBe('product_missing_interval')
    expect(createPayPalSubscriptionMock).not.toHaveBeenCalled()
  })

  it('should skip PayPal catalog/plan endpoints on 2nd checkout for the same product (cached plan)', async () => {
    const productId = await seedSubscriptionProduct()

    // 1st checkout — populates paypalProductId + paypalPlanId on the product.
    const first = await callCheckoutEndpoint(productId)
    expect(first.status).toBe(200)

    const firstCallHitCatalog = paypalFetchCalls.some((u) => u.includes('/v1/catalogs/products'))
    const firstCallHitPlans = paypalFetchCalls.some(
      (u) => u.includes('/v1/billing/plans') && !u.includes('/subscriptions'),
    )
    expect(firstCallHitCatalog).toBe(true)
    expect(firstCallHitPlans).toBe(true)

    // Reset the fetch call log for the 2nd checkout — cached IDs should skip
    // both the catalog and billing-plan round-trips entirely.
    paypalFetchCalls.length = 0

    const second = await callCheckoutEndpoint(productId)
    expect(second.status).toBe(200)

    const secondCallHitCatalog = paypalFetchCalls.some((u) => u.includes('/v1/catalogs/products'))
    const secondCallHitPlans = paypalFetchCalls.some(
      (u) => u.includes('/v1/billing/plans') && !u.includes('/subscriptions'),
    )
    expect(secondCallHitCatalog).toBe(false)
    expect(secondCallHitPlans).toBe(false)
  })

  it('should call cancelPayPalSubscription when the post-provider insert fails', async () => {
    const productId = await seedSubscriptionProduct()

    // Force the FIRST insertOne call to fail. In the subscription checkout
    // path, the first insertOne is against the `transactions` collection.
    // Spying at the prototype level catches the route's fresh Collection
    // instance (mongo driver returns a new wrapper each db.collection() call).
    const insertSpy = vi
      .spyOn(Collection.prototype, 'insertOne')
      .mockRejectedValueOnce(new Error('simulated DB failure'))

    try {
      const result = await callCheckoutEndpoint(productId)

      expect(result.status).toBe(500)
      expect(result.data.error).toBe('checkout_failed')
      expect(cancelPayPalSubscriptionMock).toHaveBeenCalledTimes(1)
    } finally {
      insertSpy.mockRestore()
    }
  })
})
