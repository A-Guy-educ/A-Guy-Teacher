/**
 * @fileType types
 * @domain chat-lessons
 * @ai-summary Shape of the `chat-lessons` Payload collection doc as read from
 *             MongoDB. The Web repo declares this contract locally so the
 *             transformer + query are type-safe before the admin repo ships
 *             its generated Payload types. Keep this in lockstep with the
 *             admin collection schema — any change there requires a matching
 *             change here.
 */

/** All step blocks share these fields. */
interface BaseStepBlock {
  /** Author-supplied unique ID within the doc; referenced by `nextStepId`. */
  stepId: string
  /** Teacher line for this step. Rendered via MathMarkdown; supports `$...$`. */
  text: string
}

/** Rich-text intro / narrative step. */
export interface TeacherIntroBlock extends BaseStepBlock {
  blockType: 'teacherIntro'
  /** Optional HTML rendered under the teacher line inside the same bubble. */
  contentHtml?: string
  nextStepId?: string
}

/** Multiple-choice question. */
export interface MultipleChoiceBlock extends BaseStepBlock {
  blockType: 'multipleChoice'
  options: Array<{
    text: string
    feedback?: string
    isCorrect?: boolean
    /** Per-option override; falls back to the step's default `nextStepId`. */
    nextStepId?: string
  }>
  /** Long-form explanation shown when the student picks a wrong option. */
  correctionText?: string
}

/** Free-text answer, graded locally against `expected`. */
export interface TextAnswerBlock extends BaseStepBlock {
  blockType: 'textAnswer'
  expected: string
  correctFeedback?: string
  correctionText?: string
  nextStepId?: string
}

/** Terminal step — no `nextStepId`, marks the end of the lesson. */
export interface FinishBlock extends BaseStepBlock {
  blockType: 'finish'
  contentHtml?: string
}

export type PayloadStepBlock =
  | TeacherIntroBlock
  | MultipleChoiceBlock
  | TextAnswerBlock
  | FinishBlock

export interface PayloadChatScriptDoc {
  id: string
  /** Relationship to the lesson (serialized to an ID string by our query helper). */
  lesson: string
  locale: string
  highlights?: string
  steps: PayloadStepBlock[]
}
