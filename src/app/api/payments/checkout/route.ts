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

function isPayPalSubscriptionsEnabled(): boolean {
  const raw = process.env.PAYPAL_SUBSCRIPTIONS_ENABLED
  return raw === '1' || raw?.toLowerCase() === 'true'
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
  // Feature gate: the subscription-lifecycle webhook receiver
  // (BILLING.SUBSCRIPTION.ACTIVATED) lives in the parallel Admin PR
  // (A-Guy-Admin#266). Until that ships, a buyer who approves here would sit
  // as a permanently `pending` local row with no entitlements. Keep this
  // branch OFF by default and flip PAYPAL_SUBSCRIPTIONS_ENABLED=1 in the
  // deployment env once the Admin receiver is live.
  if (!isPayPalSubscriptionsEnabled()) {
    return NextResponse.json(
      { success: false, error: 'subscription_checkout_disabled' },
      { status: 503 },
    )
  }

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
  const interval = String(product.interval).trim().toLowerCase()
  if (interval !== 'month' && interval !== 'year') {
    return NextResponse.json({ success: false, error: 'product_invalid_interval' }, { status: 400 })
  }

  const currency = parseCurrency(product.currency)
  if (!currency) {
    return NextResponse.json({ success: false, error: 'invalid_currency' }, { status: 400 })
  }
  const priceMajor = Number(product.price || 0)
  if (!(priceMajor > 0)) {
    return NextResponse.json({ success: false, error: 'product_missing_price' }, { status: 400 })
  }
  const amount = Math.round(priceMajor * 100)

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    new URL(request.url).origin
  const cancelParams = new URLSearchParams({ product_id: productId })
  const cancelUrl = `${baseUrl}/checkout/cancel?${cancelParams.toString()}`
  const paypalSuccessUrl = `${baseUrl}/checkout/success`

  // Metadata parity with the one-time transaction row — reporting queries and
  // entitlement grant flows that read metadata.itemIds/featureKeys shouldn't
  // see a shape gap between one-time and subscription rows.
  const { itemIds, featureKeys } = await resolveProductItems(
    Array.isArray(product.items) ? product.items : [],
  )

  let paypalPlanId: string
  let approvalUrl: string
  let subscriptionId: string
  try {
    // Pass the validated currency / price / interval explicitly — the helper
    // doesn't fall back to defaults, so a divergence between what the route
    // stores locally and what PayPal bills is impossible.
    const ensured = await ensurePayPalSubscriptionPlan({
      product,
      price: priceMajor,
      currency,
      interval,
    })
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
  let transactionId: ObjectId | null = null
  let localSubscriptionId: ObjectId | null = null
  try {
    // Order matters: transaction first, then subscription with
    // initialTransaction populated. When the parallel Admin webhook receiver
    // (A-Guy-Admin#266) lands, ACTIVATED events arriving in the gap between
    // the two inserts could otherwise see initialTransaction=null and fall
    // back to an entitlement-grant path whose grants can't be cleanly
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
      metadata: { itemIds, featureKeys },
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
      // Snapshot amount + currency so the sub retains historical pricing if
      // the product's price is edited later. The transaction row already
      // records the same values for the initial charge; the snapshot on the
      // sub is what future renewals compare against for auditing.
      amount,
      currency,
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
        { _id: transactionId },
        { $set: { subscription: localSubscriptionId, updatedAt: new Date() } },
      )
  } catch (insertErr) {
    // Distinguish the "another checkout for the same (user, product) is
    // already pending/active" race from a generic DB failure. The partial
    // unique index on subscriptions(user, product) filtered to
    // status ∈ {pending, active} is what surfaces this as Mongo error 11000
    // when a rapid double-click hits us. See review #980 Medium #2.
    const isDuplicateSubscriptionKey =
      typeof insertErr === 'object' &&
      insertErr !== null &&
      (insertErr as { code?: unknown }).code === 11000

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
        partialTransactionId: transactionId?.toString() ?? null,
        partialSubscriptionId: localSubscriptionId?.toString() ?? null,
        isDuplicateSubscriptionKey,
      },
      'Failed to persist subscription rows after PayPal subscription was created — cancelling remote subscription',
    )

    // Clean up any rows we already inserted before the failure. Without this
    // a partial insert leaves a dangling `pending` transactions (and possibly
    // subscriptions) row that reapers / checkout-history UI would treat as an
    // in-flight checkout even though the PayPal side has been cancelled.
    if (localSubscriptionId) {
      try {
        await db.collection('subscriptions').deleteOne({ _id: localSubscriptionId })
      } catch (cleanupErr) {
        logger.error(
          {
            err:
              cleanupErr instanceof Error
                ? { message: cleanupErr.message, stack: cleanupErr.stack }
                : cleanupErr,
            subscriptionRowId: localSubscriptionId.toString(),
          },
          'Failed to delete partial subscription row during recovery — manual reconciliation required',
        )
      }
    }
    if (transactionId) {
      try {
        await db.collection('transactions').deleteOne({ _id: transactionId })
      } catch (cleanupErr) {
        logger.error(
          {
            err:
              cleanupErr instanceof Error
                ? { message: cleanupErr.message, stack: cleanupErr.stack }
                : cleanupErr,
            transactionRowId: transactionId.toString(),
          },
          'Failed to delete partial transaction row during recovery — manual reconciliation required',
        )
      }
    }

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
    if (isDuplicateSubscriptionKey) {
      return NextResponse.json(
        { success: false, error: 'in_flight_subscription_exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ success: false, error: 'checkout_failed' }, { status: 500 })
  }

  // Explicit guard rather than non-null assertions — if a future edit ever
  // adds an early `return` inside the try block, this stays sound.
  if (!transactionId || !localSubscriptionId) {
    logger.error(
      {
        subscriptionId,
        transactionId: transactionId?.toString() ?? null,
        localSubscriptionId: localSubscriptionId?.toString() ?? null,
      },
      'Unexpected null local subscription IDs after successful insert path — invariant broken',
    )
    return NextResponse.json({ success: false, error: 'checkout_failed' }, { status: 500 })
  }
  // `localSubscriptionId` is the Mongo _id of the local `subscriptions` row.
  // The PayPal-side subscription id (I-XXX) is the buyer-facing value carried
  // by the approval-return URL's ?subscription_id= param — clients should
  // consume that from PayPal's redirect rather than expect it in this
  // response envelope. Naming it explicitly avoids ambiguity with the PayPal
  // id.
  return NextResponse.json({
    success: true,
    checkoutUrl: approvalUrl,
    transactionId: transactionId.toString(),
    localSubscriptionId: localSubscriptionId.toString(),
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

  // Normalize coupon input at the top so both the subscription and one-time
  // branches see the same "no coupon" value for empty/whitespace strings —
  // otherwise the sub branch's truthy check rejects "   " while the one-time
  // branch's later trim() silently accepts it.
  const normalizedCouponCode = parsed.data.couponCode?.trim() || undefined

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
      couponCode: normalizedCouponCode,
    })
  }

  let amount = Math.round(Number(product.price || 0) * 100)
  let appliedCoupon: Record<string, unknown> | null = null
  if (normalizedCouponCode) {
    const coupon = await db.collection('coupons').findOne({
      code: normalizedCouponCode.toUpperCase(),
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
      // Align with subscription branch shape — always a value, `null` when the
      // product is tenant-less. Reporting queries then don't have to match on
      // both `undefined` and `null` for the same field.
      tenant: product.tenant ?? null,
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
