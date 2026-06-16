/**
 * PayPal Webhook Handler
 *
 * POST /api/webhooks/paypal
 *
 * Minimum-viable handler reinstated after the Payload-runtime removal. Verifies
 * the PayPal webhook signature, then on the events that actually move money
 * marks the transaction `succeeded` and persists the capture ID so refunds can
 * resolve it later. Idempotent: replays from PayPal hit the same target row
 * with a no-op update.
 *
 * Deliberately NOT in this handler (defer to follow-ups):
 *  - Coupon consumption hook
 *  - Purchase-receipt email
 *  - PAYMENT.CAPTURE.REFUNDED → status='refunded'
 *  - Webhook-event dedup collection (we rely on per-row idempotency for now)
 *  - Entitlement grant beyond status flip (grantProductEntitlements is a stub)
 *
 * Response codes:
 *  - 400 — invalid body or invalid signature; PayPal will NOT retry.
 *  - 500 — transient server error (DB outage, network); PayPal WILL retry.
 *  - 200 — event accepted (handled, deduped, or intentionally ignored).
 */

import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { getContentDb } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'
import { capturePayPalOrder, verifyPayPalWebhook } from '@/lib/payment/paypal'

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

async function handleEvent(event: PayPalWebhookEvent): Promise<void> {
  switch (event.event_type) {
    case 'CHECKOUT.ORDER.APPROVED':
      await handleOrderApproved(event)
      return

    case 'PAYMENT.CAPTURE.COMPLETED':
      await handleCaptureCompleted(event)
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

  // Idempotent: if we've already captured + marked succeeded, replays do nothing.
  if (transaction.status === 'succeeded' && transaction.captureId) {
    return
  }

  // Move the money. capturePayPalOrder is itself idempotent (treats
  // ORDER_ALREADY_CAPTURED as a no-op, returns captureId: null in that case).
  const { captureId } = await capturePayPalOrder(orderId)

  await transactions.updateOne(
    { _id: new ObjectId(String(transaction._id)) },
    {
      $set: {
        status: 'succeeded',
        // Only overwrite captureId if we actually got one back. Older /capture
        // replies on already-captured orders return null; PAYMENT.CAPTURE.COMPLETED
        // will fill it in on the follow-up event.
        ...(captureId ? { captureId } : {}),
        capturedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  )
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

  // Idempotent: already marked succeeded with this capture → nothing to do.
  if (transaction.status === 'succeeded' && transaction.captureId === captureId) {
    return
  }

  await transactions.updateOne(
    { _id: new ObjectId(String(transaction._id)) },
    {
      $set: {
        status: 'succeeded',
        captureId,
        capturedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  )
}
