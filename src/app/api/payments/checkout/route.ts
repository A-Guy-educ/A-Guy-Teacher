import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { MissingPaymentEnvError } from '@/lib/payment/env'
import { createPayPalOrder } from '@/lib/payment/paypal'
import { createStripeCheckout } from '@/lib/payment/stripe'

const BodySchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'invalid_product_id'),
  provider: z.enum(['stripe', 'paypal']).default('stripe'),
  couponCode: z.string().max(50).optional(),
})

const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR'] as const
type Currency = (typeof SUPPORTED_CURRENCIES)[number]

function parseCurrency(raw: unknown): Currency | null {
  const upper = String(raw ?? 'ILS').toUpperCase()
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper) ? (upper as Currency) : null
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
    return NextResponse.json({ success: false, error: 'checkout_failed' }, { status: 500 })
  }

  const now = new Date()
  const transaction = await db.collection('transactions').insertOne({
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

  return NextResponse.json({
    success: true,
    checkoutUrl,
    transactionId: transaction.insertedId.toString(),
    ...(appliedCoupon ? { appliedCoupon } : {}),
  })
}
