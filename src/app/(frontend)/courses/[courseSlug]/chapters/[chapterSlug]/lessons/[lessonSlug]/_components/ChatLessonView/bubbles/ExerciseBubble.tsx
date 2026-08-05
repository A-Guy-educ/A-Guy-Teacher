'use client'

import { cn } from '@/infra/utils/ui'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { getExerciseBlockGroups } from '@/lib/exercises/getExerciseBlocks'
import type { Exercise, Media } from '@/infra/types/content'

interface ExerciseBubbleProps {
  exercise: Exercise
  ordinal: number
  lessonId: string
  mediaMap?: Record<string, Media>
  hideLatexBlocks?: boolean
}

/**
 * Wraps the shared ExerciseRenderer inside a teacher-style bubble so the
 * Chat view can present each exercise as another turn in the conversation.
 * All correctness checking, help, and per-question answer UI still lives in
 * ExerciseRenderer — this component is purely presentational chrome.
 */
export function ExerciseBubble({
  exercise,
  ordinal,
  lessonId,
  mediaMap,
  hideLatexBlocks = true,
}: ExerciseBubbleProps) {
  const groups = getExerciseBlockGroups(exercise)

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[95%] w-full rounded-2xl rounded-tr-none border border-border bg-card',
          'p-card-padding-sm md:p-card-padding shadow-elevation-1',
        )}
      >
        <ExerciseRenderer
          groups={groups}
          mediaMap={mediaMap}
          exerciseNumber={ordinal}
          showExerciseNumber={false}
          lessonId={lessonId}
          exerciseId={exercise.id}
          hideLatexBlocks={hideLatexBlocks}
        />
      </div>
    </div>
  )
}
