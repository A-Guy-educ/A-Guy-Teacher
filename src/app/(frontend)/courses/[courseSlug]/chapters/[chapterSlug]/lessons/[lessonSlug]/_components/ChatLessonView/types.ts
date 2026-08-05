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

/** Student's freeform question typed into the chat input. */
export interface ChatUserEntry extends EntryBase {
  kind: 'chat-user'
  text: string
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

/** Reported by ExerciseSectionBubble when the student finishes the section. */
export type SectionOutcome = 'correct' | 'wrong'
