/**
 * Engagement — avg session time, per-course enrollments list, feature-usage
 * action counters, and lesson-type breakdown.
 *
 * The course-enrollments list uses a simple bar-chart-style row rather than
 * a full chart lib — keeps the widget port dependency-free and readable.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import type { EngagementMetrics } from '@/server/services/dashboard/metrics-types'
import { MetricCard } from './MetricCard'

interface Props {
  engagement: EngagementMetrics
}

export function EngagementSection({ engagement }: Props) {
  const maxEnrollment = engagement.courseEnrollments.reduce(
    (max, row) => Math.max(max, row.count),
    0,
  )

  return (
    <section className="space-y-6">
      <h2 className="text-heading-lg font-semibold">Engagement</h2>

      {/* Time + feature usage row */}
      <div className="grid gap-content-gap grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Avg session" value={engagement.avgTimeSpentMinutes} suffix="min" />
        <MetricCard label="Questions asked" value={engagement.featureUsage.questionsAsked} />
        <MetricCard
          label="Conversations started"
          value={engagement.featureUsage.conversationsStarted}
        />
        <MetricCard label="Lessons completed" value={engagement.featureUsage.lessonsCompleted} />
        <MetricCard
          label="Exercises attempted"
          value={engagement.featureUsage.exercisesAttempted}
        />
        <MetricCard
          label="Exercises completed"
          value={engagement.featureUsage.exercisesCompleted}
        />
      </div>

      {/* Lesson type breakdown */}
      <div className="grid gap-content-gap grid-cols-1 lg:grid-cols-3">
        <MetricCard label="Learning lessons" value={engagement.lessonTypeUsage.learning} />
        <MetricCard label="Practice lessons" value={engagement.lessonTypeUsage.practice} />
        <MetricCard label="Exam lessons" value={engagement.lessonTypeUsage.exam} />
      </div>

      {/* Course enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">Course enrollments</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {engagement.courseEnrollments.length === 0 ? (
            <p className="text-body-sm text-muted-foreground py-section-xs">No courses.</p>
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
                        {row.count.toLocaleString('he-IL')}
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
