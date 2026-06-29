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
  index: number
  t: ReturnType<typeof useTranslations>
}

function ContentLine({ block, index, t }: ContentLineProps) {
  if (block.blockType === 'courseBlock') {
    if (!isPopulatedCourse(block.course)) return null
    const title = block.course.title ?? t('items.unnamed')
    return (
      <li
        key={index}
        className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground"
      >
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
    // Numeric features render as "{limit} {label} / {period}" when both are set.
    let display = label
    if (limit !== null) {
      const periodLabel = period ? t(`items.periods.${period}`) : null
      display = periodLabel ? `${limit} ${label} / ${periodLabel}` : `${limit} ${label}`
    }
    return (
      <li
        key={index}
        className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        {display}
      </li>
    )
  }

  return null
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
        {(() => {
          const contents = Array.isArray(product.contents) ? product.contents : []
          // Pre-filter so we don't render an empty "What's included" section
          // when every featureBlock is silent and there are no courseBlocks.
          const visible = contents.filter((block) => {
            if (block.blockType === 'featureBlock') {
              return isPopulatedFeature(block.feature) && !block.feature.isSilent
            }
            if (block.blockType === 'courseBlock') {
              return isPopulatedCourse(block.course)
            }
            return false
          })
          if (visible.length === 0) return null
          return (
            <div className="p-card-padding-lg border-b border-border/40">
              <h2 className="text-heading-sm font-bold text-card-foreground mb-4">
                {t('includedItems')}
              </h2>
              <ul className="space-y-2">
                {visible.map((block, index) => (
                  <ContentLine key={index} block={block} index={index} t={t} />
                ))}
              </ul>
            </div>
          )
        })()}

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
