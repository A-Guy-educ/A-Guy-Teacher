/**
 * Atomic label + value primitive used by every dashboard section.
 *
 * Numeric values are locale-formatted via `useLocale()` from the shared I18n
 * provider so a Hebrew manager sees Hebrew grouping while an English one
 * sees English — no more hardcoded `he-IL`. Strings are passed through as-is
 * (revenue cards already do their own currency-aware formatting).
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Small label + big number card, locale-aware
 */

'use client'

import { cn } from '@/infra/utils/ui'
import { Card, CardContent } from '@/ui/web/components/card'
import { useLocale } from '@/ui/web/providers/I18n'

interface MetricCardProps {
  label: string
  value: number | string
  suffix?: string
  hint?: string
  className?: string
}

export function MetricCard({ label, value, suffix, hint, className }: MetricCardProps) {
  const locale = useLocale()
  const displayValue = typeof value === 'number' ? value.toLocaleString(locale) : value

  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="pt-5 pb-5">
        <p className="text-body-xs text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
        <p className="text-heading-xl font-bold leading-tight">
          {displayValue}
          {suffix && (
            <span className="text-body-sm font-normal text-muted-foreground ml-1">{suffix}</span>
          )}
        </p>
        {hint && <p className="text-body-xs text-muted-foreground mt-2">{hint}</p>}
      </CardContent>
    </Card>
  )
}
