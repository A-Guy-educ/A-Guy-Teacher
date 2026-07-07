/**
 * Bug Report Email Service
 *
 * Sends a templated bug report email to the office inbox when a user files a report
 * from the in-app floating "Report a Bug" widget. Mirrors the
 * `purchase-receipt-service` shape so the two email services can evolve together.
 *
 * Concurrency model:
 *  - Inherits Resend's own `idempotencyKey` (set to a per-request key) so a
 *    double-submit on slow networks or a refresh-storm still dedupes
 *    server-side.
 *
 * Other guarantees:
 *  - No-op when `RESEND_API_KEY` is missing (returns `no_adapter`). Checked
 *    FIRST so dev/preview environments without a key still 200 — same pattern
 *    as `purchase-receipt-service`.
 *  - Never throws on send failure — the caller's API route can still return
 *    200 with `delivered: false` so the user-facing toast shows a clear
 *    error rather than a stack trace.
 *
 * @fileType service
 * @domain email
 * @pattern bug-report
 * @ai-summary Sends bug report emails to office@guykoren.co.il via Resend with idempotency-key dedup.
 */

import { Resend } from 'resend'

import { logger } from '@/infra/utils/logger/logger'

import {
  buildBugReportEmailEN,
  buildBugReportEmailENPlainText,
  buildBugReportEmailHE,
  buildBugReportEmailHEPlainText,
  type BugReportEmailData,
} from '../templates/bug-report'

// Fallback recipient per issue #764. Override per environment with
// BUG_REPORT_RECIPIENT if you ever need a staging inbox.
export const BUG_REPORT_RECIPIENT = 'office@guykoren.co.il'
const FALLBACK_FROM = 'support@aguy.co.il'
function getFromAddress(): string {
  return process.env.RESEND_FROM || FALLBACK_FROM
}

type SupportedLocale = 'en' | 'he'

const SITE_NAME = 'A-Guy'

export type SendBugReportResult =
  | { delivered: true }
  | { delivered: false; reason: 'no_adapter' | 'error' }

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

function pickLocale(rawLocale: unknown): SupportedLocale {
  return rawLocale === 'en' ? 'en' : 'he'
}

export interface SendBugReportOptions {
  description: string
  contactEmail?: string | null
  pageUrl: string
  userAgent: string
  submittedAt?: Date
  userLocale?: string
  userId?: string | null
  userEmail?: string | null
  /**
   * Stable per-request key used as the Resend idempotency key so a retried
   * submission (e.g. a refresh storm) only ever results in one outgoing email.
   * Falls back to a random UUID at the call site when not provided.
   */
  idempotencyKey?: string
}

export async function sendBugReport(options: SendBugReportOptions): Promise<SendBugReportResult> {
  const {
    description,
    contactEmail,
    pageUrl,
    userAgent,
    submittedAt,
    userLocale,
    userId,
    userEmail,
    idempotencyKey,
  } = options

  // 1) Adapter check FIRST — short-circuit before any work so dev/preview
  //    deployments without RESEND_API_KEY don't pay a network round-trip.
  const resend = getResendClient()
  if (!resend) {
    logger.warn(
      { recipient: BUG_REPORT_RECIPIENT },
      'Bug report: RESEND_API_KEY not set — skipping send (no-op fallback)',
    )
    return { delivered: false, reason: 'no_adapter' }
  }

  const locale = pickLocale(userLocale)
  const submittedAtDate = submittedAt ?? new Date()
  const submittedAtString = submittedAtDate.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US')

  const templateData: BugReportEmailData = {
    description,
    contactEmail: contactEmail ?? null,
    pageUrl,
    userAgent,
    submittedAt: submittedAtString,
    userId: userId ?? null,
    userEmail: userEmail ?? null,
  }

  const html =
    locale === 'he' ? buildBugReportEmailHE(templateData) : buildBugReportEmailEN(templateData)
  const text =
    locale === 'he'
      ? buildBugReportEmailHEPlainText(templateData)
      : buildBugReportEmailENPlainText(templateData)
  const subject = locale === 'he' ? `דיווח על תקלה — ${SITE_NAME}` : `Bug report — ${SITE_NAME}`

  try {
    const result = await resend.emails.send(
      {
        from: getFromAddress(),
        to: BUG_REPORT_RECIPIENT,
        replyTo: contactEmail || undefined,
        subject,
        html,
        text,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    )

    if (result.error) {
      logger.error(
        { recipient: BUG_REPORT_RECIPIENT, error: result.error },
        'Bug report: Resend rejected the send',
      )
      return { delivered: false, reason: 'error' }
    }

    return { delivered: true }
  } catch (err) {
    logger.error(
      {
        recipient: BUG_REPORT_RECIPIENT,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      },
      'Bug report: Resend SDK threw',
    )
    return { delivered: false, reason: 'error' }
  }
}
