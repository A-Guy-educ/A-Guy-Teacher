'use client'

import Link from 'next/link'

import type { Product } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { BookOpen, Check, ShoppingBag } from 'lucide-react'

const BILLING_TYPE_COLORS: Record<string, string> = {
  one_time: 'hsl(142 71% 45%)',
  subscription: 'hsl(217 91% 60%)',
}

function formatPrice(price: number, currency: string): string {
  const formatter = new Intl.NumberFormat(currency === 'ILS' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return formatter.format(price)
}

interface FeaturedProductCardProps {
  product: Product
}

/**
 * Big featured card for active products on /products. One card stacks per
 * product (vertical column). The CTA is an inline button that navigates to
 * the product detail page — the button is the action, not the whole card.
 */
export function FeaturedProductCard({ product }: FeaturedProductCardProps) {
  const t = useTranslations('products')
  const currency = (product.currency as string) ?? 'ILS'
  const price = typeof product.price === 'number' ? product.price : 0
  const billingType = (product.billingType as string) ?? 'one_time'
  const accentColor = BILLING_TYPE_COLORS[billingType] ?? BILLING_TYPE_COLORS.one_time

  const priceLabel = formatPrice(price, currency)
  const billingLabel = billingType === 'subscription' ? t('subscriptionLabel') : t('oneTimeLabel')
  const detailHref = product.slug ? `/products/${product.slug}` : '/products'
  const bullets = ['lessons', 'practice', 'support'] as const

  return (
    <article
      dir="inherit"
      className="relative overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1 transition-all duration-normal hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 w-1.5"
        style={{ backgroundColor: accentColor }}
      />

      <div className="grid gap-content-gap p-card-padding ps-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-content-gap-xs rounded-full bg-success/10 px-3 py-1 text-label font-bold text-success">
            <BookOpen className="h-3 w-3" aria-hidden />
            {t('featuredSectionTitle')}
          </span>
          <h2 className="mt-3 text-heading-lg font-black text-card-foreground">
            {product.name ?? product.title ?? 'Product'}
          </h2>
          <p className="text-body-md text-muted-foreground mt-2">{billingLabel}</p>
          {product.description ? (
            <p className="text-body-sm text-muted-foreground/80 mt-3 line-clamp-2 max-w-2xl">
              {product.description}
            </p>
          ) : null}

          <div className="mt-5 grid gap-content-gap-xs sm:grid-cols-3">
            {bullets.map((bullet) => (
              <div
                key={bullet}
                className="flex items-center gap-content-gap-xs rounded-lg border border-border bg-background px-3 py-2 text-body-sm font-bold text-foreground"
              >
                <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                {t(`planBullets.${bullet}`)}
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-between gap-content-gap-sm rounded-lg border border-border bg-background p-card-padding-sm">
          <div className="flex items-baseline gap-content-gap-xs">
            <span className="text-display-sm font-black text-foreground">{priceLabel}</span>
            {billingType === 'subscription' ? (
              <span className="text-body-sm text-muted-foreground">{t('perMonth')}</span>
            ) : null}
          </div>
          <Link
            href={detailHref}
            className="inline-flex min-h-11 items-center justify-center gap-content-gap-xs whitespace-nowrap rounded-lg bg-primary px-6 py-3 text-body-md font-bold text-primary-foreground transition-all duration-normal hover:bg-primary/90 hover:shadow-elevation-1 active:scale-[0.98]"
          >
            <ShoppingBag className="w-5 h-5" aria-hidden />
            {t('buyNowButton')}
          </Link>
        </div>
      </div>
    </article>
  )
}
