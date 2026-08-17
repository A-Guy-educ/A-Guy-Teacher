/**
 * Segmented period selector for the dashboard. Wraps three Buttons with
 * variant swap so the active period reads as filled and inactive as ghost.
 */

'use client'

import { Button } from '@/ui/web/components/button'
import type { Period } from '@/server/services/dashboard/metrics-types'

const OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
  disabled?: boolean
}

export function PeriodSelector({ value, onChange, disabled }: PeriodSelectorProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-background p-1 gap-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'default' : 'ghost'}
          onClick={() => onChange(option.value)}
          disabled={disabled}
          aria-pressed={value === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
