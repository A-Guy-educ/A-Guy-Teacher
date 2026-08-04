/**
 * @fileType types
 * @domain lessons
 * @ai-summary Types for the scripted chat-lesson runner. The lesson is a graph
 *             of steps traversed via `next` IDs. All correctness checks are
 *             encoded in the JSON (no AI in the loop for v0).
 */

export type ScriptStepType = 'multiple_choice' | 'rich_text' | 'text_answer'

export interface ScriptOption {
  text: string
  value?: string
  feedback?: string
  isCorrect?: boolean
  next?: string
}

export interface ScriptCorrection {
  text: string
  content?: string
}

export interface ScriptStep {
  id: string
  type: ScriptStepType
  /** Teacher message shown when the step appears. Supports $...$ math. */
  text: string
  /** Optional inline HTML rendered under the teacher text (rich_text steps). */
  content?: string
  /** Multiple-choice options (multiple_choice steps). */
  options?: ScriptOption[]
  /** Expected answer for text_answer steps — compared via case-insensitive trim. */
  expected?: string
  /** Feedback shown when the text_answer matches `expected`. */
  correctFeedback?: string
  /** Shown when the student picks a wrong option or gives a wrong text answer. */
  correction?: ScriptCorrection
  /** ID of the next step to advance to. Wrong MC picks may still fall through here. */
  next?: string
  isEnd?: boolean
}

export interface LessonScript {
  id: string
  lessonName: string
  lessonNumber?: string
  highlights?: string
  steps: ScriptStep[]
}

export type HistoryRole = 'teacher' | 'student'

export interface HistoryEntry {
  key: string
  role: HistoryRole
  /** For teacher bubbles: the step id; for student bubbles: a synthetic id. */
  refId: string
  text: string
  content?: string
  /** Present only for teacher rendering. Empty for student entries. */
  options?: ScriptOption[]
  /** Correction & feedback teacher bubbles carry these flags for styling. */
  variant?: 'default' | 'correction' | 'feedback'
  /** Present on student answer bubbles. */
  isCorrect?: boolean
  /** For text_answer / continue interactions on the latest teacher bubble. */
  stepType?: ScriptStepType
  /** Expected answer surfaced to the text-answer bubble so it can grade locally. */
  expected?: string
  /** Whether this is the terminal "end of lesson" bubble. */
  isEnd?: boolean
}
