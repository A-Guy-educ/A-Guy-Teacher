/**
 * PayPal Webhook Handler
 *
 * POST /api/webhooks/paypal
 *
 * Verifies the PayPal webhook signature, then on the events that actually move
 * money marks the transaction `succeeded` and persists the capture ID so
 * refunds can resolve it later. Idempotent: replays from PayPal hit the same
 * target row with a no-op update.
 *
 * On the success path, after the transaction is flipped to `succeeded`:
 *  - calls `grantProductEntitlements` to push course + feature entitlements
 *    onto the buyer (idempotent at the row level via `entitlementsGrantedAt`)
 *  - triggers the purchase-receipt email (via `sendPurchaseReceipt` — Resend
 *    SDK direct). The receipt service has its own atomic-claim idempotency
 *    on `emailSentAt`.
 *
 * Also calls `grantProductEntitlements` to materialise `user-entitlements`
 * and `enrollments` rows for each `courseBlock` bundled in the product. Per-row
 * idempotency is tracked via `transactions.entitlementsGrantedAt`.
 *
 * Deliberately NOT in this handler (defer to follow-ups):
 *  - Coupon consumption hook
 *  - Webhook-event dedup collection (we rely on per-row idempotency for now)
 *
 * Response codes:
 *  - 400 — invalid body or invalid signature; PayPal will NOT retry.
 *  - 500 — transient server error (DB outage, network); PayPal WILL retry.
 *  - 200 — event accepted (handled, deduped, or intentionally ignored).
 */

import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'
import { grantProductEntitlements } from '@/lib/payment/grant-entitlements'
import { capturePayPalOrder, verifyPayPalWebhook } from '@/lib/payment/paypal'
import { sendPurchaseReceipt } from '@/server/email/services/purchase-receipt-service'

interface PayPalWebhookResource {
  id: string
  supplementary_data?: {
    related_ids?: {
      order_id?: string
    }
  }
}

interface PayPalWebhookEvent {
  id: string
  event_type: string
  resource: PayPalWebhookResource
}

function sourceIpFrom(headers: Headers): string {
  return headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown'
}

function isMissingWebhookConfig(err: unknown): boolean {
  return (
    err instanceof Error &&
    /Missing required PayPal environment variables|Missing PAYPAL_WEBHOOK_ID|Missing required PayPal webhook headers/i.test(
      err.message,
    )
  )
}

