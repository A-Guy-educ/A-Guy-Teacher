'use client'

import { cn } from '@/infra/utils/ui'
import type { Exercise, Media } from '@/infra/types/content'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { useCallback, useRef } from 'react'
import type { SectionOutcome } from '../types'

interface ExerciseSectionBubbleProps {
  exercise: Exercise
  ordinal: number
  group: ExerciseBlockGroup
  questionCount: number
  lessonId: string
  mediaMap?: Record<string, Media>
  /**
   * Fires exactly once — when the student has checked every question in the
   * section. `correct` when all answers matched; `wrong` when at least one
   * was off. Not fired at all for intro-only groups (questionCount === 0).
   */
  onOutcome?: (outcome: SectionOutcome) => void
}

/**
 * One section of an exercise, rendered as a teacher-style chat bubble.
 * Answer UI, per-question letter labels, and local correctness checking
 * come from the shared ExerciseRenderer — this component only slices the
 * exercise down to a single group and translates the aggregate results
 * into a one-shot outcome signal for the runner.
 */
export function ExerciseSectionBubble({
  exercise,
  ordinal,
  group,
  questionCount,
  lessonId,
  mediaMap,
  onOutcome,
}: ExerciseSectionBubbleProps) {
  const reportedRef = useRef(false)

  const handleResults = useCallback(
    (results: { totalQuestions: number; checkedCount: number; correctCount: number }) => {
      if (reportedRef.current) return
      if (results.totalQuestions === 0) return
      if (results.checkedCount < results.totalQuestions) return
      reportedRef.current = true
      onOutcome?.(results.correctCount === results.totalQuestions ? 'correct' : 'wrong')
    },
    [onOutcome],
  )

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[95%] w-full rounded-2xl rounded-tr-none border border-border bg-card',
          'p-card-padding-sm md:p-card-padding shadow-elevation-1',
        )}
      >
        <ExerciseRenderer
          groups={[group]}
          mediaMap={mediaMap}
          exerciseNumber={ordinal}
          showExerciseNumber={false}
          lessonId={lessonId}
          exerciseId={exercise.id}
          hideLatexBlocks
          onResultsChange={questionCount > 0 ? handleResults : undefined}
        />
      </div>
    </div>
  )
}
