/**
 * Segmented period selector for the dashboard. Wraps three Buttons with
 * variant swap so the active period reads as filled and inactive as ghost.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Week/Month/Year picker for dashboard metrics
 */

'use client'

import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { Period } from '@/server/services/dashboard/metrics-types'

const OPTIONS: readonly Period[] = ['week', 'month', 'year']

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
  disabled?: boolean
}

export function PeriodSelector({ value, onChange, disabled }: PeriodSelectorProps) {
  const t = useTranslations('dashboard.period')

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-background p-1 gap-1">
      {OPTIONS.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={value === option ? 'default' : 'ghost'}
          onClick={() => onChange(option)}
          disabled={disabled}
          aria-pressed={value === option}
        >
          {t(option)}
        </Button>
      ))}
    </div>
  )
}
