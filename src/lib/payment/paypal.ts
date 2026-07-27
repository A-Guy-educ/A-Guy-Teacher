/**
 * PayPal Payment Service
 *
 * Provides order creation, webhook verification, and refund operations.
 * Uses getPayPalEnv() for environment variable access.
 */

import { ObjectId } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'
import { getPayPalEnv } from './env'
import type {
  CheckoutResult,
  CreateCheckoutOptions,
  CreateSubscriptionOptions,
  EnsuredPayPalPlan,
  SubscriptionResult,
} from './types'

const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com'
const PAYPAL_PRODUCTION_BASE = 'https://api-m.paypal.com'

function getPayPalApiBase(): string {
  const { paypalSandbox } = getPayPalEnv()
  return paypalSandbox ? PAYPAL_SANDBOX_BASE : PAYPAL_PRODUCTION_BASE
}

interface PayPalTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface PayPalOrderResponse {
  id: string
  status: string
  links: Array<{ href: string; rel: string }>
}

// Lazy-loaded token cache
let _cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Reset the token cache (useful for testing)
 */
export function resetPayPalTokenCache(): void {
  _cachedToken = null
}

/**
 * Get or refresh PayPal access token
 */
async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now()

  // Return cached token if still valid (with 60s buffer)
  if (_cachedToken && _cachedToken.expiresAt > now + 60_000) {
    return _cachedToken.token
  }

  const { paypalClientId, paypalClientSecret } = getPayPalEnv()

  const credentials = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64')

  const response = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal token request failed: ${response.status} ${error}`)
  }

  const data = (await response.json()) as PayPalTokenResponse
  _cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }

  return _cachedToken.token
}

/**
 * Create a PayPal order
 */
export async function createPayPalOrder(options: CreateCheckoutOptions): Promise<CheckoutResult> {
  const { productId, productName, amount, currency, userId, successUrl, cancelUrl } = options
  const token = await getPayPalAccessToken()

  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `${userId}-${productId}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: productId,
          description: productName,
          amount: {
            currency_code: currency,
            value: (amount / 100).toFixed(2), // Convert from smallest unit
          },
          custom_id: userId,
        },
      ],
      application_context: {
        return_url: successUrl,
        cancel_url: cancelUrl,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal order creation failed: ${response.status} ${error}`)
  }

  const order = (await response.json()) as PayPalOrderResponse

  // Find approval URL
  const approvalLink = order.links.find((link) => link.rel === 'approve')
  if (!approvalLink) {
    throw new Error('PayPal order missing approval URL')
  }

  return { checkoutUrl: approvalLink.href, providerSessionId: order.id }
}

/**
 * Verify a PayPal webhook signature
 * Uses PayPal's verify-webhook-signature API
 */
export async function verifyPayPalWebhook(body: object, headers: object): Promise<boolean> {
  const { paypalWebhookId } = getPayPalEnv()
  if (!paypalWebhookId) {
    throw new Error('Missing PAYPAL_WEBHOOK_ID environment variable')
  }

  // Extract required headers first (fail fast)
  const transmissionId = (headers as Record<string, string>)['paypal-transmission-id']
  const transmissionTime = (headers as Record<string, string>)['paypal-transmission-time']
  const certUrl = (headers as Record<string, string>)['paypal-cert-url']
  const authAlgo = (headers as Record<string, string>)['paypal-auth-algo']
  const transmissionSig = (headers as Record<string, string>)['paypal-transmission-sig']

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error('Missing required PayPal webhook headers')
  }

  const token = await getPayPalAccessToken()

  const response = await fetch(`${getPayPalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: paypalWebhookId,
      webhook_event: body,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal webhook verification failed: ${response.status} ${error}`)
  }

  const result = (await response.json()) as { verification_status: string }
  return result.verification_status === 'SUCCESS'
}

interface PayPalCaptureResponse {
  id: string
  status: string
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>
    }
  }>
}

/**
 * Capture funds for an approved PayPal order. Returns `{ captureId }` so the
 * webhook handler / success page can persist it on the transaction row for
 * later refunds.
 *
 * Required step in the PayPal v2 flow: an order created with intent: 'CAPTURE'
 * is NOT auto-captured on buyer approval — the merchant must explicitly POST
 * to /v2/checkout/orders/{id}/capture, which actually moves money and triggers
 * the PAYMENT.CAPTURE.COMPLETED webhook our handler relies on.
 *
 * Idempotent: PayPal returns 422 ORDER_ALREADY_CAPTURED if the order has
 * already been captured (e.g. user reloads /checkout/success). We treat that
 * as a successful no-op and return `{ captureId: null }` so callers can
 * decide whether they need a captureId or are happy without one.
 */
export async function capturePayPalOrder(orderId: string): Promise<{ captureId: string | null }> {
  const token = await getPayPalAccessToken()

  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${orderId}`,
    },
  })

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as PayPalCaptureResponse | null
    const captureId = body?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null
    return { captureId }
  }

  const errorText = await response.text()

  // Already-captured is a benign reload scenario — don't throw. We don't have
  // the captureId here because PayPal doesn't return it in the 422 body.
  if (response.status === 422 && /ORDER_ALREADY_CAPTURED/.test(errorText)) {
    return { captureId: null }
  }

  throw new Error(`PayPal order capture failed: ${response.status} ${errorText}`)
}

