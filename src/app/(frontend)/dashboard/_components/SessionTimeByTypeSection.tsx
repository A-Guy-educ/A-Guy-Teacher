/**
 * Average session time bucketed by lesson type (learning / practice / exam).
 * Empty state per bucket renders as an em-dash until enough sessions
 * accumulate to be meaningful.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Session-time avg per lesson type (learning/practice/exam)
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import type { SessionTimeByLessonType } from '@/server/services/dashboard/metrics-types'

import { MetricCard } from './MetricCard'
import { formatDurationSeconds } from './format-duration'

interface Props {
  sessions: SessionTimeByLessonType
}

export function SessionTimeByTypeSection({ sessions }: Props) {
  const t = useTranslations('dashboard.engagement')

  const display = (seconds: number | null) =>
    seconds === null ? t('noSessionData') : formatDurationSeconds(seconds)

  return (
    <section className="space-y-4">
      <h3 className="text-heading-md font-semibold">{t('sessionByType')}</h3>
      <div className="grid gap-content-gap grid-cols-1 md:grid-cols-3">
        <MetricCard label={t('typeLearning')} value={display(sessions.learning)} />
        <MetricCard label={t('typePractice')} value={display(sessions.practice)} />
        <MetricCard label={t('typeExam')} value={display(sessions.exam)} />
      </div>
    </section>
  )
}
