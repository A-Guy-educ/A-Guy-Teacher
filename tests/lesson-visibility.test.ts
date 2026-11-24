import { describe, expect, it } from 'vitest'

import { countShown, filterLessons, toggleHidden } from '../src/lib/lesson-visibility'
import { classProgressResponseSchema } from '../src/types/class-progress'

const lessons = [
  { id: 'l1', title: 'Vertical shift' },
  { id: 'l2', title: 'Horizontal shift' },
  { id: 'l3', title: 'Reflection' },
  { id: 'l4', title: 'שיקוף' },
]
const ids = lessons.map((l) => l.id)

describe('lesson visibility', () => {
  it('toggles a lesson between shown and hidden without mutating the old set', () => {
    const none = new Set<string>()
    const hidden = toggleHidden(none, 'l2')

    expect([...hidden]).toEqual(['l2'])
    expect(none.size).toBe(0)
    expect([...toggleHidden(hidden, 'l2')]).toEqual([])
    expect([...toggleHidden(hidden, 'l3')].sort()).toEqual(['l2', 'l3'])
  })

  it('counts shown lessons, ignoring hidden ids not in the course', () => {
    expect(countShown(ids, new Set())).toBe(4)
    expect(countShown(ids, new Set(['l1', 'l3']))).toBe(2)
    expect(countShown(ids, new Set(['l1', 'gone']))).toBe(3)
    expect(countShown([], new Set(['l1']))).toBe(0)
  })

  const hidden = new Set(['l2', 'l3'])
  const isShown = (id: string) => !hidden.has(id)
  const titles = (filter: 'all' | 'shown' | 'hidden', query = '') =>
    filterLessons(lessons, { filter, query }, isShown).map((l) => l.id)

  it('filters by visibility', () => {
    expect(titles('all')).toEqual(['l1', 'l2', 'l3', 'l4'])
    expect(titles('shown')).toEqual(['l1', 'l4'])
    expect(titles('hidden')).toEqual(['l2', 'l3'])
  })

  it('searches titles case-insensitively, ignoring surrounding spaces', () => {
    expect(titles('all', 'SHIFT')).toEqual(['l1', 'l2'])
    expect(titles('all', '  refl ')).toEqual(['l3'])
    expect(titles('all', 'שיקוף')).toEqual(['l4'])
    expect(titles('all', 'nothing')).toEqual([])
  })

  it('combines search with the filter', () => {
    expect(titles('shown', 'shift')).toEqual(['l1'])
    expect(titles('hidden', 'shift')).toEqual(['l2'])
    expect(titles('hidden', 'שיקוף')).toEqual([])
  })

  const progress = {
    class: { id: 'c1', name: 'Class' },
    lessons: [{ id: 'l1', title: 'One', questionCount: 3 }],
    students: [],
  }

  it('reads hidden lesson ids from the progress response', () => {
    expect(
      classProgressResponseSchema.parse({ ...progress, hiddenLessonIds: ['l1'] }).hiddenLessonIds,
    ).toEqual(['l1'])
  })

  it('still parses older progress responses without hidden lesson ids', () => {
    expect(classProgressResponseSchema.parse(progress).hiddenLessonIds).toBeUndefined()
    expect(() =>
      classProgressResponseSchema.parse({ ...progress, hiddenLessonIds: [''] }),
    ).toThrow()
  })
})