export async function POST(request: NextRequest) {
  // 1) Parse JSON body
  let body: PayPalWebhookEvent
  try {
    body = (await request.json()) as PayPalWebhookEvent
  } catch {
    logger.warn(
      { sourceIp: sourceIpFrom(request.headers) },
      'PayPal webhook: invalid JSON body — returning 400',
    )
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // 2) Extract PayPal signature headers
  const sigHeaders: Record<string, string> = {
    'paypal-transmission-id': request.headers.get('paypal-transmission-id') || '',
    'paypal-transmission-time': request.headers.get('paypal-transmission-time') || '',
    'paypal-transmission-sig': request.headers.get('paypal-transmission-sig') || '',
    'paypal-cert-url': request.headers.get('paypal-cert-url') || '',
    'paypal-auth-algo': request.headers.get('paypal-auth-algo') || '',
  }

  // 3) Verify signature. Distinguish bad-config (400, no retry) from transient
  // verifier failures (500, PayPal retries).
  try {
    const isValid = await verifyPayPalWebhook(body, sigHeaders)
    if (!isValid) {
      logger.warn(
        { sourceIp: sourceIpFrom(request.headers), eventId: body.id, eventType: body.event_type },
        'PayPal webhook: signature verification failed — returning 400',
      )
      return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
    }
  } catch (err) {
    if (isMissingWebhookConfig(err)) {
      logger.error(
        { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
        'PayPal webhook: misconfigured — returning 400',
      )
      return NextResponse.json({ error: 'invalid_webhook_configuration' }, { status: 400 })
    }
    logger.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      'PayPal webhook: signature verification threw — returning 500 so PayPal retries',
    )
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }

  // 4) Route by event type. Idempotent per row.
  try {
    await handleEvent(body)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    logger.error(
      {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        eventId: body.id,
        eventType: body.event_type,
      },
      'PayPal webhook: handler threw — returning 500 so PayPal retries',
    )
    return NextResponse.json({ error: 'handler_error' }, { status: 500 })
  }
}

/**
 * Materialises course entitlements bundled in the purchased product for the
 * buyer, and stamps `transactions.entitlementsGrantedAt` so future webhook
 * replays no-op. Idempotent on the underlying collections (the grant function
 * checks for an existing entitlement/enrollment before inserting), so it's
 * safe to call from both `handleOrderApproved` and `handleCaptureCompleted`.
 *
 * Throws when the grant function throws — that surfaces as a 500 webhook
 * response so PayPal retries, which is what we want for transient DB failures.
 */
async function maybeGrantEntitlements(transaction: {
  _id: unknown
  user?: unknown
  product?: unknown
  entitlementsGrantedAt?: Date | string | null
}): Promise<void> {
  if (transaction.entitlementsGrantedAt) return

  const transactionId = String(transaction._id)
  const userId = relationId(transaction.user)
  const productId = relationId(transaction.product)

  if (!userId || !productId) {
    logger.warn(
      { transactionId, hasUser: !!userId, hasProduct: !!productId },
      'PayPal webhook: cannot grant entitlements — transaction missing user/product',
    )
    return
  }

  const grantedAt = new Date()
  await grantProductEntitlements(userId, productId, transactionId)

  const db = await getContentDb()
  await db
    .collection('transactions')
    .updateOne(
      { _id: new ObjectId(transactionId) },
      { $set: { entitlementsGrantedAt: grantedAt, updatedAt: grantedAt } },
    )

  logger.info({ transactionId, userId, productId }, 'PayPal webhook: entitlements granted')
}

/**
 * Triggers the purchase-receipt email after a webhook flips a transaction to
 * `succeeded`. The service is internally idempotent (via `transactions.emailSentAt`),
 * so calling it from both event handlers is safe — only the first call that
 * finds the row in the right state actually sends.
 */
async function maybeSendReceipt(
  transaction: {
    _id: unknown
    user?: unknown
    product?: unknown
    providerTransactionId?: string
    amount?: number
    currency?: string
    metadata?: { appliedCoupon?: unknown } | null
  },
  capturedAt: Date,
): Promise<void> {
  const transactionId = String(transaction._id)
  const userId = relationId(transaction.user)
  const productId = relationId(transaction.product)
  const providerTransactionId = transaction.providerTransactionId

  if (!userId || !productId || !providerTransactionId) {
    logger.warn(
      { transactionId, hasUser: !!userId, hasProduct: !!productId },
      'PayPal webhook: cannot send receipt — transaction missing user/product/providerTransactionId',
    )
    return
  }

  const appliedCoupon =
    (transaction.metadata?.appliedCoupon as
      | {
          code: string
          discountType: string
          discountValue: number
          originalAmount?: number
          discountedAmount?: number
        }
      | undefined) ?? null

  const result = await sendPurchaseReceipt({
    transactionId,
    userId,
    productId,
    providerTransactionId,
    amount: Number(transaction.amount ?? 0),
    currency: String(transaction.currency ?? 'ILS'),
    capturedAt,
    appliedCoupon,
  })

  if (result.sent) {
    logger.info({ transactionId }, 'Purchase receipt sent')
  } else if (result.reason === 'error') {
    // result.error from Resend means the claim was rolled back inside
    // sendPurchaseReceipt, but PayPal still needs to retry. Throw so the
    // webhook returns 500 and PayPal re-delivers the event.
    logger.warn({ transactionId }, 'Purchase receipt send failed — throwing so PayPal retries')
    throw new Error(`Purchase receipt send failed: ${transactionId}`)
  } else if (result.reason === 'missing_data') {
    // missing_data is already rolled back inside sendPurchaseReceipt.
    // Nothing to retry — return 200 so PayPal doesn't spin forever.
    logger.warn({ transactionId }, 'Purchase receipt missing data — acknowledging')
  }
  // already_sent and no_adapter are routine no-ops — acknowledge.
}

async function handleEvent(event: PayPalWebhookEvent): Promise<void> {
  switch (event.event_type) {
    case 'CHECKOUT.ORDER.APPROVED':
      await handleOrderApproved(event)
      return

    case 'PAYMENT.CAPTURE.COMPLETED':
      await handleCaptureCompleted(event)
      return

    case 'PAYMENT.CAPTURE.REFUNDED':
      await handleCaptureRefunded(event)
      return

    default:
      // Unhandled event type — accept and move on so PayPal doesn't retry.
      logger.info(
        { eventId: event.id, eventType: event.event_type },
        'PayPal webhook: event type not handled — acknowledging',
      )
      return
  }
}

async function handleOrderApproved(event: PayPalWebhookEvent): Promise<void> {
  const orderId = event.resource.id
  const db = await getContentDb()
  const transactions = db.collection('transactions')

  const transaction = await transactions.findOne({ providerTransactionId: orderId })
  if (!transaction) {
    logger.warn(
      { orderId, eventId: event.id },
      'PayPal webhook: CHECKOUT.ORDER.APPROVED for unknown order — acknowledging',
    )
    return
  }

  // Idempotent: if we've already captured + marked succeeded AND already sent
  // the receipt AND already granted entitlements, replays do nothing. If the
  // receipt service rolled back its emailSentAt claim (e.g. a DB blip during
  // user/product lookup), let the retry re-enter the send path —
  // capturePayPalOrder treats ORDER_ALREADY_CAPTURED as a no-op and the
  // updateOne is essentially a no-op for already-succeeded rows.
  if (
    transaction.status === 'succeeded' &&
    transaction.captureId &&
    transaction.emailSentAt &&
    transaction.entitlementsGrantedAt
  ) {
    return
  }

  // Move the money. capturePayPalOrder is itself idempotent (treats
  // ORDER_ALREADY_CAPTURED as a no-op, returns captureId: null in that case).
  const { captureId } = await capturePayPalOrder(orderId)

  const capturedAt = new Date()
  await transactions.updateOne(
    { _id: new ObjectId(String(transaction._id)) },
    {
      $set: {
        status: 'succeeded',
        // Only overwrite captureId if we actually got one back. Older /capture
        // replies on already-captured orders return null; PAYMENT.CAPTURE.COMPLETED
        // will fill it in on the follow-up event.
        ...(captureId ? { captureId } : {}),
        capturedAt,
        updatedAt: capturedAt,
      },
    },
  )

  await maybeGrantEntitlements(transaction)
  await maybeSendReceipt(transaction, capturedAt)
}

async function handleCaptureCompleted(event: PayPalWebhookEvent): Promise<void> {
  // The order ID is in supplementary_data; the resource.id IS the capture ID.
  const orderId = event.resource.supplementary_data?.related_ids?.order_id
  const captureId = event.resource.id

  if (!orderId) {
    logger.warn(
      { eventId: event.id, captureId },
      'PayPal webhook: PAYMENT.CAPTURE.COMPLETED without order_id in supplementary_data — acknowledging',
    )
    return
  }

  const db = await getContentDb()
  const transactions = db.collection('transactions')

  const transaction = await transactions.findOne({ providerTransactionId: orderId })
  if (!transaction) {
    logger.warn(
      { orderId, captureId, eventId: event.id },
      'PayPal webhook: PAYMENT.CAPTURE.COMPLETED for unknown order — acknowledging',
    )
    return
  }

  // Already refunded: don't overwrite that status. Capture-completed arriving
  // for a refunded row is anomalous (PayPal shouldn't fire it after a refund),
  // but be defensive and acknowledge without re-flipping.
  if (transaction.status === 'refunded') {
    return
  }

  // Idempotent: already marked succeeded with this capture AND the receipt has
  // already gone out AND entitlements are granted → nothing to do. If any
  // post-flip step (receipt, entitlements) is missing, let the retry
  // re-enter that path. updateOne is essentially a no-op when status +
  // captureId already match.
  if (
    transaction.status === 'succeeded' &&
    transaction.captureId === captureId &&
    transaction.emailSentAt &&
    transaction.entitlementsGrantedAt
  ) {
    return
  }

  const capturedAt = new Date()
  await transactions.updateOne(
    { _id: new ObjectId(String(transaction._id)) },
    {
      $set: {
        status: 'succeeded',
        captureId,
        capturedAt,
        updatedAt: capturedAt,
      },
    },
  )

  await maybeGrantEntitlements(transaction)
  await maybeSendReceipt(transaction, capturedAt)
}

async function handleCaptureRefunded(event: PayPalWebhookEvent): Promise<void> {
  // PAYMENT.CAPTURE.REFUNDED arrives with resource.id = capture ID (not order
  // ID). Real-world rows store providerTransactionId as the order ID, so we
  // look up by captureId.
  const captureId = event.resource.id
  if (!captureId) {
    logger.warn(
      { eventId: event.id },
      'PayPal webhook: PAYMENT.CAPTURE.REFUNDED without capture id — acknowledging',
    )
    return
  }

  const db = await getContentDb()
  const transactions = db.collection('transactions')

  const transaction = await transactions.findOne({ captureId })
  if (!transaction) {
    logger.warn(
      { captureId, eventId: event.id },
      'PayPal webhook: PAYMENT.CAPTURE.REFUNDED for unknown capture — acknowledging',
    )
    return
  }

  if (transaction.status === 'refunded') {
    return
  }

  const refundedAt = new Date()
  await transactions.updateOne(
    { _id: new ObjectId(String(transaction._id)) },
    {
      $set: {
        status: 'refunded',
        refundedAt,
        updatedAt: refundedAt,
      },
    },
  )
}
