'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

interface ProductsSectionTitleProps {
  /**
   * i18n key under the `products` namespace — `featuredSectionTitle` or
   * `soonSectionTitle`. Names rather than strings so translations stay
   * derived from the message catalog.
   */
  translationKey: 'featuredSectionTitle' | 'soonSectionTitle'
}

export function ProductsSectionTitle({ translationKey }: ProductsSectionTitleProps) {
  const t = useTranslations('products')
  return (
    <h2 className="mb-5 flex items-center gap-content-gap-xs text-heading-md font-extrabold text-foreground">
      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
      {t(translationKey)}
    </h2>
  )
}
