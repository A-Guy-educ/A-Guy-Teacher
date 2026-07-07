'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Chapter, Lesson } from '@/infra/types/content'
import { getEffectiveLessonType, type LessonType } from '@/server/constants/lesson-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useProgressMap } from '@/client/hooks/useProgressMap'
import { StaggerGrid, StaggerItem } from '@/ui/web/components/motion'
import { CourseLessonCard } from '../CourseLessonCard'
import type { LessonProgress } from '../types'

interface LessonListTabProps {
  lessons: Lesson[]
  chapters: Chapter[]
  courseSlug: string
  /** Course ID used to look up paid-entitlement. When omitted, no entitlement check runs. */
  courseId?: string
  /** Parent course's lesson-level accessType. Resolved against each lesson to decide the lock. */
  courseAccessType?: string | null
  /** Pre-resolved entitlement flag (e.g. server-side). Wins over the client fetch when provided. */
  hasPaidAccess?: boolean
  /** Grade bucket of the course these lessons belong to — used to read progress for the right grade. */
  gradeLevel: string
  tabColor?: { text: string; stroke: string }
  lessonProgressMap?: Record<string, LessonProgress>
  lessonType: LessonType
  /**
   * Pre-resolved buy URL forwarded to every locked CourseLessonCard. Resolved
   * once at the container level (course page server component) so the
   * reverse-lookup fires at most once per course render, not per card.
   */
  purchaseHref?: string
}

export function LessonListTab({
  lessons,
  chapters,
  courseSlug,
  courseId,
  courseAccessType,
  hasPaidAccess: hasPaidAccessProp,
  gradeLevel,
  tabColor,
  lessonProgressMap = {},
  lessonType,
  purchaseHref,
}: LessonListTabProps) {
  const t = useTranslations('coursePage')
  const filteredLessons = lessons.filter((l) => getEffectiveLessonType(l.type) === lessonType)

  const lessonIds = useMemo(() => filteredLessons.map((l) => l.id), [filteredLessons])
  const { progressMap, statusMap } = useProgressMap({
    recordType: 'lesson',
    recordIds: lessonIds,
    gradeLevel,
  })

  const [hasPaidAccessClient, setHasPaidAccessClient] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    // Skip when the parent already resolved entitlement (server) or when we
    // don't have a courseId to look up. The course page is gated server-side
    // for paid courses, so by the time we render here the user already has
    // access — but we still verify in case the page-level gate is loose.
    if (hasPaidAccessProp !== undefined) return
    if (!courseId) return
    let cancelled = false
    fetch(`/api/entitlements/check?courseId=${encodeURIComponent(courseId)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { hasAccess?: boolean }
        if (!cancelled) setHasPaidAccessClient(Boolean(data.hasAccess))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [courseId, hasPaidAccessProp])

  // Default to true so we never accidentally lock someone whose entitlement
  // state we don't yet know — the visual hint is a downgrade, not a hard block.
  const hasPaidAccess = hasPaidAccessProp ?? hasPaidAccessClient ?? true

  if (filteredLessons.length === 0) {
    return null
  }

  const hasParentProgress = Object.keys(lessonProgressMap).length > 0

  const completedCount = hasParentProgress
    ? filteredLessons.filter((l) => (lessonProgressMap[l.id]?.percent ?? 0) >= 100).length
    : Object.values(statusMap).filter((s) => s === 'completed').length
  const inProgressCount = hasParentProgress
    ? filteredLessons.filter((l) => {
        const p = lessonProgressMap[l.id]?.percent ?? 0
        return p > 0 && p < 100
      }).length
    : Object.values(statusMap).filter((s) => s === 'in_progress').length
  const notStartedCount = filteredLessons.length - completedCount - inProgressCount

  return (
    <>
      <div className="flex gap-content-gap-xs justify-center mb-6 flex-wrap">
        <span className="text-body-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{completedCount}</span> {t('statusCompleted')}
        </span>
        <span className="text-body-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{inProgressCount}</span> {t('statusInProgress')}
        </span>
        <span className="text-body-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{notStartedCount}</span> {t('statusNotStarted')}
        </span>
      </div>

      <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-content-gap">
        {filteredLessons.map((lesson, idx) => {
          const chapter = chapters.find((ch) => {
            const lessonChapterId =
              typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
            return ch.id === lessonChapterId
          })
          const chapterSlug = chapter?.slug ?? ''

          return (
            <StaggerItem key={lesson.id}>
              <CourseLessonCard
                lesson={lesson}
                index={idx + 1}
                courseSlug={courseSlug}
                chapterSlug={chapterSlug}
                tabColor={tabColor}
                progress={lessonProgressMap[lesson.id]?.percent ?? progressMap[lesson.id] ?? 0}
                lessonType={lessonType}
                courseAccessType={courseAccessType}
                hasPaidAccess={hasPaidAccess}
                purchaseHref={purchaseHref}
              />
            </StaggerItem>
          )
        })}
      </StaggerGrid>
    </>
  )
}
