'use client'

import { storeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { SafeHtml } from '@/ui/web/SafeHtml'
import type { Lesson } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import { resolveAccessType } from '@/infra/auth/access-types'
import { toast } from 'sonner'

interface LessonCardProps {
  lesson: Lesson
  courseSlug: string
  chapterSlug?: string
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

export function LessonCard({
  lesson,
  courseSlug,
  chapterSlug,
  courseAccessType,
  hasPaidAccess = true,
  purchaseHref,
}: LessonCardProps) {
  const t = useTranslations('courses')

  if (!lesson.slug) return null

  // Get chapter slug from lesson if not provided
  const chapter = typeof lesson.chapter !== 'string' ? lesson.chapter : null
  const effectiveChapterSlug = chapterSlug || chapter?.slug

  if (!effectiveChapterSlug) return null

  const href = `/courses/${courseSlug}/chapters/${effectiveChapterSlug}/lessons/${lesson.slug}`
  const isSoon = lesson.contentStatus === 'soon'

  const effectiveAccessType = resolveAccessType(lesson.accessType, courseAccessType)
  const isLocked = effectiveAccessType === 'paid' && !hasPaidAccess

  const handleClick = () => {
    if (isSoon) {
      toast.info(t('contentLocked'))
      return
    }
    storeLessonOpenTimestamp(lesson.id)
    systemEventBus.emit(SYSTEM_EVENTS.LESSON_OPEN_ATTEMPTED, {
      lesson_id: lesson.id,
      content_type: (lesson.contentFiles?.length ?? 0) > 0 ? 'pdf' : 'exercises',
      platform: 'web',
      course_id: courseSlug,
    })
    window.location.href = href
  }

  return (
    <UnifiedCard
      title={lesson.title}
      description={
        lesson.description ? (
          <SafeHtml
            html={lesson.description}
            className="text-body-sm text-muted-foreground line-clamp-2 [&_p]:m-0"
          />
        ) : undefined
      }
      label={`${t('lesson')} ${lesson.order}`}
      contentStatus={lesson.contentStatus}
      contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
      contentStatusLabel={lesson.contentStatusLabel ?? undefined}
      buttonLabel={t('viewLesson')}
      onButtonClick={handleClick}
      buttonClassName={isSoon ? 'bg-muted text-muted-foreground cursor-not-allowed' : undefined}
      locked={isLocked}
      lockedPurchaseLabel={t('lockedPurchaseCta')}
      lockedHint={t('lockedPurchaseHint')}
      lockedPurchaseHref={purchaseHref}
    />
  )
}
