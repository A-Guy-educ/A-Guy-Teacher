/**
 * Checkout Service
 *
 * @fileType service
 * @domain payments
 * @pattern repository
 * @ai-summary Database side of starting a purchase: reading the product and coupon, and writing the local transaction and subscription rows that mirror what the payment provider was told.
 */

import { ObjectId, type Document, type WithId } from 'mongodb'

import { getContentDb, relationId } from '@/infra/db/content-db'

/** A product by id, or `null`. */
export async function findProductById(productId: string): Promise<WithId<Document> | null> {
  const db = await getContentDb()
  return db.collection('products').findOne({ _id: new ObjectId(productId) })
}

/** An active coupon by code, matched in upper case, or `null`. */
export async function findActiveCoupon(code: string): Promise<WithId<Document> | null> {
  const db = await getContentDb()
  return db.collection('coupons').findOne({ code: code.toUpperCase(), isActive: true })
}

/**
 * The lessons and feature keys a product's items unlock.
 *
 * Returns empty lists rather than failing when a product has no items — a
 * product can legitimately grant nothing but access itself.
 */
export async function resolveProductItems(
  itemValues: unknown[],
): Promise<{ itemIds: string[]; featureKeys: string[] }> {
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

/** Record a pending purchase and return its id. */
export async function createTransaction(transaction: Document): Promise<{ insertedId: ObjectId }> {
  const db = await getContentDb()
  const now = new Date()

  const result = await db
    .collection('transactions')
    .insertOne({ ...transaction, createdAt: now, updatedAt: now })

  return { insertedId: result.insertedId as ObjectId }
}

/** Record a pending subscription and return its id. */
export async function createSubscription(
  subscription: Document,
): Promise<{ insertedId: ObjectId }> {
  const db = await getContentDb()
  const now = new Date()

  const result = await db
    .collection('subscriptions')
    .insertOne({ ...subscription, createdAt: now, updatedAt: now })

  return { insertedId: result.insertedId as ObjectId }
}

/** Point a transaction back at the subscription it started. */
export async function linkTransactionToSubscription(
  transactionId: unknown,
  subscriptionId: unknown,
): Promise<void> {
  const db = await getContentDb()

  await db.collection('transactions').updateOne({ _id: transactionId } as Document, {
    $set: { subscription: subscriptionId, updatedAt: new Date() },
  })
}

/**
 * Remove a row written before a later step failed.
 *
 * Used only on the recovery path: a half-written checkout would otherwise look
 * like an in-flight purchase to reapers and to the buyer's history.
 */
export async function deleteSubscriptionRow(subscriptionId: unknown): Promise<void> {
  const db = await getContentDb()
  await db.collection('subscriptions').deleteOne({ _id: subscriptionId } as Document)
}

/** Remove a transaction row written before a later step failed. */
export async function deleteTransactionRow(transactionId: unknown): Promise<void> {
  const db = await getContentDb()
  await db.collection('transactions').deleteOne({ _id: transactionId } as Document)
}
