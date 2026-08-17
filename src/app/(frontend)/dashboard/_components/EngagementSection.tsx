/**
 * Engagement — avg session time, feature-usage counters, lesson-type
 * breakdown, and per-course enrollments with an inline mini bar chart.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Feature usage + course enrollments list with mini bar chart
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { EngagementMetrics } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'

interface Props {
  engagement: EngagementMetrics
}

export function EngagementSection({ engagement }: Props) {
  const t = useTranslations('dashboard.engagement')
  const locale = useLocale()

  const maxEnrollment = engagement.courseEnrollments.reduce(
    (max, row) => Math.max(max, row.count),
    0,
  )

  return (
    <section className="space-y-6">
      <h2 className="text-heading-lg font-semibold">{t('section')}</h2>

      {/* Time + feature usage row */}
      <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label={t('avgSession')}
          value={engagement.avgTimeSpentMinutes}
          suffix={t('minSuffix')}
        />
        <MetricCard label={t('questionsAsked')} value={engagement.featureUsage.questionsAsked} />
        <MetricCard
          label={t('conversationsStarted')}
          value={engagement.featureUsage.conversationsStarted}
        />
        <MetricCard
          label={t('lessonsCompleted')}
          value={engagement.featureUsage.lessonsCompleted}
        />
        <MetricCard
          label={t('exercisesAttempted')}
          value={engagement.featureUsage.exercisesAttempted}
        />
        <MetricCard
          label={t('exercisesCompleted')}
          value={engagement.featureUsage.exercisesCompleted}
        />
      </div>

      {/* Lesson type breakdown */}
      <div className="grid gap-content-gap grid-cols-1 lg:grid-cols-3">
        <MetricCard label={t('learningLessons')} value={engagement.lessonTypeUsage.learning} />
        <MetricCard label={t('practiceLessons')} value={engagement.lessonTypeUsage.practice} />
        <MetricCard label={t('examLessons')} value={engagement.lessonTypeUsage.exam} />
      </div>

      {/* Course enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">{t('courseEnrollments')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {engagement.courseEnrollments.length === 0 ? (
            <p className="text-body-sm text-muted-foreground py-section-xs">{t('noCourses')}</p>
          ) : (
            <ul className="space-y-2">
              {engagement.courseEnrollments.map((row) => {
                const widthPct = maxEnrollment > 0 ? (row.count / maxEnrollment) * 100 : 0
                return (
                  <li key={row.courseTitle} className="space-y-1">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="truncate max-w-[70%]" title={row.courseTitle}>
                        {row.courseTitle}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {row.count.toLocaleString(locale)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${widthPct}%` }}
                        aria-hidden
                      />
                    </div>
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
