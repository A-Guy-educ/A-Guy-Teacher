/**
 * Checkout Success Page
 *
 * Displays payment confirmation after Stripe/PayPal redirects back from checkout.
 * Fetches the transaction by session ID (providerTransactionId) and shows:
 * - Confirmed: Payment received, access granted
 * - Pending: Payment received, processing access (webhook timing)
 *
 * @fileType page
 * @domain billing
 */

import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { queryTransactionByProviderId } from '@/server/repos/queries/transactions'
import type { Metadata } from 'next'
import { CheckoutSuccessContent } from './CheckoutSuccessContent'

// The lookup is keyed on cookies-bearing request data and reads from Mongo at
// request time. Force-dynamic so Next.js doesn't try to pre-render it.
export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ session_id?: string; token?: string; provider?: string }>
}

export async function generateMetadata({
  searchParams: _searchParamsPromise,
}: Props): Promise<Metadata> {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'תשלום הושלם' : 'Payment Confirmed',
    description: isHebrew ? 'התשלום הושלם בהצלחה' : 'Your payment was successfully processed',
  })
}

export default async function CheckoutSuccessPage({ searchParams: searchParamsPromise }: Props) {
  // session_id is Stripe; token is PayPal. Either way it maps to the same
  // providerTransactionId field we wrote at checkout time.
  const { session_id, token } = await searchParamsPromise
  const lookupId = session_id ?? token

  const [locale, transaction] = await Promise.all([
    getSystemLocale(),
    lookupId ? queryTransactionByProviderId(lookupId) : Promise.resolve(null),
  ])

  return (
    <div
      className="min-h-screen text-card-foreground antialiased flex items-center justify-center"
      dir={getDirection(locale)}
    >
      <CheckoutSuccessContent
        sessionId={lookupId}
        transaction={transaction ? { id: transaction.id, status: transaction.status } : null}
        productName={transaction?.productName ?? ''}
        firstCourse={transaction?.firstCourse ?? null}
      />
    </div>
  )
}
