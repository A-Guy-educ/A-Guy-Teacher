/**
 * @fileType types
 * @domain lessons
 * @ai-summary Types for the Chat view — a visual reskin of the Interactive
 *             tab. The runner walks the lesson's existing exercises (no
 *             authored script), rendering each as a chat bubble. Freeform
 *             student questions go to the existing /api/agent/chat endpoint
 *             with the current exercise's context injected.
 */

import type { Exercise } from '@/infra/types/content'

/** Everything rendered in the chat stream is a StreamEntry. */
export type StreamEntry =
  | ExerciseIntroEntry
  | ExerciseEntry
  | ChatUserEntry
  | ChatAssistantEntry
  | ChatPendingEntry
  | ChatErrorEntry
  | LessonCompleteEntry

interface EntryBase {
  /** Stable React key + identity for updates (e.g. replacing pending → assistant). */
  key: string
}

/** Static "let's do the next one" bubble between exercises. */
export interface ExerciseIntroEntry extends EntryBase {
  kind: 'exercise-intro'
  exerciseIndex: number
  /** Ordinal shown to the student, 1-based. */
  ordinal: number
  title?: string
}

/** The exercise itself, rendered via the shared ExerciseRenderer inside a bubble. */
export interface ExerciseEntry extends EntryBase {
  kind: 'exercise'
  exerciseIndex: number
  ordinal: number
  exercise: Exercise
}

/** Student's freeform question typed into the chat input. */
export interface ChatUserEntry extends EntryBase {
  kind: 'chat-user'
  text: string
}

/** Response from /api/agent/chat. */
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

/** Terminal bubble shown once the last exercise is done. */
export interface LessonCompleteEntry extends EntryBase {
  kind: 'lesson-complete'
}
