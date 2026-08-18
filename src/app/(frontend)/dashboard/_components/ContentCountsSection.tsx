/**
 * Content library totals — 5 counts across the catalog.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Cards for courses / lessons / exercises / formula sheets / prompts
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import type { ContentCounts } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'

interface Props {
  counts: ContentCounts
}

export function ContentCountsSection({ counts }: Props) {
  const t = useTranslations('dashboard.content')

  return (
    <section className="space-y-4">
      <h2 className="text-heading-lg font-semibold">{t('section')}</h2>
      <div className="grid gap-content-gap grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label={t('courses')} value={counts.courses} />
        <MetricCard label={t('lessons')} value={counts.lessons} />
        <MetricCard label={t('exercises')} value={counts.exercises} />
        <MetricCard label={t('formulaSheets')} value={counts.formulaSheets} />
        <MetricCard label={t('prompts')} value={counts.prompts} />
      </div>
    </section>
  )
}
