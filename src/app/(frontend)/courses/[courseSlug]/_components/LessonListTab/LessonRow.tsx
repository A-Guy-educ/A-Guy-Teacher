'use client'

import { CheckCircle2, Clock, Lock, Play } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/infra/utils/ui'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { storeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useTranslations } from '@/ui/web/providers/I18n'
import { formatMessage } from './formatMessage'
import type { LessonRoadmapNode } from './lessonRoadmapTypes'

interface LessonRowProps {
  node: LessonRoadmapNode
  courseSlug: string
  purchaseHref?: string
}

function formatIndex(n: number): string {
  return String(n).padStart(2, '0')
}

export function LessonRow({ node, courseSlug, purchaseHref }: LessonRowProps) {
  const t = useTranslations('coursePage')
  const tc = useTranslations('courses')
  const { lesson, chapterSlug, displayIndex, progressPercent, status } = node

  const href = chapterSlug
    ? `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`
    : '#'
  const buyHref = purchaseHref ?? '/products'

  const isInteractive = status !== 'soon' && status !== 'locked'
  const targetHref =
    status === 'soon' ? '#' : status === 'locked' ? buyHref : href

  const handleClick = (e: React.MouseEvent) => {
    if (status === 'soon') {
      e.preventDefault()
      toast.info(tc('contentLocked'))
      return
    }
    if (status === 'locked') {
      // Let the link navigate to the purchase page.
      return
    }
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

  const cardTone =
    status === 'completed'
      ? 'border-success/20 bg-success/[0.03] hover:border-success/30'
      : node.isFeatured || status === 'active'
        ? 'border-primary/40 bg-primary/[0.03] shadow-[0_0_35px_hsl(var(--primary)/0.10)]'
        : status === 'locked' || status === 'soon'
          ? 'border-border/60 bg-muted/20 opacity-70 grayscale-[20%]'
          : 'border-border bg-card hover:border-border/80'

  const numberTone =
    status === 'completed'
      ? 'text-success/80 font-semibold'
      : node.isFeatured || status === 'active'
        ? 'text-foreground font-extrabold'
        : 'text-muted-foreground/60'

  const dotTone =
    status === 'completed'
      ? 'bg-success ring-4 ring-success/10'
      : node.isFeatured || status === 'active'
        ? 'bg-primary ring-4 ring-primary/20 animate-pulse'
        : 'bg-muted border border-border'

  const statusControl = renderStatusControl({ node, t })

  return (
    <div className="flex items-center gap-content-gap-sm relative group">
      <div
        className={cn(
          'absolute start-[11px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 transition-all duration-normal',
          dotTone,
        )}
        aria-hidden
      />
      <SystemLink
        href={targetHref}
        onClick={handleClick}
        className={cn(
          'ms-8 flex-1 rounded-xl p-card-padding-sm border transition-all duration-normal flex flex-col sm:flex-row justify-between items-start sm:items-center gap-content-gap-xs',
          cardTone,
          isInteractive && 'hover:-translate-x-[1px]',
        )}
      >
        <div className="flex items-center gap-content-gap-sm text-start w-full sm:w-auto">
          <div
            className={cn(
              'text-2xl md:text-3xl font-mono tracking-tight shrink-0 select-none transition-colors duration-normal tabular-nums',
              numberTone,
            )}
          >
            {formatIndex(displayIndex)}
          </div>
          <div className="w-px h-9 bg-border shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-content-gap-xs flex-wrap">
              {lesson.contentStatus === 'justAdded' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
                  {t('roadmapLessonJustAdded')}
                </span>
              )}
              {lesson.contentStatus === 'soon' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {t('roadmapLessonComingSoon')}
                </span>
              )}
              {progressPercent > 0 && progressPercent < 100 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono tabular-nums">
                  <Clock className="w-3 h-3" />
                  {formatMessage(t('roadmapLessonProgressBadge'), { percent: progressPercent })}
                </span>
              )}
            </div>
            <h4 className="text-body-sm font-bold text-foreground group-hover:text-foreground tracking-tight">
              {lesson.title}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-content-gap-xs self-stretch sm:self-auto justify-end shrink-0">
          {statusControl}
        </div>
      </SystemLink>
    </div>
  )
}

function renderStatusControl({
  node,
  t,
}: {
  node: LessonRoadmapNode
  t: ReturnType<typeof useTranslations>
}) {
  const { status, isFeatured } = node
  if (status === 'completed') {
    return (
      <span className="text-body-xs font-bold text-success flex items-center gap-1.5 font-mono">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('roadmapLessonCompleted')}</span>
      </span>
    )
  }
  if (status === 'locked') {
    return (
      <span className="text-body-xs text-muted-foreground flex items-center gap-1.5">
        <Lock className="w-3 h-3" />
        <span className="hidden sm:inline">{t('roadmapLessonLocked')}</span>
      </span>
    )
  }
  if (status === 'soon') {
    return (
      <span className="text-body-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        <span className="hidden sm:inline">{t('roadmapLessonComingSoon')}</span>
      </span>
    )
  }
  // active / available / featured all render a "learn now / continue / start" button.
  const label =
    status === 'active'
      ? t('roadmapLessonContinue')
      : isFeatured
        ? t('roadmapLessonLearnNow')
        : t('roadmapLessonStart')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all duration-normal',
        isFeatured || status === 'active'
          ? 'bg-primary text-primary-foreground shadow-elevation-2'
          : 'bg-muted text-foreground hover:bg-muted/70',
      )}
    >
      <Play className="w-2.5 h-2.5" />
      <span>{label}</span>
    </span>
  )
}
