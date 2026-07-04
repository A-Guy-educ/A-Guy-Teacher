/**
 * Products Catalog Page
 *
 * Two sections driven by product.status from the DB:
 *   1. Active products → big featured cards stacked vertically
 *   2. Soon / free / inactive → compact grid with disabled "בקרוב" button
 *
 * Adding a product in the admin with status='active' surfaces it in
 * Section 1 with no code change — see issue #718.
 *
 * @fileType page
 * @domain billing
 */

import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { queryActiveProducts, querySoonProducts } from '@/server/repos/queries/products'
import { FeaturedProductCard } from './_components/FeaturedProductCard'
import { ProductCardGrid } from './_components/ProductCardGrid'
import { ProductsHeader } from './_components/ProductsHeader'
import { ProductsSectionTitle } from './_components/ProductsSectionTitle'
import { EmptyProducts } from './_components/EmptyProducts'

export const revalidate = 60

export default async function ProductsPage() {
  const locale = await getSystemLocale()
  const [activeProducts, soonProducts] = await Promise.all([
    queryActiveProducts(),
    querySoonProducts(),
  ])

  const hasAny = activeProducts.length > 0 || soonProducts.length > 0

  return (
    <div className="min-h-screen text-card-foreground antialiased" dir={getDirection(locale)}>
      <ProductsHeader />

      <div className="max-w-6xl mx-auto px-6 py-section-md">
        {!hasAny ? (
          <EmptyProducts />
        ) : (
          <div className="flex flex-col gap-section-xs">
            {activeProducts.length > 0 ? (
              <section aria-labelledby="products-featured-title">
                <ProductsSectionTitle translationKey="featuredSectionTitle" />
                <div className="flex flex-col gap-content-gap">
                  {activeProducts.map((product) => (
                    <FeaturedProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ) : null}

            {soonProducts.length > 0 ? (
              <section aria-labelledby="products-soon-title">
                <ProductsSectionTitle translationKey="soonSectionTitle" />
                <ProductCardGrid products={soonProducts} disabled />
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export async function generateMetadata() {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'חנות המוצרים' : 'Products',
    description: isHebrew ? 'עיין במוצרים הזמינים שלנו' : 'Browse our available products',
  })
}
