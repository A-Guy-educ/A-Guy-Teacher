/**
 * Purchase Receipt Email Service
 *
 * Sends a templated purchase receipt email to the user after a successful
 * payment. Web-direct against the Resend SDK — does not depend on the Payload
 * runtime (which was removed from this repo). Templates are pure functions
 * shared with the (defunct) Payload-side service.
 *
 * Behavior:
 *  - Idempotent via `transactions.emailSentAt`: subsequent calls for the same
 *    transaction skip the send.
 *  - No-op when `RESEND_API_KEY` is missing — logs a warn and returns
 *    `{ sent: false, reason: 'no_adapter' }` so the calling webhook can still
 *    return 200 in dev / preview environments.
 *  - Never throws on send failure — returns `{ sent: false, reason: 'error' }`
 *    and logs. The caller's responsibility is to mark the transaction as
 *    "tried" if it cares, but we deliberately do NOT set `emailSentAt` on a
 *    failed send so a retry can pick it up.
 *
 * @fileType service
 * @domain email
 */

import { ObjectId } from 'mongodb'
import { Resend } from 'resend'

import { getContentDb } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

import {
  buildPurchaseReceiptEmailEN,
  buildPurchaseReceiptEmailHE,
  type PurchaseReceiptData,
} from '../templates/purchase-receipt'

const PURCHASES_URL = '/account/purchases'
const DEFAULT_FROM = 'support@aguy.co.il'
const SUPPORTED_LOCALES = ['en', 'he'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export interface SendPurchaseReceiptOptions {
  transactionId: string
  userId: string
  productId: string
  providerTransactionId: string
  amount: number
  currency: string
  /** Defaults to the user's stored locale, or 'he' if missing. */
  userLocale?: SupportedLocale
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

function formatCouponDiscount(discountType: string, discountValue: number): string {
  if (discountType === 'percentage') return `${discountValue}%`
  if (discountType === 'fixed') return `$${(discountValue / 100).toFixed(2)}`
  return String(discountValue)
}

function asObjectIdOrString(value: string): ObjectId | string {
  return ObjectId.isValid(value) ? new ObjectId(value) : value
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
    appliedCoupon,
  } = options

  const db = await getContentDb()
  const transactionsCol = db.collection('transactions')

  // 1) Idempotency — skip if we already sent a receipt for this transaction.
  const existing = await transactionsCol.findOne(
    { _id: new ObjectId(transactionId) },
    { projection: { emailSentAt: 1 } },
  )
  if (existing?.emailSentAt) {
    return { sent: false, reason: 'already_sent' }
  }

  // 2) Resolve user email + product name. Don't catch — let DB outages bubble
  //    so the caller can decide (we return error below if the fetch returns
  //    nothing meaningful).
  const [userDoc, productDoc] = await Promise.all([
    db
      .collection('users')
      .findOne({ _id: asObjectIdOrString(userId) }, { projection: { email: 1, locale: 1 } }),
    db
      .collection('products')
      .findOne({ _id: asObjectIdOrString(productId) }, { projection: { name: 1, title: 1 } }),
  ])

  const userEmail = (userDoc as { email?: string } | null)?.email
  const productName =
    (productDoc as { name?: string; title?: string } | null)?.name ??
    (productDoc as { name?: string; title?: string } | null)?.title

  if (!userEmail || !productName) {
    logger.warn(
      { transactionId, userId, productId, hasUser: !!userDoc, hasProduct: !!productDoc },
      'Purchase receipt: missing user email or product name — skipping send',
    )
    return { sent: false, reason: 'missing_data' }
  }

  const locale = userLocale ?? pickLocale((userDoc as { locale?: string } | null)?.locale)
  const paymentDate = new Date().toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

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
          ),
          originalAmount: appliedCoupon.originalAmount,
        }
      : {}),
  }

  const html = renderEmailTemplate(locale, templateData)
  const subject =
    locale === 'he' ? `קבלה על רכישת ${productName}` : `Your receipt for ${productName}`

  // 3) Send. If no API key configured, no-op cleanly so dev / preview don't break.
  const resend = getResendClient()
  if (!resend) {
    logger.warn(
      { transactionId, userEmail, productName },
      'Purchase receipt: RESEND_API_KEY not set — skipping send (no-op fallback)',
    )
    return { sent: false, reason: 'no_adapter' }
  }

  try {
    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to: userEmail,
      subject,
      html,
    })

    // Resend SDK returns `{ data, error }` — surface either, but never throw.
    if (result.error) {
      logger.error(
        { transactionId, userEmail, error: result.error },
        'Purchase receipt: Resend rejected the send',
      )
      return { sent: false, reason: 'error' }
    }
  } catch (err) {
    logger.error(
      {
        transactionId,
        userEmail,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      },
      'Purchase receipt: Resend SDK threw',
    )
    return { sent: false, reason: 'error' }
  }

  // 4) Mark the transaction so retries don't re-send. Failures here are
  //    non-fatal — the email did go out — but log them.
  try {
    await transactionsCol.updateOne(
      { _id: new ObjectId(transactionId) },
      { $set: { emailSentAt: new Date(), updatedAt: new Date() } },
    )
  } catch (err) {
    logger.error(
      {
        transactionId,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      },
      'Purchase receipt: failed to set emailSentAt — receipt was sent, retry may double-send',
    )
  }

  return { sent: true }
}
