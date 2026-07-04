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
  return <h2 className="text-heading-xl font-bold mb-6">{t(translationKey)}</h2>
}
