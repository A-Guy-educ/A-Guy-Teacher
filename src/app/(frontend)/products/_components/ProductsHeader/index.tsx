'use client'

import { BookOpen, Brain, ClipboardCheck } from 'lucide-react'

import { useTranslations } from '@/ui/web/providers/I18n'

export function ProductsHeader() {
  const t = useTranslations('products')
  const highlights = [
    { key: 'lessons', icon: BookOpen },
    { key: 'practice', icon: ClipboardCheck },
    { key: 'support', icon: Brain },
  ] as const

  return (
    <header className="border-b border-border bg-background pb-section-md pt-section-md">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <h1 className="mx-auto max-w-3xl text-display-sm font-black text-card-foreground md:text-display-md">
          {t('catalogTitle')}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-body-lg leading-relaxed text-muted-foreground">
          {t('catalogDescription')}
        </p>
        <div className="mx-auto mt-8 grid max-w-3xl gap-content-gap-sm sm:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.key}
                className="flex min-h-20 items-center justify-center gap-content-gap-xs rounded-lg border border-border bg-card px-4 text-body-sm font-bold text-foreground shadow-elevation-1"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {t(`highlights.${item.key}`)}
              </div>
            )
          })}
        </div>
      </div>
    </header>
  )
}
