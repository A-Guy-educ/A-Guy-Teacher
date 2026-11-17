import { useCallback, useRef, useState } from 'react'

// Which lessons of a class's course students can see. Teacher keeps the hidden lesson ids,
// so every lesson is shown until the teacher hides it. Web stores them per class and stops
// showing hidden lessons to students; Teacher saves through its own route, never Web directly.

export type VisibilityFilter = 'all' | 'shown' | 'hidden'

export type SaveLessonHidden = (classId: string, lessonId: string, hidden: boolean) => Promise<void>

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

export const saveLessonHidden: SaveLessonHidden = async (classId, lessonId, hidden) => {
  const response = await fetch(
    `/api/classes/${encodeURIComponent(classId)}/lessons/${encodeURIComponent(lessonId)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hidden }),
    },
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
}

function setHidden(hidden: ReadonlySet<string>, lessonId: string, value: boolean) {
  return hidden.has(lessonId) === value ? hidden : toggleHidden(hidden, lessonId)
}

interface VisibilityState {
  classId: string
  // Bumped whenever the class changes, so a reply from an earlier visit is ignored.
  visit: number
  hidden: ReadonlySet<string>
  failedLessonId: string | null
}

/**
 * Seeds from the server's hidden ids (missing = none hidden). A toggle shows at once and is
 * then saved; if saving fails, that lesson flips back and `failedLessonId` names it.
 */
export function useLessonVisibility(
  classId: string,
  lessonIds: readonly string[],
  initialHidden: readonly string[] = [],
  save: SaveLessonHidden = saveLessonHidden,
) {
  const [state, setState] = useState<VisibilityState>(() => ({
    classId,
    visit: 0,
    hidden: new Set(initialHidden),
    failedLessonId: null,
  }))
  // Latest request per lesson: only that one may roll the lesson back.
  const latest = useRef(new Map<string, number>())
  const requests = useRef(0)

  let current = state
  if (state.classId !== classId) {
    current = {
      classId,
      visit: state.visit + 1,
      hidden: new Set(initialHidden),
      failedLessonId: null,
    }
    setState(current)
  }
  const { hidden, visit } = current

  const isShown = useCallback((lessonId: string) => !hidden.has(lessonId), [hidden])

  const toggle = useCallback(
    (lessonId: string) => {
      const hide = !hidden.has(lessonId)
      const request = ++requests.current
      latest.current.set(lessonId, request)
      const update = (value: boolean, failedLessonId: string | null) =>
        setState((s) =>
          s.visit === visit
            ? { ...s, hidden: setHidden(s.hidden, lessonId, value), failedLessonId }
            : s,
        )

      update(hide, null)
      save(classId, lessonId, hide).catch(() => {
        if (latest.current.get(lessonId) === request) update(!hide, lessonId)
      })
    },
    [classId, hidden, save, visit],
  )

  return {
    isShown,
    toggle,
    shownCount: countShown(lessonIds, hidden),
    failedLessonId: current.failedLessonId,
  }
}
