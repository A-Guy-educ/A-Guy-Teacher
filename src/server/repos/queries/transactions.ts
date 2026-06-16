import { ObjectId, type Document } from 'mongodb'
import { cache } from 'react'

import { getContentDb } from '@/infra/db/content-db'
import type { TransactionWithProduct } from '@/app/(frontend)/account/purchases/PurchasesPageContent'

export interface CheckoutSuccessTransaction {
  id: string
  status: TransactionWithProduct['status']
  productName: string | null
}

interface TransactionDoc extends Document {
  _id: ObjectId
  user?: ObjectId | string
  product?: ObjectId | string
  status?: TransactionWithProduct['status']
  provider?: TransactionWithProduct['provider']
  amount?: number
  currency?: string
  createdAt?: Date | string
  refundedAmount?: number
  refundedAt?: Date | string
  metadata?: { appliedCoupon?: { code?: string } | null } | null
  productDoc?: { name?: string; title?: string; slug?: string } | null
}

function toIsoString(value: unknown, fallback: string): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return fallback
}

/**
 * Returns the user's transactions newest-first, joined to the product so the
 * UI can show the product name and link to its detail page.
 *
 * Old rows store `user` as an ObjectId; newer rows might store it as a string
 * (the checkout route only converts when the id is a valid ObjectId hex).
 * We match either form so historical rows aren't hidden.
 */
/**
 * Look up a single transaction by the provider's session/order ID
 * (Stripe checkout session ID or PayPal order ID — both land in the same
 * `providerTransactionId` field). Joins to `products` to surface the name
 * for the success page header.
 *
 * Returns `null` if no row matches — e.g. a buyer with a stale `?token=`
 * in the URL after the row was cleaned up, or a probe with a guessed ID.
 *
 * Deliberately returns only display-safe fields. The provider-side IDs are
 * long and random enough that we don't expect probing to be a real attack
 * surface, but there's no reason to leak `user`/`amount`/`tenant` either.
 */
export const queryTransactionByProviderId = cache(
  async (providerTransactionId: string): Promise<CheckoutSuccessTransaction | null> => {
    const db = await getContentDb()

    const docs = (await db
      .collection('transactions')
      .aggregate([
        { $match: { providerTransactionId } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productDoc',
          },
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      ])
      .toArray()) as TransactionDoc[]

    const doc = docs[0]
    if (!doc) return null

    const product = doc.productDoc ?? null
    return {
      id: doc._id.toString(),
      status: doc.status ?? 'pending',
      productName: product?.name ?? product?.title ?? null,
    }
  },
)

export const queryUserTransactions = cache(
  async (userId: string): Promise<TransactionWithProduct[]> => {
    const db = await getContentDb()

    const userMatchers: Array<Record<string, unknown>> = [{ user: userId }]
    if (ObjectId.isValid(userId)) {
      userMatchers.push({ user: new ObjectId(userId) })
    }

    const docs = (await db
      .collection('transactions')
      .aggregate([
        { $match: { $or: userMatchers } },
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productDoc',
          },
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      ])
      .toArray()) as TransactionDoc[]

    const nowIso = new Date().toISOString()
    return docs.map((doc) => {
      const product = doc.productDoc ?? null
      return {
        id: doc._id.toString(),
        status: doc.status ?? 'pending',
        amount: Number(doc.amount ?? 0),
        currency: String(doc.currency ?? 'ILS'),
        createdAt: toIsoString(doc.createdAt, nowIso),
        provider: doc.provider ?? 'stripe',
        productName: product?.name ?? product?.title ?? null,
        productSlug: product?.slug ?? null,
        couponCode: doc.metadata?.appliedCoupon?.code ?? null,
        refundedAmount: doc.refundedAmount != null ? Number(doc.refundedAmount) : null,
        refundedAt: doc.refundedAt ? toIsoString(doc.refundedAt, nowIso) : null,
      }
    })
  },
)
