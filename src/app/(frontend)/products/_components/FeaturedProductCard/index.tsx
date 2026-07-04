'use client'

import Link from 'next/link'

import type { Product } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ShoppingBag } from 'lucide-react'

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

  return (
    <article
      dir="inherit"
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card transition-all duration-normal hover:shadow-card-hover"
    >
      {/* Accent bar */}
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 w-1.5"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex flex-col gap-content-gap p-card-padding-lg ps-8 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-heading-lg font-black text-card-foreground">
            {product.name ?? product.title ?? 'Product'}
          </h2>
          <p className="text-body-md text-muted-foreground mt-2">{billingLabel}</p>
          {product.description ? (
            <p className="text-body-sm text-muted-foreground/80 mt-3 line-clamp-2 max-w-2xl">
              {product.description}
            </p>
          ) : null}

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-display-sm font-black text-foreground">{priceLabel}</span>
            {billingType === 'subscription' ? (
              <span className="text-body-sm text-muted-foreground">{t('perMonth')}</span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          <Link
            href={detailHref}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-6 py-3 text-body-md font-bold text-primary-foreground transition-all duration-normal hover:bg-primary/90 hover:shadow-elevation-1 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShoppingBag className="w-5 h-5" aria-hidden />
            {t('buyNowButton')}
          </Link>
        </div>
      </div>
    </article>
  )
}
