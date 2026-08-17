/**
 * Small numeric metric card — the atomic unit of every dashboard section.
 *
 * Deliberately simpler than the admin's MetricCard (no trend badges, no
 * tooltips). If the manager wants those back later, extend here.
 */

import { Card, CardContent } from '@/ui/web/components/card'
import { cn } from '@/infra/utils/ui'

interface MetricCardProps {
  label: string
  value: number | string
  suffix?: string
  hint?: string
  className?: string
}

export function MetricCard({ label, value, suffix, hint, className }: MetricCardProps) {
  const displayValue = typeof value === 'number' ? value.toLocaleString('he-IL') : value

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
