/**
 * Tiny inline badge showing period-over-period growth as ▲ +12% (green)
 * or ▼ -5% (red). Returns null when the prior value is 0 (no baseline —
 * showing an infinite arrow would be misleading).
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Growth% arrow badge for dashboard metric cards
 */

'use client'

import { cn } from '@/infra/utils/ui'

interface TrendBadgeProps {
  current: number
  prior: number
  suffix?: string
}

export function TrendBadge({ current, prior, suffix }: TrendBadgeProps) {
  if (prior === 0) return null
  const pct = ((current - prior) / prior) * 100
  const rounded = Math.round(pct)
  // Zero-delta reads as "no change" rather than a green up-arrow — showing
  // a positive badge for a flat trend is semantically misleading.
  if (rounded === 0) return null
  const isPositive = rounded > 0
  const arrow = isPositive ? '▲' : '▼'
  const sign = isPositive ? '+' : ''

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-body-xs font-semibold',
        isPositive ? 'bg-success/10 text-success' : 'bg-error/10 text-error',
      )}
    >
      <span aria-hidden>{arrow}</span>
      <span>
        {sign}
        {rounded}% {suffix}
      </span>
    </span>
  )
}
