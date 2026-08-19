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

import { useState } from 'react'

import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { EngagementMetrics } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'
import { SessionTimeByTypeSection } from './SessionTimeByTypeSection'
import { TopLessonsSection } from './TopLessonsSection'

interface Props {
  engagement: EngagementMetrics
}

const INITIAL_COURSES_VISIBLE = 5

export function EngagementSection({ engagement }: Props) {
  const t = useTranslations('dashboard.engagement')
  const locale = useLocale()
  const [showAllCourses, setShowAllCourses] = useState(false)
  const [showAllActiveLearners, setShowAllActiveLearners] = useState(false)

  const maxEnrollment = engagement.courseEnrollments.reduce(
    (max, row) => Math.max(max, row.count),
    0,
  )
  const visibleCourses = showAllCourses
    ? engagement.courseEnrollments
    : engagement.courseEnrollments.slice(0, INITIAL_COURSES_VISIBLE)
  const hasMoreCourses = engagement.courseEnrollments.length > INITIAL_COURSES_VISIBLE

  const maxActiveLearners = engagement.usersPerCourse.reduce(
    (max, row) => Math.max(max, row.count),
    0,
  )
  const visibleActiveLearners = showAllActiveLearners
    ? engagement.usersPerCourse
    : engagement.usersPerCourse.slice(0, INITIAL_COURSES_VISIBLE)
  const hasMoreActiveLearners = engagement.usersPerCourse.length > INITIAL_COURSES_VISIBLE

  return (
    <section className="space-y-6">
      <h2 className="text-heading-lg font-semibold">{t('section')}</h2>

      {/* Session-time distribution: avg + median + std dev side-by-side */}
      <div className="grid gap-content-gap grid-cols-1 md:grid-cols-3">
        <MetricCard
          label={t('avgSession')}
          value={engagement.avgTimeSpentMinutes}
          suffix={t('minSuffix')}
        />
        <MetricCard
          label={t('medianSession')}
          value={engagement.medianTimeSpentMinutes}
          suffix={t('minSuffix')}
        />
        <MetricCard
          label={t('stdDevSession')}
          value={engagement.stdDevTimeSpentMinutes}
          suffix={t('minSuffix')}
        />
      </div>

      {/* Feature usage row */}
      <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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

      {/* Course enrollments — top 5 by default, expand for the full list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">{t('courseEnrollments')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {engagement.courseEnrollments.length === 0 ? (
            <p className="text-body-sm text-muted-foreground py-section-xs">{t('noCourses')}</p>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleCourses.map((row) => {
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
              {hasMoreCourses && (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAllCourses((v) => !v)}
                  >
                    {showAllCourses ? t('showLess') : t('showMore')}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Active learners per course — sourced from users.currentCourse, the
          last course each user picked or opened a lesson in. Distinct from
          courseEnrollments above (which counts paid purchases). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">{t('usersPerCourse')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {engagement.usersPerCourse.length === 0 ? (
            <p className="text-body-sm text-muted-foreground py-section-xs">
              {t('noActiveLearners')}
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleActiveLearners.map((row) => {
                  const widthPct = maxActiveLearners > 0 ? (row.count / maxActiveLearners) * 100 : 0
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
              {hasMoreActiveLearners && (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAllActiveLearners((v) => !v)}
                  >
                    {showAllActiveLearners ? t('showLess') : t('showMore')}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Top lessons opened — sourced from lesson-stats counter collection */}
      <TopLessonsSection lessons={engagement.topLessons} />

      {/* Session time distribution by lesson type — needs lesson-stats
          sessionCount + totalDurationSeconds populated by LESSON_ENDED */}
      <SessionTimeByTypeSection sessions={engagement.sessionTimeByLessonType} />
    </section>
  )
}
