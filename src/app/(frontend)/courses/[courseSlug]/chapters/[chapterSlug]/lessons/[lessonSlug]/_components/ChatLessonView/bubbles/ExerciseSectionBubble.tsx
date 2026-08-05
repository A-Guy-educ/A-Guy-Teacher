'use client'

import type { Exercise, Media } from '@/infra/types/content'
import type { ExerciseBlockGroup, RichTextBlock } from '@/infra/types/exercise'
import type {
  QuestionSelectBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
} from '@/ui/web/exerciserenderer/types'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { RichTextRenderer } from '@/ui/web/exerciserenderer/blocks/RichTextRenderer'
import { MediaMapProvider } from '@/ui/web/exerciserenderer/context/MediaMapContext'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { SectionOutcome } from '../types'
import { TeacherBubble } from './TeacherBubble'
import { ChatQuestionSelectBubble } from './ChatQuestionSelectBubble'
import { QuickActionChips, type QuickAction } from './QuickActionChips'

const EMPTY_MEDIA_MAP: Record<string, Media> = {}

/** Question letters for chat-native multi-question sections. */
const HEBREW_LETTERS = [
  'א',
  'ב',
  'ג',
  'ד',
  'ה',
  'ו',
  'ז',
  'ח',
  'ט',
  'י',
  'כ',
  'ל',
  'מ',
  'נ',
  'ס',
  'ע',
  'פ',
  'צ',
  'ק',
  'ר',
  'ש',
  'ת',
]

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
  /**
   * Fires when the student taps a quick-action chip (hint / explain / skip)
   * on a chat-native section. Runner dispatches: hint/explain → invisible
   * chat request; skip → walker.advance. Chips auto-hide once any question
   * in the section has been answered.
   */
  onQuickAction?: (action: QuickAction) => void
  /** Labels for the chips. Provided by the runner from i18n. */
  quickActionLabels?: { hint: string; explain: string; skip: string }
  /** Disable chips while a chat request is already in flight. */
  quickActionsDisabled?: boolean
  /**
   * True only for the walker's current step. Historical (scroll-back)
   * bubbles pass false, which locks their answer buttons + chips — otherwise
   * a click on an old bubble would dispatch through the runner with the
   * CURRENT step's context (wrong hint / wrong skip target).
   */
  isActive?: boolean
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
  onQuickAction,
  quickActionLabels,
  quickActionsDisabled,
  isActive = true,
}: ExerciseSectionBubbleProps) {
  const outcomeReportedRef = useRef(false)
  // Chips hide the moment the student starts answering — they're a discovery
  // affordance for "what can I do before answering", not a mid-answer HUD.
  const [hasAnyAnswer, setHasAnyAnswer] = useState(false)
  // Block IDs the student answered incorrectly. Used to scope the "correct
  // answer" bubble to ONLY the questions they missed, so a multi-question
  // section doesn't leak answers to questions they got right.
  const wrongBlockIdsRef = useRef<Set<string>>(new Set())

  const isChatNativePath = useMemo(() => isChatNativeSection(group), [group])

  // Correct-answer text for the FALLBACK path (no per-question outcome
  // signal there — we can only echo the whole section's correct answers).
  const allCorrectAnswerText = useMemo(() => deriveCorrectAnswerText(group), [group])

  // ── FALLBACK path ────────────────────────────────────────────────────────
  // Existing aggregate onResultsChange from ExerciseRenderer; fires onOutcome
  // once the section has been fully checked via the Check button flow.
  const handleAggregateResults = useCallback(
    (results: { totalQuestions: number; checkedCount: number; correctCount: number }) => {
      if (outcomeReportedRef.current) return
      if (results.totalQuestions === 0) return
      if (results.checkedCount < results.totalQuestions) return
      outcomeReportedRef.current = true
      if (results.correctCount === results.totalQuestions) {
        onOutcome?.({ kind: 'correct' })
      } else {
        onOutcome?.({ kind: 'wrong', correctAnswerText: allCorrectAnswerText })
      }
    },
    [allCorrectAnswerText, onOutcome],
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

  // Only label individual questions when the section has more than one — a
  // solo question doesn't need a leading "א" badge. Mirrors ExerciseRenderer's
  // per-question letter labels so students can reference "question ב" in a
  // follow-up chat question.
  const questionLabelById = useMemo(() => {
    if (!isChatNativePath || chatNativeQuestionCount < 2) return null
    const map = new Map<string, string>()
    let i = 0
    for (const block of group.blocks) {
      if (isQuestionSelect(block)) {
        map.set(block.id, HEBREW_LETTERS[i] ?? String(i + 1))
        i++
      }
    }
    return map
  }, [chatNativeQuestionCount, group.blocks, isChatNativePath])

  const handleChatNativeSubmit = useCallback(
    (blockId: string, text: string, isCorrect: boolean) => {
      submittedCountRef.current += 1
      if (isCorrect) correctCountRef.current += 1
      else wrongBlockIdsRef.current.add(blockId)
      setHasAnyAnswer(true)
      onQuestionSubmit?.(text, isCorrect)

      if (
        !outcomeReportedRef.current &&
        submittedCountRef.current >= chatNativeQuestionCount &&
        chatNativeQuestionCount > 0
      ) {
        outcomeReportedRef.current = true
        if (correctCountRef.current === chatNativeQuestionCount) {
          onOutcome?.({ kind: 'correct' })
        } else {
          onOutcome?.({
            kind: 'wrong',
            // Scope the echoed "correct answer" to only the questions the
            // student got wrong — don't leak answers to ones they nailed.
            correctAnswerText: deriveCorrectAnswerText(group, wrongBlockIdsRef.current),
          })
        }
      }
    },
    [chatNativeQuestionCount, group, onOutcome, onQuestionSubmit],
  )

  // Wrap chip clicks so a scroll-back click can't dispatch through the runner
  // — and skip in particular counts as "engaged with this section" and hides
  // chips on the currently active bubble too (otherwise chips would linger
  // after skip since no answer was submitted).
  const handleChipAction = useCallback(
    (action: QuickAction) => {
      if (!isActive) return
      if (action === 'skip') setHasAnyAnswer(true)
      onQuickAction?.(action)
    },
    [isActive, onQuickAction],
  )

  return (
    <TeacherBubble onSpeak={onSpeak} speaking={speaking} muted={muted} ttsSupported={ttsSupported}>
      {isChatNativePath ? (
        // MediaMapProvider is required so RichTextRenderer's MediaAttachments
        // (used inside prompts, option labels, and inline rich_text) can look
        // up media by id. The standard ExerciseRenderer path installs this
        // provider itself; the chat-native path has to do it here.
        <MediaMapProvider value={mediaMap ?? EMPTY_MEDIA_MAP}>
          <div className="flex flex-col gap-content-gap">
            {group.blocks.map((block) => {
              if (isQuestionSelect(block)) {
                return (
                  <ChatQuestionSelectBubble
                    key={block.id}
                    block={block as QuestionSelectBlock}
                    questionLabel={questionLabelById?.get(block.id)}
                    // Lock stale scroll-back bubbles + freeze answering while
                    // a chat request is in flight (otherwise the resulting
                    // requestCorrection would be silently dropped).
                    disabled={!isActive || quickActionsDisabled}
                    onSubmit={handleChatNativeSubmit}
                  />
                )
              }
              if (block.type === 'rich_text') {
                const rt = block as RichTextBlock
                return (
                  <div
                    key={block.id}
                    className="text-body-md font-medium text-foreground leading-relaxed"
                  >
                    <RichTextRenderer block={rt} />
                  </div>
                )
              }
              return null
            })}

            {isActive &&
              !hasAnyAnswer &&
              onQuickAction &&
              quickActionLabels &&
              chatNativeQuestionCount > 0 && (
                <QuickActionChips
                  disabled={quickActionsDisabled}
                  hintLabel={quickActionLabels.hint}
                  explainLabel={quickActionLabels.explain}
                  skipLabel={quickActionLabels.skip}
                  onAction={handleChipAction}
                />
              )}
          </div>
        </MediaMapProvider>
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
 * Allowlist guard: a section is chat-native ONLY when every block is either
 * a single-select `question_select` OR a `rich_text` decoration. The
 * chat-native render loop below only knows how to render those two types;
 * anything else (media, svg, html, latex, multi-axis, free-response,
 * table/matching/geometry/axis, multi-select mcq) must fall back to the
 * shared ExerciseRenderer so nothing is silently dropped AND the section
 * outcome doesn't fire prematurely on a partial answer count.
 *
 * Kept as an explicit allowlist (rather than a growing rejectlist) so
 * adding new block types can't accidentally slip through.
 */
function isChatNativeSection(group: ExerciseBlockGroup): boolean {
  let hasAnyQuestion = false
  for (const block of group.blocks) {
    if (block.type === 'rich_text') continue
    if (block.type === 'question_select') {
      hasAnyQuestion = true
      const b = block as unknown as QuestionSelectBlock
      if (b.variant === 'mcq' && b.answer.multiSelect) return false
      continue
    }
    // Any other block type → fallback path. ExerciseRenderer knows how to
    // render media/svg/html/latex/etc. with all their affordances.
    return false
  }
  return hasAnyQuestion
}

function isQuestionSelect(block: { type: string }): boolean {
  return block.type === 'question_select'
}

/**
 * Extract a joined "correct answer" string from question_select blocks in
 * the group. When `onlyBlockIds` is provided, restricts to those block IDs —
 * used by the chat-native path to echo answers ONLY for questions the
 * student got wrong (so a multi-question section doesn't leak answers to
 * ones they got right). Without the filter, echoes every question's answer
 * (used by the fallback path where per-question outcomes aren't available).
 */
function deriveCorrectAnswerText(
  group: ExerciseBlockGroup,
  onlyBlockIds?: Set<string>,
): string | undefined {
  const parts: string[] = []
  for (const block of group.blocks) {
    if (block.type !== 'question_select') continue
    if (onlyBlockIds && !onlyBlockIds.has(block.id)) continue
    const q = block as unknown as QuestionSelectBlock
    if (q.variant === 'true_false') {
      const tf = q as QuestionSelectTrueFalseBlock
      const correctId = tf.answer.correctOptionId
      const opt = tf.options?.find((o) => o.id === correctId)
      if (opt) parts.push(opt.label.value)
      continue
    }
    const mcq = q as QuestionSelectMcqBlock
    const correctIds = new Set(mcq.answer.correctOptionIds)
    const correctOpts = mcq.answer.options.filter((o) => correctIds.has(o.id))
    if (correctOpts.length > 0) {
      parts.push(correctOpts.map((o) => o.content.value).join(', '))
    }
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}
