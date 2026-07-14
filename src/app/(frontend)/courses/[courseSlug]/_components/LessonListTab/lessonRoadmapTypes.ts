import type { Chapter, Lesson } from '@/infra/types/content'

export type LessonRoadmapStatus = 'completed' | 'active' | 'available' | 'locked' | 'soon'

export interface LessonRoadmapNode {
  lesson: Lesson
  chapterSlug: string
  displayIndex: number
  progressPercent: number
  status: LessonRoadmapStatus
  isFeatured: boolean
}

export interface ChapterRoadmapGroup {
  chapter: Chapter
  chapterIndex: number
  lessons: LessonRoadmapNode[]
  completedCount: number
  totalCount: number
  hasFeatured: boolean
}

export type FilterMode = 'all' | 'focus' | 'uncompleted'
