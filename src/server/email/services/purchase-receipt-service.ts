/**
 * Purchase Receipt Email Service
 *
 * Sends a templated purchase receipt email after a successful payment.
 * Web-direct against the Resend SDK — does not depend on the Payload runtime
 * (which was removed from this repo).
 *
 * Concurrency model:
 *  - Atomically *claims* the slot via `findOneAndUpdate({ _id, emailSentAt:
 *    { $exists: false } }, { $set: { emailSentAt: <now> } })` before sending,
 *    so a second concurrent call sees the claim and bails with `already_sent`.
 *    Defends against PayPal delivering `CHECKOUT.ORDER.APPROVED` and
 *    `PAYMENT.CAPTURE.COMPLETED` simultaneously, or two retries landing on
 *    separate Vercel function instances.
 *  - On Resend failure — OR on a thrown user / product DB lookup after the
 *    claim is staked — the timestamp is rolled back with `$unset` so a later
 *    retry can re-claim and try again.
 *  - Resend's own `idempotencyKey` (set to `transactionId`) is the third line
 *    of defense — if a rare race still lets two sends through, Resend dedupes
 *    server-side and the buyer still only sees one mail.
 *
 * Other guarantees:
 *  - No-op when `RESEND_API_KEY` is missing (returns `no_adapter`). Checked
 *    FIRST so dev/preview environments don't even open a DB connection per
 *    webhook delivery.
 *  - Never throws on send failure — the caller's webhook can still return
 *    200 so PayPal doesn't retry forever on transient Resend outages.
 *
 * @fileType service
 * @domain email
 * @pattern purchase-receipt
 * @ai-summary Sends purchase receipt emails after successful payment webhooks, with atomic-claim idempotency
 */

import { ObjectId, type Collection, type Document } from 'mongodb'
import { Resend } from 'resend'

import { getContentDb, objectIdFromString } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

import {
  buildPurchaseReceiptEmailEN,
  buildPurchaseReceiptEmailHE,
  type PurchaseReceiptData,
} from '../templates/purchase-receipt'

const PURCHASES_URL = '/account/purchases'
// Override per environment with RESEND_FROM if you need preview / staging to
// send from a non-production verified sender. Default keeps prod behavior.
const FALLBACK_FROM = 'support@aguy.co.il'
function getFromAddress(): string {
  return process.env.RESEND_FROM || FALLBACK_FROM
}
type SupportedLocale = 'en' | 'he'

