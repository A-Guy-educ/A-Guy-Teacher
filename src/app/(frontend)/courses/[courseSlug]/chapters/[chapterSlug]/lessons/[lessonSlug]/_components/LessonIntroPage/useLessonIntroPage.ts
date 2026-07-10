'use client'

import { useState } from 'react'

type LessonIntroPageState =
  | { type: 'intro' }
  | { type: 'preamble'; initialExerciseIndex: number }
  | { type: 'content'; initialExerciseIndex: number }
  | { type: 'workspace' }

interface UseLessonIntroPageOptions {
  /**
   * Exercise ID (slug or numeric ID) from ?exerciseId= search param.
   * When provided, the intro is skipped and workspace is shown directly (deep-link).
   */
  deepLinkedExerciseId?: string | null
  /**
   * When true, clicking Start routes through the content-page preamble first.
   * When false, Start goes straight to the content renderer.
   */
  hasContentPagesPreamble?: boolean
  /**
   * Block index from ?block=N search param. When provided, the intro is skipped
   * and the content renderer opens directly at the given block (deep-link from
   * /exercises/[slug] or /content/[slug] route stubs).
   */
  initialBlockIndex?: number | null
}

export function useLessonIntroPage({
  deepLinkedExerciseId,
  hasContentPagesPreamble = false,
  initialBlockIndex,
}: UseLessonIntroPageOptions) {
  const [pageState, setPageState] = useState<LessonIntroPageState>(() => {
    if (deepLinkedExerciseId) return { type: 'workspace' }
    if (
      typeof initialBlockIndex === 'number' &&
      Number.isFinite(initialBlockIndex) &&
      initialBlockIndex >= 0
    ) {
      return { type: 'content', initialExerciseIndex: Math.floor(initialBlockIndex) }
    }
    return { type: 'intro' }
  })

  const handleStart = (initialExerciseIndex = 0) => {
    if (hasContentPagesPreamble && !deepLinkedExerciseId) {
      setPageState({ type: 'preamble', initialExerciseIndex })
      return
    }
    setPageState({ type: 'content', initialExerciseIndex })
  }

  const handleFinishPreamble = (initialExerciseIndex = 0) => {
    setPageState({ type: 'content', initialExerciseIndex })
  }

  return {
    pageState,
    handleStart,
    handleFinishPreamble,
  }
}
