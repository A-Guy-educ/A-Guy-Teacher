import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { logger } from '@/infra/utils/logger/logger'
import { MissingPaymentEnvError } from '@/lib/payment/env'
import {
  cancelPayPalOrder,
  cancelPayPalSubscription,
  createPayPalOrder,
  createPayPalSubscription,
  ensurePayPalSubscriptionPlan,
  type PayPalPlanProductDoc,
} from '@/lib/payment/paypal'
import { cancelStripeCheckout, createStripeCheckout } from '@/lib/payment/stripe'

const BodySchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'invalid_product_id'),
  provider: z.enum(['stripe', 'paypal']).default('stripe'),
  couponCode: z.string().max(50).optional(),
})

// Match an ISO-4217-shaped three-letter uppercase code. We don't restrict to a
// specific allowlist here — the active provider validates real support and will
// reject unknown codes itself. The shape check exists to catch typos / empties
// / lowercase strings before they reach the provider.
const CURRENCY_SHAPE = /^[A-Z]{3}$/

function parseCurrency(raw: unknown): string | null {
  const upper = String(raw ?? 'ILS').toUpperCase()
  return CURRENCY_SHAPE.test(upper) ? upper : null
}

async function resolveProductItems(itemValues: unknown[]) {
  const ids = itemValues.map(relationId).filter((id): id is string => Boolean(id))
  if (!ids.length) return { itemIds: [], featureKeys: [] }

  const db = await getContentDb()
  const docs = await db
    .collection('product-items')
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .toArray()
  return {
    itemIds: docs.map((doc) => relationId(doc.lesson)).filter((id): id is string => Boolean(id)),
    featureKeys: docs
      .map((doc) => doc.featureKey)
      .filter((key): key is string => typeof key === 'string'),
  }
}

interface SubscriptionCheckoutParams {
  request: NextRequest
  db: Awaited<ReturnType<typeof getContentDb>>
  user: { id: string }
  product: PayPalPlanProductDoc & Record<string, unknown>
  productId: string
  provider: 'stripe' | 'paypal'
  couponCode?: string
}

