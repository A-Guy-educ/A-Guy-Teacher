/**
 * Product Detail Page
 *
 * Displays product details (name, description, price, items) with a Buy button.
 * Authenticated users proceed to checkout; unauthenticated users are redirected to login.
 *
 * @fileType page
 * @domain billing
 */

import { notFound } from 'next/navigation'
import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { queryProductBySlug } from '@/server/repos/queries/products'
import { ProductDetailContent } from './ProductDetailContent'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function ProductDetailPage({ params: paramsPromise }: Props) {
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const product = await queryProductBySlug({ slug: decodedSlug })

  if (!product) {
    notFound()
  }

  const locale = await getSystemLocale()

  return (
    <div className="min-h-screen text-card-foreground antialiased" dir={getDirection(locale)}>
      <ProductDetailContent product={product} />
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Props) {
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const product = await queryProductBySlug({ slug: decodedSlug })

  if (!product) {
    return {}
  }

  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'
  const productName = product.name || product.title

  return pageMetadata({
    title: productName,
    description: isHebrew ? `רכוש את ${productName} עכשיו` : `Purchase ${productName} now`,
  })
}
