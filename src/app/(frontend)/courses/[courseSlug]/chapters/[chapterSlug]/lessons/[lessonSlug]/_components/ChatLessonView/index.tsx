/**
 * @fileType component
 * @domain lessons
 * @pattern chat-view
 * @ai-summary Chat-view tab for a lesson. Renders the lesson's existing
 *             exercises one at a time as chat bubbles, with the shared
 *             ExerciseRenderer handling all answer UI + correctness checks.
 *             A freeform chat input at the bottom talks to the same
 *             /api/agent/chat endpoint the Interactive tab uses, so students
 *             can ask questions with the current exercise's context already
 *             injected server-side.
 *
 *             No authored scripts, no per-lesson content collection — this
 *             is a visual reskin of the Interactive flow.
 */

'use client'

import type { Exercise, FormulaSheet, Media } from '@/infra/types/content'
import type { ReactNode } from 'react'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatLessonRunnerView } from './ChatLessonRunnerView'

interface ChatLessonViewProps {
  lessonTitle: string
  backUrl: string
  lessonId: string
  exercises: Exercise[]
  mediaMap?: Record<string, Media>
  formulaSheet?: FormulaSheet | null
  headerSlot?: ReactNode
}

export function ChatLessonView({
  lessonTitle,
  backUrl,
  lessonId,
  exercises,
  mediaMap,
  formulaSheet,
  headerSlot,
}: ChatLessonViewProps) {
  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      formulaSheet={formulaSheet}
      primaryContent={
        <div className="flex h-full flex-col">
          {headerSlot}
          <ChatLessonRunnerView
            lessonTitle={lessonTitle}
            lessonId={lessonId}
            exercises={exercises}
            mediaMap={mediaMap}
          />
        </div>
      }
    />
  )
}
