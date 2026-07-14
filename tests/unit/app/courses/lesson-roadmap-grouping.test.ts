/**
 * @fileType unit-test
 * @domain frontend
 * @pattern lesson-roadmap-grouping
 * @ai-summary Unit coverage for the pure `computeLessonGroups` + helpers behind the LessonListTab redesign (#873). Locks: chapter/lesson ordering, chapter completion tallies, "featured next up" assignment across chapters, and the precedence between `soon` (with expiry), paywall-locked, and progress-driven statuses.
 */

import { describe, expect, it } from 'vitest'
import type { Chapter, Lesson } from '@/infra/types/content'
import {
  computeLessonGroups,
  countTotals,
  findFeaturedNode,
} from '@/app/(frontend)/courses/[courseSlug]/_components/LessonListTab/useLessonGrouping'

function chapter(id: string, order: number, extra: Partial<Chapter> = {}): Chapter {
  return { id, slug: id, title: `Chapter ${order}`, order, ...extra }
}

function lesson(id: string, chapterId: string, order: number, extra: Partial<Lesson> = {}): Lesson {
  return {
    id,
    slug: id,
    title: `Lesson ${id}`,
    chapter: chapterId,
    order,
    type: 'learning',
    ...extra,
  }
}

const noPaywallDefaults = {
  courseAccessType: 'free' as const,
  hasPaidAccess: true,
}

describe('computeLessonGroups — ordering + tallies', () => {
  it('orders chapters by order asc and skips chapters with zero matching lessons', () => {
    const chapters = [chapter('c2', 2), chapter('c1', 1), chapter('c3-empty', 3)]
    const lessons = [lesson('l1', 'c1', 1), lesson('l2', 'c2', 1)]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: {},
      ...noPaywallDefaults,
    })
    expect(groups.map((g) => g.chapter.id)).toEqual(['c1', 'c2'])
  })

  it('orders lessons within a chapter by order asc and produces sequential displayIndex across chapters', () => {
    const chapters = [chapter('c1', 1), chapter('c2', 2)]
    const lessons = [lesson('l1b', 'c1', 2), lesson('l1a', 'c1', 1), lesson('l2a', 'c2', 1)]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: {},
      ...noPaywallDefaults,
    })
    const indices = groups.flatMap((g) => g.lessons.map((n) => [n.lesson.id, n.displayIndex]))
    expect(indices).toEqual([
      ['l1a', 1],
      ['l1b', 2],
      ['l2a', 3],
    ])
  })

  it('counts completed and totals per chapter, and rolls up via countTotals', () => {
    const chapters = [chapter('c1', 1), chapter('c2', 2)]
    const lessons = [lesson('a', 'c1', 1), lesson('b', 'c1', 2), lesson('c', 'c2', 1)]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: { a: 100, b: 50, c: 100 },
      ...noPaywallDefaults,
    })
    expect(groups[0].completedCount).toBe(1)
    expect(groups[0].totalCount).toBe(2)
    expect(groups[1].completedCount).toBe(1)
    expect(groups[1].totalCount).toBe(1)
    expect(countTotals(groups)).toEqual({ total: 3, completed: 2 })
  })
})

