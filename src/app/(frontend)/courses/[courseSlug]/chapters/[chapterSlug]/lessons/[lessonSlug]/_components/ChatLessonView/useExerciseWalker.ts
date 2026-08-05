/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Walks the lesson's exercises for the Chat view. On mount, seeds
 *             the first intro + exercise bubble. `advance()` appends the next
 *             pair, or a lesson-complete bubble when there are no more.
 *
 *             The parent owns the stream entries array; this hook just
 *             dispatches append() calls at the right moments. Chat channel
 *             entries (student questions + AI responses) share the same
 *             entries state and interleave naturally by insertion order.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Exercise } from '@/infra/types/content'
import type { StreamEntry } from './types'

interface UseExerciseWalkerArgs {
  exercises: Exercise[]
  /** Append callback owned by the parent — order of calls === order in the stream. */
  append: (entry: StreamEntry) => void
}

export function useExerciseWalker({ exercises, append }: UseExerciseWalkerArgs) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const seededRef = useRef(false)

  const emitExercise = useCallback(
    (index: number) => {
      const exercise = exercises[index]
      if (!exercise) return
      const ordinal = index + 1
      append({
        key: `intro-${exercise.id}`,
        kind: 'exercise-intro',
        exerciseIndex: index,
        ordinal,
        title: exercise.title ?? undefined,
      })
      append({
        key: `ex-${exercise.id}`,
        kind: 'exercise',
        exerciseIndex: index,
        ordinal,
        exercise,
      })
    },
    [append, exercises],
  )

  // Seed the very first exercise once, after mount. Guarded so React 18
  // strict-mode double invocation doesn't re-emit.
  useEffect(() => {
    if (seededRef.current) return
    if (exercises.length === 0) {
      setIsComplete(true)
      append({ key: 'lesson-complete', kind: 'lesson-complete' })
      seededRef.current = true
      return
    }
    seededRef.current = true
    emitExercise(0)
  }, [append, emitExercise, exercises.length])

  const advance = useCallback(() => {
    if (isComplete) return
    const next = currentIndex + 1
    if (next >= exercises.length) {
      setIsComplete(true)
      append({ key: 'lesson-complete', kind: 'lesson-complete' })
      return
    }
    setCurrentIndex(next)
    emitExercise(next)
  }, [append, currentIndex, emitExercise, exercises.length, isComplete])

  return {
    currentIndex,
    totalExercises: exercises.length,
    isComplete,
    advance,
  }
}
