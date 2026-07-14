import { useMemo } from 'react'
import type { Chapter, Lesson } from '@/infra/types/content'
import { resolveAccessType } from '@/infra/auth/access-types'
import type {
  ChapterRoadmapGroup,
  LessonRoadmapNode,
  LessonRoadmapStatus,
} from './lessonRoadmapTypes'

interface GroupingInput {
  chapters: Chapter[]
  lessons: Lesson[]
  progressByLessonId: Record<string, number>
  courseAccessType: string | null | undefined
  hasPaidAccess: boolean
}

function chapterIdOf(lesson: Lesson): string | null {
  const c = lesson.chapter
  if (!c) return null
  return typeof c === 'string' ? c : (c.id ?? null)
}

function statusFor(
  lesson: Lesson,
  percent: number,
  courseAccessType: string | null | undefined,
  hasPaidAccess: boolean,
): LessonRoadmapStatus {
  if (lesson.contentStatus === 'soon') return 'soon'
  const access = resolveAccessType(lesson.accessType, courseAccessType)
  if (access === 'paid' && !hasPaidAccess) return 'locked'
  if (percent >= 100) return 'completed'
  if (percent > 0) return 'active'
  return 'available'
}

export function useLessonGrouping({
  chapters,
  lessons,
  progressByLessonId,
  courseAccessType,
  hasPaidAccess,
}: GroupingInput): ChapterRoadmapGroup[] {
  return useMemo(() => {
    const orderedChapters = [...chapters].sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    )

    const lessonsByChapter = new Map<string, Lesson[]>()
    for (const lesson of lessons) {
      const chId = chapterIdOf(lesson)
      if (!chId) continue
      const bucket = lessonsByChapter.get(chId) ?? []
      bucket.push(lesson)
      lessonsByChapter.set(chId, bucket)
    }

    let displayIndex = 0
    let featuredAssigned = false

    const groups: ChapterRoadmapGroup[] = []
    for (let chapterIndex = 0; chapterIndex < orderedChapters.length; chapterIndex++) {
      const chapter = orderedChapters[chapterIndex]
      const raw = lessonsByChapter.get(chapter.id) ?? []
      const orderedLessons = [...raw].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      if (orderedLessons.length === 0) continue

      const nodes: LessonRoadmapNode[] = []
      let completedCount = 0
      let hasFeatured = false

      for (const lesson of orderedLessons) {
        displayIndex += 1
        const percent = progressByLessonId[lesson.id] ?? 0
        const status = statusFor(lesson, percent, courseAccessType, hasPaidAccess)
        if (status === 'completed') completedCount += 1

        // First non-completed, non-locked lesson becomes the featured "active"
        // one — matches the mockup's auto-expand + hero focus behavior.
        const canFeature = !featuredAssigned && (status === 'active' || status === 'available')
        if (canFeature) {
          featuredAssigned = true
          hasFeatured = true
        }

        nodes.push({
          lesson,
          chapterSlug: chapter.slug ?? '',
          displayIndex,
          progressPercent: percent,
          status,
          isFeatured: canFeature,
        })
      }

      groups.push({
        chapter,
        chapterIndex,
        lessons: nodes,
        completedCount,
        totalCount: nodes.length,
        hasFeatured,
      })
    }

    return groups
  }, [chapters, lessons, progressByLessonId, courseAccessType, hasPaidAccess])
}

export function findFeaturedNode(groups: ChapterRoadmapGroup[]): LessonRoadmapNode | null {
  for (const g of groups) {
    for (const n of g.lessons) if (n.isFeatured) return n
  }
  return null
}

export function countTotals(groups: ChapterRoadmapGroup[]): { total: number; completed: number } {
  let total = 0
  let completed = 0
  for (const g of groups) {
    total += g.totalCount
    completed += g.completedCount
  }
  return { total, completed }
}
