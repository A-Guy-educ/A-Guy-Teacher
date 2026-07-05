'use client'

import type { Product } from '@/infra/types/content'
import { cn } from '@/infra/utils/ui'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import { useTranslations } from '@/ui/web/providers/I18n'

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

interface ProductCardProps {
  product: Product
  /**
   * When true, the card is non-interactive: a real `<button disabled>` reads
   * "בקרוב" instead of linking to the product detail. Used for the soon /
   * free / inactive section of /products — see issue #718.
   */
  disabled?: boolean
}

export function ProductCard({ product, disabled = false }: ProductCardProps) {
  const t = useTranslations('products')
  const currency = (product.currency as string) ?? 'ILS'
  const price = typeof product.price === 'number' ? product.price : 0
  const billingType = (product.billingType as string) ?? 'one_time'
  const accentColor = BILLING_TYPE_COLORS[billingType] ?? BILLING_TYPE_COLORS.one_time

  const priceLabel = formatPrice(price, currency)
  const billingLabel = billingType === 'subscription' ? t('subscriptionLabel') : t('oneTimeLabel')

  if (disabled) {
    // Non-interactive variant — must render a real `<button disabled>` so
    // assistive tech and tests see an actual disabled control, not a
    // passive label. We can't go through UnifiedCard here because its
    // button label gets wrapped in its own clickable <button>.
    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1',
          'transition-all duration-normal opacity-muted',
        )}
        style={{ borderTopWidth: '4px', borderTopColor: accentColor }}
      >
        <div className="p-card-padding flex flex-col gap-content-gap">
          <div className="flex items-start justify-between gap-content-gap-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 text-label font-bold uppercase tracking-wider text-muted-foreground">
              {priceLabel}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-heading-md font-bold text-card-foreground leading-snug mb-1">
              {product.name ?? 'Product'}
            </h3>
            <p className="text-body-sm text-muted-foreground line-clamp-2">{billingLabel}</p>
          </div>

          <div className="border-t border-border/40 pt-4 mt-auto">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="min-h-[44px] w-full cursor-not-allowed rounded-lg bg-muted px-6 py-2.5 text-body-sm font-bold text-muted-foreground"
            >
              {t('soonButton')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <UnifiedCard
      title={product.name ?? 'Product'}
      description={billingLabel}
      label={priceLabel}
      accentColor={accentColor}
      variant="lesson"
      cardHref={`/products/${product.slug}`}
    />
  )
}
