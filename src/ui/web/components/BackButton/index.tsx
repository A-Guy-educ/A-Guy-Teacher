'use client'

import { isRTL } from '@/i18n/config'
import { cn } from '@/infra/utils/ui'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { SystemLink } from '@/infra/loading/components/SystemLink'

interface BackButtonProps {
  href: string
  className?: string
}

export function BackButton({ href, className }: BackButtonProps) {
  const t = useTranslations('courses')
  const locale = useLocale()
  const rtl = isRTL(locale as 'en' | 'he')

  return (
    <SystemLink
      href={href}
      className={cn(
        'inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors duration-normal cursor-pointer',
        className,
      )}
    >
      {rtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
      <span className="text-body-sm">{t('back')}</span>
    </SystemLink>
  )
}
