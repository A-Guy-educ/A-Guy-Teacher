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
}

export function useLessonIntroPage({
  deepLinkedExerciseId,
  hasContentPagesPreamble = false,
}: UseLessonIntroPageOptions) {
  const [pageState, setPageState] = useState<LessonIntroPageState>(
    deepLinkedExerciseId ? { type: 'workspace' } : { type: 'intro' },
  )

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
