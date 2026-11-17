import { useCallback, useState } from 'react'

// Which lessons of a class's course students can see. Teacher keeps the hidden lesson ids,
// so every lesson is shown until the teacher hides it. Nothing is saved yet: this maps onto
// a future per-class field on Web's classes collection, and only useLessonVisibility changes then.

export type VisibilityFilter = 'all' | 'shown' | 'hidden'

const NONE: ReadonlySet<string> = new Set()

export function toggleHidden(hidden: ReadonlySet<string>, lessonId: string): ReadonlySet<string> {
  const next = new Set(hidden)
  if (next.has(lessonId)) next.delete(lessonId)
  else next.add(lessonId)
  return next
}

/** Counts only ids in `lessonIds`, so a stale hidden id never skews the counter. */
export function countShown(lessonIds: readonly string[], hidden: ReadonlySet<string>): number {
  return lessonIds.filter((id) => !hidden.has(id)).length
}

export function filterLessons<T extends { id: string; title: string }>(
  lessons: readonly T[],
  { filter, query }: { filter: VisibilityFilter; query: string },
  isShown: (lessonId: string) => boolean,
): T[] {
  const needle = query.trim().toLocaleLowerCase()
  return lessons.filter(
    (l) =>
      (filter === 'all' || (filter === 'shown') === isShown(l.id)) &&
      l.title.toLocaleLowerCase().includes(needle),
  )
}

export function useLessonVisibility(classId: string, lessonIds: readonly string[]) {
  // Keyed by class so switching classes starts over even without a remount.
  const [state, setState] = useState({ classId, hidden: NONE })
  const hidden = state.classId === classId ? state.hidden : NONE

  const isShown = useCallback((lessonId: string) => !hidden.has(lessonId), [hidden])
  const toggle = useCallback(
    (lessonId: string) =>
      setState((s) => ({
        classId,
        hidden: toggleHidden(s.classId === classId ? s.hidden : NONE, lessonId),
      })),
    [classId],
  )

  return { isShown, toggle, shownCount: countShown(lessonIds, hidden) }
}