async function createSubscriptionCheckout({
  request,
  db,
  user,
  product,
  productId,
  provider,
  couponCode,
}: SubscriptionCheckoutParams): Promise<NextResponse> {
  if (provider !== 'paypal') {
    return NextResponse.json(
      { success: false, error: 'stripe_subscriptions_not_supported' },
      { status: 400 },
    )
  }
  if (couponCode) {
    return NextResponse.json(
      { success: false, error: 'coupons_not_supported_on_subscriptions' },
      { status: 400 },
    )
  }
  if (!product.interval) {
    return NextResponse.json({ success: false, error: 'product_missing_interval' }, { status: 400 })
  }

  const currency = parseCurrency(product.currency)
  if (!currency) {
    return NextResponse.json({ success: false, error: 'invalid_currency' }, { status: 400 })
  }
  const amount = Math.round(Number(product.price || 0) * 100)

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    new URL(request.url).origin
  const cancelParams = new URLSearchParams({ product_id: productId })
  const cancelUrl = `${baseUrl}/checkout/cancel?${cancelParams.toString()}`
  const paypalSuccessUrl = `${baseUrl}/checkout/success`

  let paypalPlanId: string
  let approvalUrl: string
  let subscriptionId: string
  try {
    const ensured = await ensurePayPalSubscriptionPlan(product)
    paypalPlanId = ensured.paypalPlanId
    const subscription = await createPayPalSubscription({
      planId: paypalPlanId,
      productId,
      userId: user.id,
      returnUrl: paypalSuccessUrl,
      cancelUrl,
    })
    approvalUrl = subscription.approvalUrl
    subscriptionId = subscription.subscriptionId
  } catch (err) {
    if (err instanceof MissingPaymentEnvError) {
      return NextResponse.json(
        { success: false, error: 'payment_provider_not_configured' },
        { status: 503 },
      )
    }
    logger.error(
      {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        provider,
        productId,
        userId: user.id,
      },
      'Subscription provider helper threw a non-env error',
    )
    return NextResponse.json({ success: false, error: 'checkout_failed' }, { status: 500 })
  }

  // From this point on we hold a live PayPal subscription. If we fail to
  // persist the local transaction/subscription rows, the subscription would
  // continue to bill on approval — cancel it before returning so we don't
  // leak recurring billing state.
  const now = new Date()
  const userRef = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id
  let transactionId: ObjectId | string
  let localSubscriptionId: ObjectId | string
  try {
    // Order matters: transaction first, then subscription with
    // initialTransaction populated. An ACTIVATED webhook arriving in the gap
    // between the two inserts could otherwise see initialTransaction=null and
    // fall back to an entitlement-grant path whose grants can't be cleanly
    // revoked later. See task #976 for the rationale.
    const transactionInsert = await db.collection('transactions').insertOne({
      tenant: product.tenant ?? null,
      user: userRef,
      product: product._id,
      provider: 'paypal',
      providerTransactionId: subscriptionId,
      isRenewal: false,
      status: 'pending',
      amount,
      currency,
      successUrl: paypalSuccessUrl,
      cancelUrl,
      createdAt: now,
      updatedAt: now,
    })
    transactionId = transactionInsert.insertedId

    const subscriptionInsert = await db.collection('subscriptions').insertOne({
      tenant: product.tenant ?? null,
      user: userRef,
      product: product._id,
      provider: 'paypal',
      paypalSubscriptionId: subscriptionId,
      status: 'pending',
      initialTransaction: transactionId,
      createdAt: now,
      updatedAt: now,
    })
    localSubscriptionId = subscriptionInsert.insertedId

    // Reverse pointer on the transaction — the webhook handler doesn't need
    // this for correctness, so it's fine to backfill after the sub insert.
    await db
      .collection('transactions')
      .updateOne(
        { _id: transactionId as ObjectId },
        { $set: { subscription: localSubscriptionId, updatedAt: new Date() } },
      )
  } catch (insertErr) {
    logger.error(
      {
        err:
          insertErr instanceof Error
            ? { message: insertErr.message, stack: insertErr.stack }
            : insertErr,
        provider: 'paypal',
        subscriptionId,
        productId,
        userId: user.id,
      },
      'Failed to persist subscription rows after PayPal subscription was created — cancelling remote subscription',
    )
    try {
      await cancelPayPalSubscription(subscriptionId)
    } catch (cancelErr) {
      logger.error(
        {
          err:
            cancelErr instanceof Error
              ? { message: cancelErr.message, stack: cancelErr.stack }
              : cancelErr,
          provider: 'paypal',
          subscriptionId,
        },
        'Failed to cancel remote subscription after local insert failed — manual reconciliation required',
      )
    }
    return NextResponse.json({ success: false, error: 'checkout_failed' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    checkoutUrl: approvalUrl,
    transactionId: transactionId.toString(),
    subscriptionId: localSubscriptionId.toString(),
  })
}

export async function POST(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) {
    return NextResponse.json({ success: false, error: 'authentication_required' }, { status: 401 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_request' }, { status: 400 })
  }

  const db = await getContentDb()
  const product = await db
    .collection('products')
    .findOne({ _id: new ObjectId(parsed.data.productId) })
  if (!product)
    return NextResponse.json({ success: false, error: 'product_not_found' }, { status: 404 })
  if (product.isActive === false) {
    return NextResponse.json({ success: false, error: 'product_not_active' }, { status: 404 })
  }

  if (product.billingType === 'subscription') {
    return createSubscriptionCheckout({
      request,
      db,
      user,
      product: product as unknown as PayPalPlanProductDoc & Record<string, unknown>,
      productId: parsed.data.productId,
      provider: parsed.data.provider,
      couponCode: parsed.data.couponCode,
    })
  }

  let amount = Math.round(Number(product.price || 0) * 100)
  let appliedCoupon: Record<string, unknown> | null = null
  if (parsed.data.couponCode) {
    const coupon = await db.collection('coupons').findOne({
      code: parsed.data.couponCode.trim().toUpperCase(),
      isActive: true,
    })
    if (!coupon)
      return NextResponse.json({ success: false, error: 'invalid_coupon' }, { status: 400 })
    const originalAmount = amount
    if (coupon.discountType === 'percentage') {
      amount = Math.round(amount * (1 - Number(coupon.discountValue || 0) / 100))
    } else {
      amount = Math.max(0, amount - Number(coupon.discountValue || 0))
    }
    amount = Math.max(1, amount)
    appliedCoupon = {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      originalAmount,
      discountedAmount: amount,
    }
  }

  const { itemIds, featureKeys } = await resolveProductItems(
    Array.isArray(product.items) ? product.items : [],
  )
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    new URL(request.url).origin
  const cancelParams = new URLSearchParams({ product_id: parsed.data.productId })
  const cancelUrl = `${baseUrl}/checkout/cancel?${cancelParams.toString()}`
  // Stripe replaces {CHECKOUT_SESSION_ID} server-side; PayPal does not, so it
  // gets a bare /checkout/success and identifies the order via its own ?token=
  // query param that the success page reads.
  const stripeSuccessUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
  const paypalSuccessUrl = `${baseUrl}/checkout/success`
  const currency = parseCurrency(product.currency)
  if (!currency) {
    return NextResponse.json({ success: false, error: 'invalid_currency' }, { status: 400 })
  }
  const productName = String(product.name || product.title || 'Product')

  let checkoutUrl: string
  let providerSessionId: string
  let successUrl: string
  try {
    if (parsed.data.provider === 'paypal') {
      const result = await createPayPalOrder({
        productId: parsed.data.productId,
        productName,
        amount,
        currency,
        userId: user.id,
        successUrl: paypalSuccessUrl,
        cancelUrl,
      })
      checkoutUrl = result.checkoutUrl
      providerSessionId = result.providerSessionId
      successUrl = paypalSuccessUrl
    } else {
      const result = await createStripeCheckout({
        productId: parsed.data.productId,
        productName,
        amount,
        currency,
        userId: user.id,
        successUrl: stripeSuccessUrl,
        cancelUrl,
      })
      checkoutUrl = result.checkoutUrl
      providerSessionId = result.providerSessionId
      successUrl = stripeSuccessUrl
    }
  } catch (err) {
    if (err instanceof MissingPaymentEnvError) {
      return NextResponse.json(
        { success: false, error: 'payment_provider_not_configured' },
        { status: 503 },
      )
    }
    logger.error(
      {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        provider: parsed.data.provider,
        productId: parsed.data.productId,
        userId: user.id,
      },
      'Checkout provider helper threw a non-env error',
    )
    return NextResponse.json({ success: false, error: 'checkout_failed' }, { status: 500 })
  }

  // From this point on we hold a live order/session at the provider. If we
  // fail to persist the local transaction record, the order would be
  // orphaned — buyer could still pay it (PayPal) or it would sit unbillable
  // (Stripe). Cancel the remote order before returning so we don't leak state.
  const now = new Date()
  let transaction: { insertedId: { toString(): string } }
  try {
    transaction = await db.collection('transactions').insertOne({
      tenant: product.tenant,
      user: ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id,
      product: product._id,
      provider: parsed.data.provider,
      providerTransactionId: providerSessionId,
      status: 'pending',
      amount,
      currency,
      metadata: { itemIds, featureKeys, ...(appliedCoupon ? { appliedCoupon } : {}) },
      successUrl,
      cancelUrl,
      createdAt: now,
      updatedAt: now,
    })
  } catch (insertErr) {
    logger.error(
      {
        err:
          insertErr instanceof Error
            ? { message: insertErr.message, stack: insertErr.stack }
            : insertErr,
        provider: parsed.data.provider,
        providerSessionId,
        productId: parsed.data.productId,
        userId: user.id,
      },
      'Failed to persist transaction record after provider order was created — cancelling remote order',
    )
    try {
      if (parsed.data.provider === 'paypal') {
        await cancelPayPalOrder(providerSessionId)
      } else {
        await cancelStripeCheckout(providerSessionId)
      }
    } catch (cancelErr) {
      logger.error(
        {
          err:
            cancelErr instanceof Error
              ? { message: cancelErr.message, stack: cancelErr.stack }
              : cancelErr,
          provider: parsed.data.provider,
          providerSessionId,
        },
        'Failed to cancel remote order after transaction-record insert failed — manual reconciliation required',
      )
    }
    return NextResponse.json({ success: false, error: 'checkout_failed' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    checkoutUrl,
    transactionId: transaction.insertedId.toString(),
    ...(appliedCoupon ? { appliedCoupon } : {}),
  })
}
