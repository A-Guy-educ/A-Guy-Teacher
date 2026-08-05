/**
 * @fileType component
 * @domain lessons
 * @pattern chat-view
 * @ai-summary Chat-view tab for a lesson. Renders a scripted teacher⇄student
 *             conversation in a single scrollable column. All correctness
 *             checks and feedback live in the lesson script (no AI in the
 *             runtime loop). TTS uses the browser voice by default — swap to a
 *             hosted TTS if higher fidelity is needed later.
 *
 *             Real scripts are authored per-lesson in the `chat-lessons`
 *             Payload collection and fetched server-side (see
 *             `getChatScriptByLessonId` + `payloadDocToLessonScript`). When the
 *             admin has enabled the Chat tab but no script has been authored
 *             yet, we fall back to `demoLesson` so the tab still renders
 *             something meaningful during rollout.
 */

'use client'

import type { FormulaSheet } from '@/infra/types/content'
import type { ReactNode } from 'react'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatLessonRunnerView } from './ChatLessonRunnerView'
import { demoLesson } from './demoLesson'
import type { LessonScript } from './types'

interface ChatLessonViewProps {
  lessonTitle: string
  backUrl: string
  formulaSheet?: FormulaSheet | null
  headerSlot?: ReactNode
  script?: LessonScript
}

export function ChatLessonView({
  lessonTitle,
  backUrl,
  formulaSheet,
  headerSlot,
  script,
}: ChatLessonViewProps) {
  const activeScript = script ?? demoLesson

  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      formulaSheet={formulaSheet}
      primaryContent={
        <div className="flex h-full flex-col">
          {headerSlot}
          <ChatLessonRunnerView script={activeScript} />
        </div>
      }
    />
  )
}
