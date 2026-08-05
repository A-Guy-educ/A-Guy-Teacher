'use client'

import type { Exercise, Media } from '@/infra/types/content'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'
import type { QuestionSelectBlock } from '@/ui/web/exerciserenderer/types'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { useCallback, useMemo, useRef } from 'react'
import type { SectionOutcome } from '../types'
import { TeacherBubble } from './TeacherBubble'
import { ChatQuestionSelectBubble } from './ChatQuestionSelectBubble'

interface ExerciseSectionBubbleProps {
  exercise: Exercise
  ordinal: number
  group: ExerciseBlockGroup
  questionCount: number
  lessonId: string
  mediaMap?: Record<string, Media>
  /** Speak the section's teacher header line if the chrome renders one. */
  onSpeak?: () => void
  speaking?: boolean
  muted?: boolean
  ttsSupported?: boolean
  /**
   * Fires when the student has finished the section — either all questions
   * checked correctly or at least one wrong. Fires once. Not called for
   * intro-only groups (questionCount === 0).
   */
  onOutcome?: (outcome: SectionOutcome) => void
  /**
   * Fires per-question when the student picks an answer in the chat-native
   * path. Used by the runner to emit right-aligned student bubbles into the
   * shared stream. Not called in the fallback (ExerciseRenderer) path — those
   * students see the check button + inline correct/wrong strip instead.
   */
  onQuestionSubmit?: (text: string, isCorrect: boolean) => void
}

/**
 * A section rendered as a chat bubble. Two rendering paths:
 *
 * - CHAT-NATIVE: when every question in the section is a single-select
 *   `question_select` (mcq single-select OR true/false). Renders the prompt
 *   as a chat message, options as chat buttons that auto-submit on click,
 *   and echoes each pick as a right-side student bubble in the stream via
 *   `onQuestionSubmit`. Non-question blocks (rich_text) render inline.
 *
 * - FALLBACK: any other shape (multi-select mcq, free-response, table,
 *   matching, geometry, axis, svg, etc.) drops through to the shared
 *   `ExerciseRenderer` with `questionCardVariant='flat'` so the internal
 *   card chrome is stripped to blend inside the bubble.
 *
 * Both paths report the section-level outcome via `onOutcome` exactly once.
 */
export function ExerciseSectionBubble({
  exercise,
  ordinal,
  group,
  questionCount,
  lessonId,
  mediaMap,
  onSpeak,
  speaking,
  muted,
  ttsSupported,
  onOutcome,
  onQuestionSubmit,
}: ExerciseSectionBubbleProps) {
  const outcomeReportedRef = useRef(false)

  const isChatNativePath = useMemo(() => isChatNativeSection(group), [group])

  // ── FALLBACK path ────────────────────────────────────────────────────────
  // Existing aggregate onResultsChange from ExerciseRenderer; fires onOutcome
  // once the section has been fully checked via the Check button flow.
  const handleAggregateResults = useCallback(
    (results: { totalQuestions: number; checkedCount: number; correctCount: number }) => {
      if (outcomeReportedRef.current) return
      if (results.totalQuestions === 0) return
      if (results.checkedCount < results.totalQuestions) return
      outcomeReportedRef.current = true
      onOutcome?.(results.correctCount === results.totalQuestions ? 'correct' : 'wrong')
    },
    [onOutcome],
  )

  // ── CHAT-NATIVE path ─────────────────────────────────────────────────────
  // Per-question submits accumulate here; when every question in the section
  // has been picked we emit the section outcome exactly once.
  const submittedCountRef = useRef(0)
  const correctCountRef = useRef(0)
  const chatNativeQuestionCount = useMemo(
    () => (isChatNativePath ? group.blocks.filter(isQuestionSelect).length : 0),
    [group.blocks, isChatNativePath],
  )

  const handleChatNativeSubmit = useCallback(
    (text: string, isCorrect: boolean) => {
      submittedCountRef.current += 1
      if (isCorrect) correctCountRef.current += 1
      onQuestionSubmit?.(text, isCorrect)

      if (
        !outcomeReportedRef.current &&
        submittedCountRef.current >= chatNativeQuestionCount &&
        chatNativeQuestionCount > 0
      ) {
        outcomeReportedRef.current = true
        onOutcome?.(correctCountRef.current === chatNativeQuestionCount ? 'correct' : 'wrong')
      }
    },
    [chatNativeQuestionCount, onOutcome, onQuestionSubmit],
  )

  return (
    <TeacherBubble onSpeak={onSpeak} speaking={speaking} muted={muted} ttsSupported={ttsSupported}>
      {isChatNativePath ? (
        <div className="flex flex-col gap-content-gap">
          {group.blocks.map((block) => {
            if (isQuestionSelect(block)) {
              return (
                <ChatQuestionSelectBubble
                  key={block.id}
                  block={block as QuestionSelectBlock}
                  onSubmit={handleChatNativeSubmit}
                />
              )
            }
            if (block.type === 'rich_text') {
              const rt = block as { id: string; type: 'rich_text'; value: string }
              return (
                <div
                  key={block.id}
                  className="text-body-md font-medium text-foreground leading-relaxed"
                >
                  <MathMarkdown content={rt.value} />
                </div>
              )
            }
            return null
          })}
        </div>
      ) : (
        <ExerciseRenderer
          groups={[group]}
          mediaMap={mediaMap}
          exerciseNumber={ordinal}
          showExerciseNumber={false}
          lessonId={lessonId}
          exerciseId={exercise.id}
          hideLatexBlocks
          questionCardVariant="flat"
          onResultsChange={questionCount > 0 ? handleAggregateResults : undefined}
        />
      )}
    </TeacherBubble>
  )
}

/**
 * A section is chat-native only when every question block is a single-select
 * question_select. Multi-select and other question types force the fallback.
 */
function isChatNativeSection(group: ExerciseBlockGroup): boolean {
  let hasAnyQuestion = false
  for (const block of group.blocks) {
    const type = block.type
    if (type === 'question_select') {
      hasAnyQuestion = true
      const b = block as unknown as QuestionSelectBlock
      if (b.variant === 'mcq' && b.answer.multiSelect) return false
      continue
    }
    if (
      type === 'question_free_response' ||
      type === 'question_table' ||
      type === 'question_matching' ||
      type === 'question_geometry' ||
      type === 'question_axis'
    ) {
      return false
    }
    // Non-question blocks (rich_text, latex, svg, media) are fine — they
    // render either inline (rich_text) or are skipped in the chat path.
  }
  return hasAnyQuestion
}

function isQuestionSelect(block: { type: string }): boolean {
  return block.type === 'question_select'
}