/**
 * Refund a PayPal capture
 */
export async function refundPayPal(
  providerTransactionId: string,
  amount?: number,
  currency: string = 'USD',
): Promise<void> {
  const token = await getPayPalAccessToken()

  const refundBody: Record<string, unknown> = {}
  if (amount !== undefined) {
    refundBody.amount = {
      value: (amount / 100).toFixed(2),
      currency_code: currency,
    }
  }

  const response = await fetch(
    `${getPayPalApiBase()}/v2/payments/captures/${providerTransactionId}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(refundBody),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal refund failed: ${response.status} ${error}`)
  }
}

/**
 * Product doc shape read from the raw `products` Mongo collection. Kept narrow
 * — only fields the subscription helpers actually read.
 */
export interface PayPalPlanProductDoc {
  _id: ObjectId
  name?: string | null
  title?: string | null
  price?: number | null
  currency?: string | null
  interval?: string | null
  paypalProductId?: string | null
  paypalPlanId?: string | null
}

/**
 * Ensure a PayPal Catalog Product + Billing Plan exist for a given local
 * Product, creating them lazily on the first subscription checkout and
 * persisting the returned IDs onto the Product doc so subsequent checkouts
 * skip the PayPal round-trips.
 *
 * Idempotent: if the product already carries both IDs, returns them without
 * touching PayPal. If PayPal returns 422 with a duplicate-resource signal
 * (RESOURCE_ALREADY_EXISTS / IDEMPOTENCY_CONFLICT), that's treated as a benign
 * race — a concurrent request already created the resource. In that case we
 * fall back to the current product doc; the caller should re-read.
 */
export async function ensurePayPalSubscriptionPlan(
  product: PayPalPlanProductDoc,
): Promise<EnsuredPayPalPlan> {
  if (product.paypalProductId && product.paypalPlanId) {
    return { paypalProductId: product.paypalProductId, paypalPlanId: product.paypalPlanId }
  }

  const productName = String(product.name || product.title || 'Product')
  const currency = String(product.currency || 'USD').toUpperCase()
  const price = Number(product.price || 0)
  const interval = String(product.interval || 'month').toLowerCase()
  const intervalUnit = interval === 'year' ? 'YEAR' : 'MONTH'

  const token = await getPayPalAccessToken()

  // 1) Catalog product — required parent for a Billing Plan.
  const catalogProductResponse = await fetch(`${getPayPalApiBase()}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `catalog-product-${product._id.toString()}`,
    },
    body: JSON.stringify({
      name: productName,
      type: 'SERVICE',
      category: 'EDUCATIONAL_AND_TEXTBOOKS',
    }),
  })

  let paypalProductId: string
  if (catalogProductResponse.ok) {
    const body = (await catalogProductResponse.json()) as { id: string }
    paypalProductId = body.id
  } else {
    const errorText = await catalogProductResponse.text()
    if (catalogProductResponse.status === 422 && isDuplicatePayPalError(errorText)) {
      // Concurrent race: another request already created the catalog product.
      // Without a lookup-by-name API we cannot recover the ID here — surface
      // the situation to the caller so it can re-read the product doc.
      throw new Error(`PayPal catalog product already exists (concurrent race): ${errorText}`)
    }
    throw new Error(
      `PayPal catalog product creation failed: ${catalogProductResponse.status} ${errorText}`,
    )
  }

  // 2) Billing plan attached to the catalog product.
  const planResponse = await fetch(`${getPayPalApiBase()}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `billing-plan-${product._id.toString()}`,
    },
    body: JSON.stringify({
      product_id: paypalProductId,
      name: productName,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: intervalUnit, interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: price.toFixed(2), currency_code: currency },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
  })

  let paypalPlanId: string
  if (planResponse.ok) {
    const body = (await planResponse.json()) as { id: string }
    paypalPlanId = body.id
  } else {
    const errorText = await planResponse.text()
    if (planResponse.status === 422 && isDuplicatePayPalError(errorText)) {
      throw new Error(`PayPal billing plan already exists (concurrent race): ${errorText}`)
    }
    throw new Error(`PayPal billing plan creation failed: ${planResponse.status} ${errorText}`)
  }

  // 3) Persist onto the local Product doc so subsequent checkouts skip PayPal.
  const db = await getContentDb()
  await db
    .collection('products')
    .updateOne(
      { _id: product._id },
      { $set: { paypalProductId, paypalPlanId, updatedAt: new Date() } },
    )

  return { paypalProductId, paypalPlanId }
}