const CURRENCY_SYMBOLS: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' }
function symbolFor(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

export interface SendPurchaseReceiptOptions {
  transactionId: string
  userId: string
  productId: string
  providerTransactionId: string
  amount: number
  currency: string
  /** Defaults to the user's stored locale, or 'he' if missing. */
  userLocale?: SupportedLocale
  /**
   * Timestamp the payment was actually captured. Used as the receipt's
   * payment-date so a delayed webhook delivery doesn't show "today" instead
   * of the real purchase time. Falls back to `new Date()` if not provided.
   */
  capturedAt?: Date
  appliedCoupon?: {
    code: string
    discountType: string
    discountValue: number
    originalAmount?: number
    discountedAmount?: number
  } | null
}

export type SendPurchaseReceiptResult =
  | { sent: true }
  | { sent: false; reason: 'already_sent' | 'no_adapter' | 'missing_data' | 'error' }

let _resendClient: Resend | null = null
function getResendClient(): Resend | null {
  if (_resendClient) return _resendClient
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  _resendClient = new Resend(apiKey)
  return _resendClient
}

/** Reset the cached Resend client (testing only). */
export function _resetResendClient(): void {
  _resendClient = null
}

function renderEmailTemplate(locale: SupportedLocale, data: PurchaseReceiptData): string {
  return locale === 'he' ? buildPurchaseReceiptEmailHE(data) : buildPurchaseReceiptEmailEN(data)
}

function pickLocale(rawLocale: unknown): SupportedLocale {
  return rawLocale === 'en' ? 'en' : 'he'
}

function formatCouponDiscount(
  discountType: string,
  discountValue: number,
  currency: string,
): string {
  // Guard against bad DB data (manual edits, schema drift, NaN/Infinity).
  // Without this a corrupted coupon would render `₪NaN` in the email body.
  if (!Number.isFinite(discountValue)) return ''
  if (discountType === 'percentage') return `${discountValue}%`
  if (discountType === 'fixed') {
    return `${symbolFor(currency)}${(discountValue / 100).toFixed(2)}`
  }
  return String(discountValue)
}

export async function sendPurchaseReceipt(
  options: SendPurchaseReceiptOptions,
): Promise<SendPurchaseReceiptResult> {
  const {
    transactionId,
    userId,
    productId,
    providerTransactionId,
    amount,
    currency,
    userLocale,
    capturedAt,
    appliedCoupon,
  } = options

  // 1) Adapter check FIRST — short-circuit before any DB work so dev/preview
  //    deployments without RESEND_API_KEY don't pay 3 Mongo round-trips per
  //    webhook delivery.
  const resend = getResendClient()
  if (!resend) {
    logger.warn(
      { transactionId },
      'Purchase receipt: RESEND_API_KEY not set — skipping send (no-op fallback)',
    )
    return { sent: false, reason: 'no_adapter' }
  }

  const db = await getContentDb()
  const transactionsCol = db.collection('transactions')
  const txObjectId = new ObjectId(transactionId)

  // 2) Atomic claim — set emailSentAt only if it isn't already set. Any
  //    concurrent call sees the claim and returns already_sent without
  //    invoking Resend.
  const claimedAt = new Date()
  const claim = await transactionsCol.findOneAndUpdate(
    { _id: txObjectId, emailSentAt: { $exists: false } },
    { $set: { emailSentAt: claimedAt, updatedAt: claimedAt } },
  )
  if (!claim) {
    return { sent: false, reason: 'already_sent' }
  }

  // 3) Resolve recipient + product details. The whole block runs under a try
  //    so a thrown findOne (DB blip, primary failover) rolls the claim back
  //    before re-throwing — otherwise emailSentAt would stay set forever and
  //    a future re-attempt (manual or via a follow-up event) would see the
  //    claim and skip the send. Symmetric with the Resend rollback below.
  let userDoc: Document | null
  let productDoc: Document | null
  try {
    ;[userDoc, productDoc] = await Promise.all([
      db
        .collection('users')
        .findOne(
          { _id: objectIdFromString(userId) as unknown as ObjectId },
          { projection: { email: 1, locale: 1 } },
        ),
      db
        .collection('products')
        .findOne(
          { _id: objectIdFromString(productId) as unknown as ObjectId },
          { projection: { name: 1, title: 1 } },
        ),
    ])
  } catch (err) {
    await rollbackClaim(transactionsCol, txObjectId)
    logger.error(
      {
        transactionId,
        userId,
        productId,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      },
      'Purchase receipt: failed to fetch user/product after claim — rolled back claim, propagating error',
    )
    throw err
  }

  const userEmail = (userDoc as { email?: string } | null)?.email
  const productName =
    (productDoc as { name?: string; title?: string } | null)?.name ??
    (productDoc as { name?: string; title?: string } | null)?.title

  if (!userEmail || !productName) {
    await rollbackClaim(transactionsCol, txObjectId)
    logger.warn(
      { transactionId, userId, productId, hasUser: !!userDoc, hasProduct: !!productDoc },
      'Purchase receipt: missing user email or product name — rolled back claim, skipping send',
    )
    return { sent: false, reason: 'missing_data' }
  }

  // 4) Render + send.
  const locale = userLocale ?? pickLocale((userDoc as { locale?: string } | null)?.locale)
  // Use the actual capture timestamp when the caller provided one — that way a
  // webhook delayed by minutes / replayed manually still shows the real
  // purchase date instead of "today".
  const paymentDate = (capturedAt ?? new Date()).toLocaleDateString(
    locale === 'he' ? 'he-IL' : 'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  )

  const templateData: PurchaseReceiptData = {
    productName,
    amount,
    currency,
    transactionId: providerTransactionId,
    paymentDate,
    purchaseLink: PURCHASES_URL,
    ...(appliedCoupon
      ? {
          couponCode: appliedCoupon.code,
          couponDiscount: formatCouponDiscount(
            appliedCoupon.discountType,
            appliedCoupon.discountValue,
            currency,
          ),
          originalAmount: appliedCoupon.originalAmount,
        }
      : {}),
  }

  const html = renderEmailTemplate(locale, templateData)
  const subject =
    locale === 'he' ? `קבלה על רכישת ${productName}` : `Your receipt for ${productName}`

  try {
    const result = await resend.emails.send(
      {
        from: getFromAddress(),
        to: userEmail,
        subject,
        html,
      },
      // Defense in depth: even if a freak race lets two sends slip past our
      // atomic claim, Resend dedupes server-side by this key.
      { idempotencyKey: transactionId },
    )

    if (result.error) {
      await rollbackClaim(transactionsCol, txObjectId)
      logger.error(
        { transactionId, userEmail, error: result.error },
        'Purchase receipt: Resend rejected the send — rolled back claim',
      )
      return { sent: false, reason: 'error' }
    }
  } catch (err) {
    await rollbackClaim(transactionsCol, txObjectId)
    logger.error(
      {
        transactionId,
        userEmail,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      },
      'Purchase receipt: Resend SDK threw — rolled back claim',
    )
    return { sent: false, reason: 'error' }
  }

  return { sent: true }
}

async function rollbackClaim(col: Collection<Document>, txObjectId: ObjectId): Promise<void> {
  try {
    await col.updateOne(
      { _id: txObjectId },
      { $unset: { emailSentAt: '' }, $set: { updatedAt: new Date() } },
    )
  } catch (err) {
    // The slot stays claimed, retries will see already_sent and skip. This
    // is the worst-case "lost receipt" path, but it's bounded to "DB outage
    // during rollback of a failed send" so the surface is tiny.
    logger.error(
      {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      },
      'Purchase receipt: failed to roll back emailSentAt claim — future retries will skip',
    )
  }
}
