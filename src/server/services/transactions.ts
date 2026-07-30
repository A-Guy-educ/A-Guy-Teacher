/**
 * Transactions Service
 *
 * @fileType service
 * @domain payments
 * @pattern repository
 * @ai-summary Reads payment transaction records. Ownership is checked by the caller, which decides how to answer when it does not match.
 */

import { ObjectId, type Document, type WithId } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

/** One transaction by id, or `null`. */
export async function findTransactionById(id: string): Promise<WithId<Document> | null> {
  const db = await getContentDb()
  return db.collection('transactions').findOne({ _id: new ObjectId(id) })
}

/** One transaction by the payment provider's order id, or `null`. */
export async function findTransactionByProviderId(
  providerTransactionId: string,
): Promise<WithId<Document> | null> {
  const db = await getContentDb()
  return db.collection('transactions').findOne({ providerTransactionId })
}

/** One transaction by the provider's capture id, or `null`. */
export async function findTransactionByCaptureId(
  captureId: string,
): Promise<WithId<Document> | null> {
  const db = await getContentDb()
  return db.collection('transactions').findOne({ captureId })
}

/**
 * Claim a pending transaction as succeeded, returning false if someone else
 * already did.
 *
 * The status condition is part of the update filter, not a prior read: PayPal
 * delivers webhooks more than once and in parallel, so exactly one caller must
 * win the transition out of pending. Losers still run the follow-up work,
 * which is independently idempotent.
 */
export async function claimTransactionSucceeded(
  transactionId: string,
  capture: { captureId?: string | null; capturedAt: Date },
): Promise<boolean> {
  const db = await getContentDb()

  const result = await db.collection('transactions').updateOne(
    {
      _id: new ObjectId(transactionId),
      status: { $in: ['pending', 'failed'] },
    } as Document,
    {
      $set: {
        status: 'succeeded',
        // Only overwrite captureId when one came back. A /capture reply for an
        // already-captured order returns null, and PAYMENT.CAPTURE.COMPLETED
        // fills it in on the follow-up event.
        ...(capture.captureId ? { captureId: capture.captureId } : {}),
        capturedAt: capture.capturedAt,
        updatedAt: capture.capturedAt,
      },
    },
  )

  return result.modifiedCount > 0
}

/** Record that a transaction has been refunded. */
export async function markTransactionRefunded(
  transactionId: string,
  refundedAt: Date,
): Promise<void> {
  const db = await getContentDb()

  await db.collection('transactions').updateOne({ _id: new ObjectId(transactionId) } as Document, {
    $set: { status: 'refunded', refundedAt, updatedAt: refundedAt },
  })
}

/** Record that a purchase's entitlements have been handed out. */
export async function markEntitlementsGranted(
  transactionId: string,
  grantedAt: Date,
): Promise<void> {
  const db = await getContentDb()

  await db.collection('transactions').updateOne({ _id: new ObjectId(transactionId) } as Document, {
    $set: { entitlementsGrantedAt: grantedAt, updatedAt: grantedAt },
  })
}
