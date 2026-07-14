/**
 * @fileType types
 * @domain frontend
 * @pattern lesson-roadmap
 * @ai-summary Local type surface for the chapter-accordion roadmap: per-lesson status (completed/active/available/locked/soon), the flattened node shape carried through the render tree, the per-chapter grouping, and the filter modes exposed via CourseLessonsFilterBar.
 */

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
