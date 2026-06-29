'use client'

import { useState } from 'react'
import Link from 'next/link'

import type {
  Product,
  ProductContentBlock,
  ProductCourseRef,
  ProductFeatureRef,
} from '@/infra/types/content'
import { BuyButton } from './BuyButton'
import { CouponInput } from './CouponInput'
import { useTranslations } from '@/ui/web/providers/I18n'

interface ProductDetailContentProps {
  product: Product
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

function isPopulatedCourse(course: unknown): course is ProductCourseRef {
  return !!course && typeof course === 'object' && 'id' in course
}

function isPopulatedFeature(feature: unknown): feature is ProductFeatureRef {
  return !!feature && typeof feature === 'object' && 'id' in feature
}

interface ContentLineProps {
  block: ProductContentBlock
  t: ReturnType<typeof useTranslations>
}

function ContentLine({ block, t }: ContentLineProps) {
  if (block.blockType === 'courseBlock') {
    if (!isPopulatedCourse(block.course)) return null
    const title = block.course.title ?? t('items.unnamed')
    return (
      <li className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        {title}
      </li>
    )
  }

  if (block.blockType === 'featureBlock') {
    if (!isPopulatedFeature(block.feature)) return null
    // Silent features (e.g. background chat-limit) are intentionally hidden
    // from the storefront — admin marks them isSilent=true so the buyer never
    // sees the limit value before purchase.
    if (block.feature.isSilent) return null
    const label = block.feature.label ?? block.feature.key ?? t('items.unnamed')
    const limit = block.limit ?? null
    const period = block.period ?? null
    // Boolean features have no limit / period → just show the label.
    // Numeric features render as "{limit} {label} {period}" where the period
    // value carries its own preposition for the locale (EN: "per day", HE:
    // "ליום"). Joining with a plain space keeps both renderings idiomatic
    // and avoids the double-"per" problem the slash separator caused in HE.
    let display = label
    if (limit !== null) {
      const periodLabel = period ? t(`items.periods.${period}`) : null
      display = periodLabel ? `${limit} ${label} ${periodLabel}` : `${limit} ${label}`
    }
    return (
      <li className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        {display}
      </li>
    )
  }

  return null
}

/**
 * Stable React key for a content block — uses the populated id when
 * available so admin reorders don't cause DOM nodes to be reused across
 * logically different blocks. Falls back to the position index only when
 * the block hasn't been populated yet (e.g. mid-migration).
 */
function blockKey(block: ProductContentBlock, index: number): string {
  if (block.blockType === 'courseBlock' && isPopulatedCourse(block.course)) {
    return `course:${block.course.id}`
  }
  if (block.blockType === 'featureBlock' && isPopulatedFeature(block.feature)) {
    return `feature:${block.feature.id}`
  }
  return `idx:${index}`
}

export function ProductDetailContent({ product }: ProductDetailContentProps) {
  const t = useTranslations('products')
  const currency = (product.currency as string) ?? 'ILS'
  const price = typeof product.price === 'number' ? product.price : 0
  const billingType = (product.billingType as string) ?? 'one_time'

  const billingLabel = billingType === 'subscription' ? t('subscriptionLabel') : t('oneTimeLabel')

  const interval = (product.interval as string) ?? 'month'
  const intervalLabel = interval === 'year' ? t('perYear') : t('perMonth')

  const priceDisplay = formatPrice(price, currency)
  const periodDisplay = billingType === 'subscription' ? ` / ${intervalLabel}` : ''

  const [couponCode, setCouponCode] = useState<string>('')
  const [discountedAmount, setDiscountedAmount] = useState<number | null>(null)

  // Pre-filter the contents blocks so the "What's included" section header
  // isn't rendered when every featureBlock is silent and there are no
  // courseBlocks. Computed here (not inline) so the JSX stays readable.
  const visibleBlocks = (Array.isArray(product.contents) ? product.contents : []).filter(
    (block) => {
      if (block.blockType === 'featureBlock') {
        return isPopulatedFeature(block.feature) && !block.feature.isSilent
      }
      if (block.blockType === 'courseBlock') {
        return isPopulatedCourse(block.course)
      }
      return false
    },
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-section-md">
      {/* Breadcrumb */}
      <nav className="mb-8" aria-label="breadcrumb">
        <ol className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground">
          <li>
            <Link
              href="/products"
              className="hover:text-foreground transition-colors duration-normal"
            >
              {t('catalogTitle')}
            </Link>
          </li>
          <li className="text-muted-foreground/50">/</li>
          <li className="text-foreground font-medium" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Product Card */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        {/* Header */}
        <div className="p-card-padding-lg border-b border-border/40">
          <div className="flex items-start justify-between gap-content-gap">
            <div className="flex-1">
              <h1 className="text-heading-xl font-black text-card-foreground">{product.name}</h1>
              <p className="text-body-lg text-muted-foreground mt-2">{billingLabel}</p>
            </div>
            <div className="text-end">
              {discountedAmount !== null && discountedAmount < price * 100 ? (
                <>
                  <span className="text-display-sm font-black text-primary">
                    {formatPrice(discountedAmount, currency)}
                  </span>
                  <span className="text-body-sm text-muted-foreground line-through ms-2">
                    {priceDisplay}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-display-sm font-black text-primary">{priceDisplay}</span>
                  <span className="text-body-md text-muted-foreground">{periodDisplay}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Product Contents — courseBlock + non-silent featureBlock */}
        {visibleBlocks.length > 0 && (
          <div className="p-card-padding-lg border-b border-border/40">
            <h2 className="text-heading-sm font-bold text-card-foreground mb-4">
              {t('includedItems')}
            </h2>
            <ul className="space-y-2">
              {visibleBlocks.map((block, index) => (
                <ContentLine key={blockKey(block, index)} block={block} t={t} />
              ))}
            </ul>
          </div>
        )}

        {/* Actions: Coupon + Buy */}
        <div className="p-card-padding-lg">
          <CouponInput
            productId={product.id}
            currency={currency}
            onCouponValidated={(code, _orig, discounted) => {
              setCouponCode(code)
              setDiscountedAmount(discounted)
            }}
            onCouponCleared={() => {
              setCouponCode('')
              setDiscountedAmount(null)
            }}
          />
          <div className="mt-6">
            <BuyButton
              productId={product.id}
              productSlug={product.slug ?? ''}
              productName={product.name ?? ''}
              couponCode={couponCode || undefined}
              discountedAmount={discountedAmount ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
