/**
 * Content library totals — 5 counts across the catalog.
 */

import type { ContentCounts } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'

interface Props {
  counts: ContentCounts
}

export function ContentCountsSection({ counts }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-heading-lg font-semibold">Content library</h2>
      <div className="grid gap-content-gap grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Courses" value={counts.courses} />
        <MetricCard label="Lessons" value={counts.lessons} />
        <MetricCard label="Exercises" value={counts.exercises} />
        <MetricCard label="Formula sheets" value={counts.formulaSheets} />
        <MetricCard label="Prompts" value={counts.prompts} />
      </div>
    </section>
  )
}
