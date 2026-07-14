/**
 * @fileType component
 * @domain frontend
 * @pattern lesson-roadmap-chapter
 * @ai-summary Renders one chapter as a Radix accordion item — header with chapter name, unlocked-count progress bar, and chevron; expandable body with the chapter description and a list of LessonRow entries connected by a subtle timeline track. Header tone (completed / featured / neutral) is derived from the group's aggregate status.
 */

'use client'

import { BookmarkIcon, CheckIcon, ChevronDown } from 'lucide-react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { formatMessage } from './formatMessage'
import { LessonRow } from './LessonRow'
import type { ChapterRoadmapGroup, LessonRoadmapNode } from './lessonRoadmapTypes'

interface ChapterAccordionProps {
  group: ChapterRoadmapGroup
  visibleLessons: LessonRoadmapNode[]
  courseSlug: string
  purchaseHref?: string
}

export function ChapterAccordion({
  group,
  visibleLessons,
  courseSlug,
  purchaseHref,
}: ChapterAccordionProps) {
  const t = useTranslations('coursePage')
  const { chapter, chapterIndex, completedCount, totalCount } = group
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isChapterCompleted = totalCount > 0 && completedCount === totalCount
  const hasFeatured = group.hasFeatured

  const headerIconTone = isChapterCompleted
    ? 'bg-success/10 border-success/30 text-success'
    : hasFeatured
      ? 'bg-primary/10 border-primary/30 text-primary'
      : 'bg-muted border-border text-muted-foreground'

  const containerBorder = isChapterCompleted
    ? 'border-success/10 hover:border-success/20'
    : hasFeatured
      ? 'border-primary/20 hover:border-primary/30'
      : 'border-border/60'

  return (
    <AccordionPrimitive.Item
      value={chapter.id}
      className={cn(
        'relative rounded-2xl border bg-card transition-colors duration-normal overflow-hidden',
        containerBorder,
      )}
      id={`chapter-container-${chapter.id}`}
    >
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          className={cn(
            'group flex flex-1 flex-col md:flex-row justify-between items-start md:items-center gap-content-gap p-card-padding cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors duration-normal',
          )}
        >
          <div className="flex items-center gap-content-gap-sm">
            <div
              className={cn(
                'w-8 h-8 rounded-xl border flex items-center justify-center text-body-xs',
                headerIconTone,
              )}
            >
              {isChapterCompleted ? (
                <CheckIcon className="w-3.5 h-3.5" />
              ) : (
                <BookmarkIcon className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="text-start">
              <div className="flex items-center gap-content-gap-xs flex-wrap">
                <span className="text-body-2xs uppercase tracking-tracking-sm font-semibold text-muted-foreground">
                  {formatMessage(t('roadmapChapterLabel'), { num: chapterIndex + 1 })}
                </span>
                <span className="text-body-2xs text-muted-foreground font-mono">
                  ({formatMessage(t('roadmapChapterCount'), { count: totalCount })})
                </span>
              </div>
              <h3 className="text-body-md font-bold text-foreground tracking-tight">
                {chapter.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-content-gap-sm w-full md:w-auto self-stretch justify-between md:justify-end">
            <div className="flex items-center gap-content-gap-xs">
              <div className="w-20 bg-muted rounded-full h-[3px] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-slower',
                    isChapterCompleted ? 'bg-success' : 'bg-primary',
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-body-2xs font-semibold text-muted-foreground font-mono tabular-nums">
                {formatMessage(t('roadmapChapterUnlocked'), {
                  done: completedCount,
                  total: totalCount,
                })}
              </span>
            </div>
            <div className="w-6 h-6 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-transform duration-normal group-data-[state=open]:rotate-180">
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>

      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="border-t border-border p-card-padding relative">
          {chapter.description && (
            <p className="text-body-xs text-muted-foreground mb-content-gap-sm ms-12">
              {chapter.description}
            </p>
          )}

          <div className="relative">
            {visibleLessons.length > 0 && (
              <div
                className="absolute start-[15px] top-6 bottom-6 w-px bg-border rounded-full z-0"
                aria-hidden
              />
            )}
            <div className="space-y-content-gap-xs relative z-10">
              {visibleLessons.map((node) => (
                <LessonRow
                  key={node.lesson.id}
                  node={node}
                  courseSlug={courseSlug}
                  purchaseHref={purchaseHref}
                />
              ))}
              {visibleLessons.length === 0 && (
                <div className="text-center py-content-gap text-body-xs text-muted-foreground ms-12">
                  {t('roadmapEmptyChapter')}
                </div>
              )}
            </div>
          </div>
        </div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  )
}
