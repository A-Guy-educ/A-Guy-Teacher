/**
 * @fileType component
 * @domain frontend
 * @pattern lesson-roadmap-tab
 * @ai-summary Container for the redesigned course-lessons view. Filters lessons by lessonType (learning/practice/exam), resolves progress + entitlement, groups by chapter, then orchestrates CourseLessonsHero + CourseLessonsFilterBar + a controlled Radix accordion of ChapterAccordion items. Timeline track sits behind the accordion list. Auto-expands the chapter containing the featured next-up lesson.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { toast } from 'sonner'
import type { Chapter, Lesson } from '@/infra/types/content'
import { getEffectiveLessonType, type LessonType } from '@/server/constants/lesson-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useProgressMap } from '@/client/hooks/useProgressMap'
import { ChapterAccordion } from './ChapterAccordion'
import { CourseLessonsFilterBar } from './CourseLessonsFilterBar'
import { CourseLessonsHero } from './CourseLessonsHero'
import { formatMessage } from './formatMessage'
import { countTotals, findFeaturedNode, useLessonGrouping } from './useLessonGrouping'
import type { FilterMode, LessonRoadmapNode } from './lessonRoadmapTypes'
import type { LessonProgress } from '../types'

interface LessonListTabProps {
  lessons: Lesson[]
  chapters: Chapter[]
  courseSlug: string
  /** Course ID used to look up paid entitlement. When omitted, no entitlement check runs. */
  courseId?: string
  /** Parent course's lesson-level accessType. Combined with each lesson's own accessType to resolve the effective tier. */
  courseAccessType?: string | null
  /** Pre-resolved entitlement flag (usually server-side). Wins over the client-side fetch when defined. */
  hasPaidAccess?: boolean
  /** Grade bucket of the course — used to scope progress reads to the correct grade. */
  gradeLevel: string
  tabColor?: { text: string; stroke: string }
  lessonProgressMap?: Record<string, LessonProgress>
  lessonType: LessonType
  /**
   * Pre-resolved buy URL forwarded to every locked lesson row. Resolved once at
   * the container level (course page server component) so the reverse-lookup
   * fires at most once per course render, not per card.
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
  const filteredLessons = useMemo(
    () => lessons.filter((l) => getEffectiveLessonType(l.type) === lessonType),
    [lessons, lessonType],
  )

  const lessonIds = useMemo(() => filteredLessons.map((l) => l.id), [filteredLessons])
  const { progressMap } = useProgressMap({
    recordType: 'lesson',
    recordIds: lessonIds,
    gradeLevel,
  })

  const [hasPaidAccessClient, setHasPaidAccessClient] = useState<boolean | undefined>(undefined)
  useEffect(() => {
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

  // Default to true when entitlement state is unknown — showing the CTA is a
  // downgrade, not a hard block; the page-level gate already gates paid content.
  const hasPaidAccess = hasPaidAccessProp ?? hasPaidAccessClient ?? true

  const progressByLessonId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of filteredLessons) {
      map[l.id] = lessonProgressMap[l.id]?.percent ?? progressMap[l.id] ?? 0
    }
    return map
  }, [filteredLessons, lessonProgressMap, progressMap])

  const groups = useLessonGrouping({
    chapters,
    lessons: filteredLessons,
    progressByLessonId,
    courseAccessType,
    hasPaidAccess,
  })

  const featured = findFeaturedNode(groups)
  const { total, completed } = countTotals(groups)
  const accentColor = tabColor?.stroke ?? 'hsl(var(--primary))'

  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [openChapters, setOpenChapters] = useState<string[]>([])
  const [autoExpandedFor, setAutoExpandedFor] = useState<string | null>(null)

  // Auto-expand the chapter containing the featured lesson on first load
  // and whenever the featured lesson moves to a different chapter.
  useEffect(() => {
    const featuredChapterId = featured
      ? groups.find((g) => g.lessons.some((n) => n.isFeatured))?.chapter.id
      : groups[0]?.chapter.id
    if (!featuredChapterId) return
    if (autoExpandedFor === featuredChapterId) return
    setOpenChapters((prev) =>
      prev.includes(featuredChapterId) ? prev : [...prev, featuredChapterId],
    )
    setAutoExpandedFor(featuredChapterId)
  }, [autoExpandedFor, featured, groups])

  const visibleGroups = useMemo(() => {
    if (filterMode === 'focus' && featured) {
      return groups.filter((g) => g.hasFeatured)
    }
    return groups
  }, [filterMode, featured, groups])

  const visibleLessonsFor = (lessons: LessonRoadmapNode[]) => {
    if (filterMode === 'uncompleted') return lessons.filter((n) => n.status !== 'completed')
    return lessons
  }

  const handleFocusNext = () => {
    if (!featured) return
    const group = groups.find((g) => g.lessons.some((n) => n.isFeatured))
    if (!group) return
    setOpenChapters((prev) =>
      prev.includes(group.chapter.id) ? prev : [...prev, group.chapter.id],
    )
    // Wait a frame so the accordion is open before we scroll.
    requestAnimationFrame(() => {
      const el = document.getElementById(`chapter-container-${group.chapter.id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast.info(formatMessage(t('roadmapFocused'), { chapter: group.chapter.title }))
    })
  }

  if (filteredLessons.length === 0) return null

  const timelineFill = total > 0 ? Math.max(5, Math.round((completed / total) * 100)) : 5

  return (
    <>
      <CourseLessonsHero
        completed={completed}
        total={total}
        featured={featured}
        accentColor={accentColor}
        onFocusNext={handleFocusNext}
      />

      <CourseLessonsFilterBar mode={filterMode} onChange={setFilterMode} />

      <div className="relative">
        <div className="absolute start-[15px] top-8 bottom-16 w-px bg-border rounded-full z-0">
          <div
            className="w-full bg-gradient-to-b from-success/60 via-primary/60 to-transparent rounded-full transition-[height] duration-slower"
            style={{ height: `${timelineFill}%` }}
          />
        </div>
        <AccordionPrimitive.Root
          type="multiple"
          value={openChapters}
          onValueChange={setOpenChapters}
          className="space-y-content-gap-sm relative z-10"
        >
          {visibleGroups.map((group) => (
            <ChapterAccordion
              key={group.chapter.id}
              group={group}
              visibleLessons={visibleLessonsFor(group.lessons)}
              courseSlug={courseSlug}
              purchaseHref={purchaseHref}
            />
          ))}
        </AccordionPrimitive.Root>
      </div>
    </>
  )
}
