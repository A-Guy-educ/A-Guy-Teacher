'use client'

import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'

interface ExercisePageContentProps {
  groups: ExerciseBlockGroup[]
  showQuestionNumbering?: boolean
}

export function ExercisePageContent({
  groups,
  showQuestionNumbering = false,
}: ExercisePageContentProps) {
  return (
    <div className="mt-8 p-card-padding-lg md:p-card-padding sm:p-card-padding-sm bg-card rounded-lg shadow-elevation-1">
      <ExerciseRenderer
        groups={groups}
        mode="student"
        showCheckAnswer={true}
        showExerciseNumber={showQuestionNumbering}
      />
    </div>
  )
}
