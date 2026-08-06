'use client'

import { cn } from '@/infra/utils/ui'
import { RotateCcw, Volume2, VolumeX } from 'lucide-react'

interface ChatLessonProgressProps {
  stepIndex: number
  totalSteps: number
  currentExerciseOrdinal: number
  totalExercises: number
  currentSectionOrdinal: number
  currentExerciseSections: number
  exerciseLabel: string
  sectionLabel: string
  onReset: () => void
  onToggleMute?: () => void
  muted?: boolean
  ttsSupported?: boolean
}

export function ChatLessonProgress({
  stepIndex,
  totalSteps,
  currentExerciseOrdinal,
  totalExercises,
  currentSectionOrdinal,
  currentExerciseSections,
  exerciseLabel,
  sectionLabel,
  onReset,
  onToggleMute,
  muted,
  ttsSupported,
}: ChatLessonProgressProps) {
  const clampedIndex = Math.max(0, Math.min(stepIndex, totalSteps - 1))
  const percent = totalSteps > 0 ? Math.round(((clampedIndex + 1) / totalSteps) * 100) : 0

  // Only show the exercise/section text when there's actually a range to show
  // — a single-exercise or single-section lesson doesn't benefit from an
  // "Exercise 1/1" chip and it just adds noise.
  const showExerciseText = totalExercises > 1 && currentExerciseOrdinal > 0
  const showSectionText = currentExerciseSections > 1 && currentSectionOrdinal > 0

  return (
    <div className="border-t border-border bg-card px-4 py-3 print:hidden">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-slow"
            style={{ width: `${percent}%` }}
          />
        </div>

        {(showExerciseText || showSectionText) && (
          <span className="hidden sm:inline text-body-xs font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
            {showExerciseText && `${exerciseLabel} ${currentExerciseOrdinal}/${totalExercises}`}
            {showExerciseText && showSectionText && ' · '}
            {showSectionText &&
              `${sectionLabel} ${currentSectionOrdinal}/${currentExerciseSections}`}
          </span>
        )}

        <span className="text-body-sm font-bold text-primary tabular-nums min-w-[3ch] text-left">
          {percent}%
        </span>
        {ttsSupported && onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'הפעל קול' : 'השתק קול'}
            className={cn(
              'p-2 rounded-lg transition-colors',
              muted
                ? 'bg-muted text-muted-foreground'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          aria-label="התחל מחדש"
          className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
