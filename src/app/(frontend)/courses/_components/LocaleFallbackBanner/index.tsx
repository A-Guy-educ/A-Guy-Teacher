'use client'

import { Globe } from 'lucide-react'
import { Card, CardContent } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'

interface LocaleFallbackBannerProps {
  isLocaleFallback?: boolean
}

export function LocaleFallbackBanner({ isLocaleFallback }: LocaleFallbackBannerProps) {
  const tCommon = useTranslations('common.languageSwitcher')

  if (!isLocaleFallback) {
    return null
  }

  return (
    <Card className="bg-warning/10 border-warning/30 animate-fade-in">
      <CardContent className="p-card-padding flex flex-row items-start gap-content-gap-sm">
        <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
          <Globe className="w-5 h-5 text-warning" />
        </div>
        <p className="text-body-sm text-warning">{tCommon('fallbackNotice')}</p>
      </CardContent>
    </Card>
  )
}
