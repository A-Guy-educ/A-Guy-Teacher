/**
 * Purchases Page
 *
 * /account/purchases - Lists all user transactions sorted by date desc
 *
 * @fileType page
 * @domain billing
 */

import { notFound } from 'next/navigation'

import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { getMeUser } from '@/infra/utils/getMeUser'
import { queryUserTransactions } from '@/server/repos/queries/transactions'
import type { Metadata } from 'next'
import { PurchasesPageContent } from './PurchasesPageContent'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ next?: string }>
}

export async function generateMetadata(_props: Props): Promise<Metadata> {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'הרכישות שלי' : 'My Purchases',
    description: isHebrew ? 'צפה בהיסטוריית הרכישות שלך' : 'View your purchase history',
  })
}

export default async function PurchasesPage({ searchParams: searchParamsPromise }: Props) {
  const { next } = await searchParamsPromise

  // Auth gate - redirect to login with returnTo if not authenticated
  const { user } = await getMeUser({
    nullUserRedirect: next
      ? `/login?returnTo=${encodeURIComponent(next)}`
      : '/login?returnTo=/account/purchases',
  })

  if (!user) {
    notFound()
  }

  const [locale, transactions] = await Promise.all([
    getSystemLocale(),
    queryUserTransactions(user.id),
  ])

  return (
    <div dir={getDirection(locale)}>
      <PurchasesPageContent transactions={transactions} />
    </div>
  )
}
