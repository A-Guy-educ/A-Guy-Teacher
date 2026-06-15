'use client'

import { useState } from 'react'

type LessonIntroPageState =
  | { type: 'intro' }
  | { type: 'content'; initialExerciseIndex: number }
  | { type: 'workspace' }

interface UseLessonIntroPageOptions {
  /**
   * Exercise ID (slug or numeric ID) from ?exerciseId= search param.
   * When provided, the intro is skipped and workspace is shown directly (deep-link).
   */
  deepLinkedExerciseId?: string | null
}

export function useLessonIntroPage({ deepLinkedExerciseId }: UseLessonIntroPageOptions) {
  const [pageState, setPageState] = useState<LessonIntroPageState>(
    deepLinkedExerciseId ? { type: 'workspace' } : { type: 'intro' },
  )

  const handleStart = (initialExerciseIndex = 0) => {
    setPageState({ type: 'content', initialExerciseIndex })
  }

  return {
    pageState,
    handleStart,
  }
}
