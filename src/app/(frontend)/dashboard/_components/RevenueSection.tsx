/**
 * Revenue — totals by currency, refunded/failed, success rate, top 5
 * products by revenue in the selected period.
 *
 * All amounts arrive in agorot (1 shekel = 100 agorot) — display converts
 * to major units.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import type { RevenueMetrics } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'

interface Props {
  revenue: RevenueMetrics
}

const CURRENCY_SYMBOL: Record<string, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
}

function formatMajor(agorot: number, currency: string): string {
  const major = agorot / 100
  const symbol = CURRENCY_SYMBOL[currency] ?? currency
  return `${symbol}${major.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function RevenueSection({ revenue }: Props) {
  const currencies = Object.entries(revenue.totalRevenueAgorot).filter(([, amount]) => amount > 0)
  const totalRow =
    currencies.length > 0 ? currencies : Object.entries(revenue.totalRevenueAgorot).slice(0, 1)

  return (
    <section className="space-y-6">
      <h2 className="text-heading-lg font-semibold">Revenue</h2>

      {/* Totals by currency */}
      <div className="grid gap-content-gap grid-cols-1 md:grid-cols-3">
        {totalRow.map(([currency, amount]) => (
          <MetricCard
            key={currency}
            label={`Revenue (${currency})`}
            value={formatMajor(amount, currency)}
          />
        ))}
      </div>

      {/* Failure / refund summary */}
      <div className="grid gap-content-gap grid-cols-2 md:grid-cols-4">
        <MetricCard label="Transactions" value={revenue.transactionCount} />
        <MetricCard label="Success rate" value={revenue.successRate} suffix="%" />
        <MetricCard label="Refunded (ILS)" value={formatMajor(revenue.refundedAgorot, 'ILS')} />
        <MetricCard label="Failed (ILS)" value={formatMajor(revenue.failedAgorot, 'ILS')} />
      </div>

      {/* Top products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">Top products in period</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {revenue.topProducts.length === 0 ? (
            <p className="text-body-sm text-muted-foreground py-section-xs">
              No paid transactions in this period.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {revenue.topProducts.map((product) => {
                const isDeleted = product.productName.startsWith('__DELETED__:')
                return (
                  <li key={product.productName} className="flex items-center justify-between py-3">
                    <span
                      className={isDeleted ? 'text-muted-foreground italic' : 'text-foreground'}
                    >
                      {isDeleted
                        ? `Deleted product (${product.productName.replace('__DELETED__:', '')})`
                        : product.productName}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMajor(product.agorot, 'ILS')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