describe('computeLessonGroups — featured assignment', () => {
  it('marks the first in-progress lesson as featured (spanning chapters)', () => {
    const chapters = [chapter('c1', 1), chapter('c2', 2)]
    const lessons = [lesson('a', 'c1', 1), lesson('b', 'c1', 2), lesson('c', 'c2', 1)]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: { a: 100, b: 0, c: 50 },
      ...noPaywallDefaults,
    })
    // 'a' completed → not featured. 'b' available → becomes featured before 'c'.
    const featured = findFeaturedNode(groups)
    expect(featured?.lesson.id).toBe('b')
    expect(groups[0].hasFeatured).toBe(true)
    expect(groups[1].hasFeatured).toBe(false)
  })

  it('falls through to the first available lesson in the next chapter when all in the first chapter are completed', () => {
    const chapters = [chapter('c1', 1), chapter('c2', 2)]
    const lessons = [lesson('a', 'c1', 1), lesson('b', 'c1', 2), lesson('c', 'c2', 1)]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: { a: 100, b: 100, c: 0 },
      ...noPaywallDefaults,
    })
    expect(findFeaturedNode(groups)?.lesson.id).toBe('c')
  })

  it('assigns no featured lesson when every lesson is completed', () => {
    const chapters = [chapter('c1', 1)]
    const lessons = [lesson('a', 'c1', 1), lesson('b', 'c1', 2)]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: { a: 100, b: 100 },
      ...noPaywallDefaults,
    })
    expect(findFeaturedNode(groups)).toBeNull()
    expect(groups[0].hasFeatured).toBe(false)
  })

  it('skips paywall-locked lessons when picking the featured one', () => {
    // Course-level type is 'free' so only the lesson that explicitly opts in
    // to 'paid' gets locked — otherwise every lesson would inherit the course
    // accessType and there'd be nothing to fall through to.
    const chapters = [chapter('c1', 1)]
    const lessons = [
      lesson('locked', 'c1', 1, { accessType: 'paid' }),
      lesson('free', 'c1', 2, { accessType: 'free' }),
    ]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: {},
      courseAccessType: 'free',
      hasPaidAccess: false,
    })
    expect(groups[0].lessons[0].status).toBe('locked')
    expect(findFeaturedNode(groups)?.lesson.id).toBe('free')
  })
})

describe('computeLessonGroups — status precedence', () => {
  it('reports "soon" only while contentStatusExpiresAt is in the future', () => {
    const chapters = [chapter('c1', 1)]
    const future = new Date(Date.now() + 24 * 3600_000).toISOString()
    const past = new Date(Date.now() - 24 * 3600_000).toISOString()
    const lessons = [
      lesson('future', 'c1', 1, { contentStatus: 'soon', contentStatusExpiresAt: future }),
      lesson('past', 'c1', 2, { contentStatus: 'soon', contentStatusExpiresAt: past }),
      lesson('no-expiry', 'c1', 3, { contentStatus: 'soon' }),
    ]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: {},
      ...noPaywallDefaults,
    })
    const statuses = groups[0].lessons.map((n) => [n.lesson.id, n.status])
    expect(statuses).toEqual([
      ['future', 'soon'],
      // Expired soon window → falls back to normal availability (matches ContentStatusBadge).
      ['past', 'available'],
      // Missing expiry → treat as still soon.
      ['no-expiry', 'soon'],
    ])
  })

  it('gives paywall-lock precedence over completed/active percentages', () => {
    const chapters = [chapter('c1', 1)]
    const lessons = [lesson('locked-with-progress', 'c1', 1, { accessType: 'paid' })]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      // 50% progress would normally mean 'active', but no entitlement wins.
      progressByLessonId: { 'locked-with-progress': 50 },
      courseAccessType: 'paid',
      hasPaidAccess: false,
    })
    expect(groups[0].lessons[0].status).toBe('locked')
  })
})

describe('computeLessonGroups — degenerate inputs', () => {
  it('returns [] when no chapters', () => {
    const groups = computeLessonGroups({
      chapters: [],
      lessons: [lesson('a', 'ghost', 1)],
      progressByLessonId: {},
      ...noPaywallDefaults,
    })
    expect(groups).toEqual([])
  })

  it('drops lessons whose chapter id does not match any provided chapter', () => {
    const chapters = [chapter('c1', 1)]
    const lessons = [lesson('orphan', 'ghost', 1), lesson('kept', 'c1', 1)]
    const groups = computeLessonGroups({
      chapters,
      lessons,
      progressByLessonId: {},
      ...noPaywallDefaults,
    })
    expect(groups).toHaveLength(1)
    expect(groups[0].lessons.map((n) => n.lesson.id)).toEqual(['kept'])
  })
})
