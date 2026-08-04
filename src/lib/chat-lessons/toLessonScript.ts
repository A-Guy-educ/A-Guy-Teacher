/**
 * @fileType transformer
 * @domain chat-lessons
 * @ai-summary Pure function: Payload `chat-lessons` doc → runner's LessonScript.
 *             Only field-mapping and shape conversion here — no validation of
 *             graph correctness (broken `nextStepId` refs, missing terminal
 *             step, etc.). Admin-side validation is the source of truth for
 *             that; the runner tolerates a bad graph by just stopping.
 */

import type {
  LessonScript,
  ScriptOption,
  ScriptStep,
} from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ChatLessonView/types'
import type {
  MultipleChoiceBlock,
  PayloadChatScriptDoc,
  PayloadStepBlock,
  TeacherIntroBlock,
  TextAnswerBlock,
  FinishBlock,
} from './payload-chat-script'

interface ToLessonScriptArgs {
  doc: PayloadChatScriptDoc
  /** Lesson title used as the script's `lessonName` (Payload doc doesn't store this). */
  lessonTitle: string
  /** Optional lesson number label displayed on the start card. */
  lessonNumber?: string
}

export function payloadDocToLessonScript({
  doc,
  lessonTitle,
  lessonNumber,
}: ToLessonScriptArgs): LessonScript {
  return {
    id: doc.id,
    lessonName: lessonTitle,
    lessonNumber,
    highlights: doc.highlights,
    steps: doc.steps.map(toStep),
  }
}

function toStep(block: PayloadStepBlock): ScriptStep {
  switch (block.blockType) {
    case 'teacherIntro':
      return fromTeacherIntro(block)
    case 'multipleChoice':
      return fromMultipleChoice(block)
    case 'textAnswer':
      return fromTextAnswer(block)
    case 'finish':
      return fromFinish(block)
  }
}

function fromTeacherIntro(block: TeacherIntroBlock): ScriptStep {
  return {
    id: block.stepId,
    type: 'rich_text',
    text: block.text,
    content: block.contentHtml,
    next: block.nextStepId,
  }
}

function fromMultipleChoice(block: MultipleChoiceBlock): ScriptStep {
  const options: ScriptOption[] = block.options.map((opt) => ({
    text: opt.text,
    feedback: opt.feedback,
    isCorrect: opt.isCorrect,
    next: opt.nextStepId,
  }))
  return {
    id: block.stepId,
    type: 'multiple_choice',
    text: block.text,
    options,
    correction: block.correctionText ? { text: block.correctionText } : undefined,
  }
}

function fromTextAnswer(block: TextAnswerBlock): ScriptStep {
  return {
    id: block.stepId,
    type: 'text_answer',
    text: block.text,
    expected: block.expected,
    correctFeedback: block.correctFeedback,
    correction: block.correctionText ? { text: block.correctionText } : undefined,
    next: block.nextStepId,
  }
}

function fromFinish(block: FinishBlock): ScriptStep {
  return {
    id: block.stepId,
    type: 'rich_text',
    text: block.text,
    content: block.contentHtml,
    isEnd: true,
  }
}
