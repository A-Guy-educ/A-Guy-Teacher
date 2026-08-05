/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Walks the lesson's exercises section-by-section for the Chat
 *             view. Each exercise is flattened into its ExerciseBlockGroup
 *             list (via getExerciseBlockGroups) up-front; the walker then
 *             advances one group at a time. Each exercise emits one intro
 *             bubble before its first group; the terminal bubble is emitted
 *             after the last group of the last exercise.
 *
 *             The parent owns the stream entries array; this hook just
 *             dispatches append() calls at the right moments. Chat channel
 *             entries (student questions + AI replies) share the same
 *             entries state and interleave naturally by insertion order.
 */

'use client'

import type { Exercise } from '@/infra/types/content'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'
import { getExerciseBlockGroups } from '@/lib/exercises/getExerciseBlocks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StreamEntry } from './types'

/** Block types that require the student to submit an answer. */
const QUESTION_BLOCK_TYPES = new Set([
  'question_select',
  'question_free_response',
  'question_table',
  'question_matching',
  'question_geometry',
  'question_axis',
])

interface WalkerStep {
  exerciseIndex: number
  ordinal: number
  exercise: Exercise
  group: ExerciseBlockGroup
  /** Index of this group WITHIN the exercise (0-based). */
  groupIndex: number
  /** Number of groups the exercise has (used to know when to emit the intro). */
  groupsInExercise: number
  questionCount: number
}

function flattenSteps(exercises: Exercise[]): WalkerStep[] {
  const out: WalkerStep[] = []
  exercises.forEach((exercise, exerciseIndex) => {
    const groups = getExerciseBlockGroups(exercise)
    const groupsInExercise = groups.length
    if (groupsInExercise === 0) return
    groups.forEach((group, groupIndex) => {
      const questionCount = group.blocks.filter((b) =>
        QUESTION_BLOCK_TYPES.has(b.type as string),
      ).length
      out.push({
        exerciseIndex,
        ordinal: exerciseIndex + 1,
        exercise,
        group,
        groupIndex,
        groupsInExercise,
        questionCount,
      })
    })
  })
  return out
}

interface UseExerciseWalkerArgs {
  exercises: Exercise[]
  append: (entry: StreamEntry) => void
}

export function useExerciseWalker({ exercises, append }: UseExerciseWalkerArgs) {
  const steps = useMemo(() => flattenSteps(exercises), [exercises])
  const [stepCursor, setStepCursor] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const seededRef = useRef(false)

  const emitStep = useCallback(
    (idx: number) => {
      const step = steps[idx]
      if (!step) return
      // Prefix each exercise with a single intro bubble (before its first group).
      if (step.groupIndex === 0) {
        append({
          key: `intro-${step.exercise.id}`,
          kind: 'exercise-intro',
          exerciseIndex: step.exerciseIndex,
          ordinal: step.ordinal,
          title: step.exercise.title ?? undefined,
        })
      }
      append({
        key: `sec-${step.exercise.id}-${step.groupIndex}`,
        kind: 'exercise-section',
        exerciseIndex: step.exerciseIndex,
        ordinal: step.ordinal,
        exercise: step.exercise,
        group: step.group,
        questionCount: step.questionCount,
      })
    },
    [append, steps],
  )

  // Seed the first step once, guarded so React 18 strict-mode double
  // invocation doesn't re-emit.
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (steps.length === 0) {
      setIsComplete(true)
      append({ key: 'lesson-complete', kind: 'lesson-complete' })
      return
    }
    emitStep(0)
  }, [append, emitStep, steps.length])

  const advance = useCallback(() => {
    if (isComplete) return
    const next = stepCursor + 1
    if (next >= steps.length) {
      setIsComplete(true)
      append({ key: 'lesson-complete', kind: 'lesson-complete' })
      return
    }
    setStepCursor(next)
    emitStep(next)
  }, [append, emitStep, isComplete, stepCursor, steps.length])

  const currentStep = steps[stepCursor] ?? null

  return {
    currentStep,
    /** 0-based cursor into the flattened step list — drives the progress bar. */
    stepCursor,
    totalSteps: steps.length,
    isComplete,
    advance,
  }
}
