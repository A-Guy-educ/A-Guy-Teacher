/**
 * @fileType types
 * @domain lessons
 * @ai-summary Types for the Chat view — a visual reskin of the Interactive
 *             tab. The runner walks the lesson's existing exercises section
 *             by section (via getExerciseBlockGroups), rendering each group
 *             as its own chat bubble. Freeform student questions go to the
 *             existing /api/agent/chat endpoint with the current exercise's
 *             context injected.
 */

import type { Exercise } from '@/infra/types/content'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'

/** Everything rendered in the chat stream is a StreamEntry. */
export type StreamEntry =
  | ExerciseIntroEntry
  | ExerciseSectionEntry
  | ChatUserEntry
  | ChatAssistantEntry
  | ChatPendingEntry
  | ChatErrorEntry
  | LessonCompleteEntry

interface EntryBase {
  /** Stable React key + identity for dedupe / replacement. */
  key: string
}

/** "Exercise N: title" intro bubble — shown once per exercise (before its first section). */
export interface ExerciseIntroEntry extends EntryBase {
  kind: 'exercise-intro'
  exerciseIndex: number
  ordinal: number
  title?: string
}

/** One section (== one ExerciseBlockGroup) rendered inside a teacher bubble. */
export interface ExerciseSectionEntry extends EntryBase {
  kind: 'exercise-section'
  exerciseIndex: number
  ordinal: number
  exercise: Exercise
  group: ExerciseBlockGroup
  /** Number of question blocks in the group; 0 for intro-only groups. */
  questionCount: number
}

/**
 * Right-aligned student bubble. Two sources feed this entry:
 *   1. Freeform questions typed into the ChatInputPanel (no `isCorrect`).
 *   2. Multiple-choice picks in the chat-native section renderer, which
 *      echoes the student's chosen option here with `isCorrect` set so
 *      StudentBubble can color the bubble green/red immediately.
 */
export interface ChatUserEntry extends EntryBase {
  kind: 'chat-user'
  text: string
  isCorrect?: boolean
}

/** Response from /api/agent/chat OR a canned "well done" line. */
export interface ChatAssistantEntry extends EntryBase {
  kind: 'chat-assistant'
  text: string
}

/** In-flight indicator while waiting for the AI response. */
export interface ChatPendingEntry extends EntryBase {
  kind: 'chat-pending'
}

/** Displayed when /api/agent/chat fails (network, quota, auth). */
export interface ChatErrorEntry extends EntryBase {
  kind: 'chat-error'
  text: string
}

/** Terminal bubble shown once the last section is done. */
export interface LessonCompleteEntry extends EntryBase {
  kind: 'lesson-complete'
}

/**
 * Reported by ExerciseSectionBubble when the student finishes the section.
 * `correctAnswerText` is populated on wrong outcomes when the section's
 * blocks let us extract the expected answer (currently: question_select
 * options with `isCorrect` / `correctOptionId`). The runner uses it to
 * post a "correct answer: X" bubble before the AI correction, so the
 * student sees the actual answer immediately without waiting on the model.
 */
export type SectionOutcome = { kind: 'correct' } | { kind: 'wrong'; correctAnswerText?: string }
