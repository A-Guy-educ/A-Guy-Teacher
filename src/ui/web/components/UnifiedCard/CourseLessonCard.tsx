'use client'

import { storeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import type { Lesson } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import type { LessonType } from '@/server/constants/lesson-types'
import { resolveAccessType } from '@/infra/auth/access-types'
import { toast } from 'sonner'

interface CourseLessonCardProps {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
  tabColor?: { text: string; stroke: string }
  progress?: number
  /** Lesson type — 'exam' switches label from "Lesson" to "Exam" with larger font */
  lessonType?: LessonType
  /** Parent course's lesson-level access type. Used with the lesson's own accessType to resolve the effective tier. */
  courseAccessType?: string | null
  /** True when the current user already has entitlement for the parent course (admin → true). */
  hasPaidAccess?: boolean
  /**
   * Pre-resolved buy URL for this course's paywall CTA. When set, the locked
   * card routes to `/products/<slug>` instead of the generic `/products` index.
   * Resolve once per course at the container level — never per card — so a
   * single render only fires the reverse-lookup once.
   */
  purchaseHref?: string
}

export function CourseLessonCard({
  lesson,
  index,
  courseSlug,
  chapterSlug,
  tabColor,
  progress = 0,
  lessonType,
  courseAccessType,
  hasPaidAccess = true,
  purchaseHref,
}: CourseLessonCardProps) {
  const tc = useTranslations('courses')
  const t = useTranslations('coursePage')

  const isExam = lessonType === 'exam'
  const label = `${isExam ? tc('exam') : tc('lesson')} ${index}`
  const labelBadgeClassName = isExam ? 'text-[11.5px]' : undefined

  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`
  const isSoon = lesson.contentStatus === 'soon'
  // Disable link if chapterSlug is missing to avoid malformed URLs like /chapters//lessons/
  const isLinkDisabled = isSoon || !chapterSlug
  const accentColor = isSoon ? 'hsl(var(--border))' : (tabColor?.stroke ?? 'hsl(var(--primary))')

  const effectiveAccessType = resolveAccessType(lesson.accessType, courseAccessType)
  const isLocked = effectiveAccessType === 'paid' && !hasPaidAccess

  const subtitle =
    progress >= 100 ? t('lessonCompleted') : progress > 0 ? t('statusInProgress') : t('notStarted')

  const handleClick = (e: React.MouseEvent) => {
    if (isSoon) {
      e.preventDefault()
      toast.info(tc('contentLocked'))
      return
    }
    // Don't track analytics for lessons without a valid chapterSlug (malformed URL)
    if (!chapterSlug) {
      e.preventDefault()
      return
    }
    storeLessonOpenTimestamp(lesson.id)
    systemEventBus.emit(SYSTEM_EVENTS.LESSON_OPEN_ATTEMPTED, {
      lesson_id: lesson.id,
      content_type: (lesson.contentFiles?.length ?? 0) > 0 ? 'pdf' : 'exercises',
      platform: 'web',
      course_id: courseSlug,
    })
  }

  return (
    <UnifiedCard
      variant="lesson"
      title={lesson.title}
      label={label}
      labelBadgeClassName={labelBadgeClassName}
      accentColor={accentColor}
      contentStatus={lesson.contentStatus}
      contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
      contentStatusLabel={lesson.contentStatusLabel ?? undefined}
      progress={progress}
      subtitle={subtitle}
      cardHref={isLinkDisabled ? '#' : href}
      cardOnClick={handleClick}
      locked={isLocked}
      lockedPurchaseLabel={tc('lockedPurchaseCta')}
      lockedHint={tc('lockedPurchaseHint')}
      lockedPurchaseHref={purchaseHref}
    />
  )
}