function isDuplicatePayPalError(errorText: string): boolean {
  return /RESOURCE_ALREADY_EXISTS|IDEMPOTENCY_CONFLICT|DUPLICATE/.test(errorText)
}

interface PayPalSubscriptionResponse {
  id: string
  status: string
  links: Array<{ href: string; rel: string }>
}

/**
 * Create a PayPal Billing Subscription against an existing Plan and return the
 * approval URL for the buyer to consent to recurring billing. On approval,
 * PayPal fires BILLING.SUBSCRIPTION.ACTIVATED which the Admin webhook handler
 * turns into an active local subscription + first Transaction row.
 */
export async function createPayPalSubscription(
  options: CreateSubscriptionOptions,
): Promise<SubscriptionResult> {
  const { planId, productId, userId, returnUrl, cancelUrl, brandName } = options
  const token = await getPayPalAccessToken()

  const applicationContext: Record<string, unknown> = {
    return_url: returnUrl,
    cancel_url: cancelUrl,
    user_action: 'SUBSCRIBE_NOW',
  }
  if (brandName) applicationContext.brand_name = brandName

  const response = await fetch(`${getPayPalApiBase()}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `subscription-${userId}-${productId}-${Date.now()}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId,
      application_context: applicationContext,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal subscription creation failed: ${response.status} ${error}`)
  }

  const subscription = (await response.json()) as PayPalSubscriptionResponse
  const approvalLink = subscription.links.find((link) => link.rel === 'approve')
  if (!approvalLink) {
    throw new Error('PayPal subscription missing approval URL')
  }

  return { approvalUrl: approvalLink.href, subscriptionId: subscription.id }
}

/**
 * Cancel an active PayPal subscription. Used both by the user-facing cancel
 * flow and by the checkout route's post-provider failure recovery — if we
 * created a subscription but couldn't persist the local rows, we cancel it
 * to avoid orphaned recurring billing.
 *
 * Idempotent: PayPal returns 422 SUBSCRIPTION_STATUS_INVALID if the
 * subscription is already cancelled/expired. Treated as a benign no-op, mirror
 * of how capturePayPalOrder handles ORDER_ALREADY_CAPTURED.
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason?: string,
): Promise<void> {
  const token = await getPayPalAccessToken()

  const response = await fetch(
    `${getPayPalApiBase()}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: reason ?? 'User requested cancellation' }),
    },
  )

  // 204 No Content on success.
  if (response.ok) return

  const errorText = await response.text()
  if (response.status === 422 && /SUBSCRIPTION_STATUS_INVALID/.test(errorText)) {
    return
  }

  throw new Error(`PayPal subscription cancel failed: ${response.status} ${errorText}`)
}

/**
 * Cancel/void a PayPal order
 * Used when transaction record creation fails after order was created
 */
export async function cancelPayPalOrder(providerTransactionId: string): Promise<void> {
  const token = await getPayPalAccessToken()

  const response = await fetch(
    `${getPayPalApiBase()}/v2/checkout/orders/${providerTransactionId}/void`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal order void failed: ${response.status} ${error}`)
  }
}
