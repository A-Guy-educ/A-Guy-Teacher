'use client'

import { cn } from '@/infra/utils/ui'
import { RichTextRenderer } from '@/ui/web/exerciserenderer/blocks/RichTextRenderer'
import type {
  InlineRichText,
  QuestionSelectBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
} from '@/ui/web/exerciserenderer/types'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

interface ChatQuestionSelectBubbleProps {
  block: QuestionSelectBlock
  questionLabel?: string
  onSubmit: (optionText: string, isCorrect: boolean) => void
}

interface Choice {
  id: string
  /** Plain text form for echoing into the student bubble. */
  labelValue: string
  /** Rich-text form for on-screen rendering (supports mediaIds + SVG-aware imgs). */
  labelBlock: InlineRichText
}

/**
 * Chat-native renderer for `question_select` blocks (both MCQ single-select
 * and true/false). Auto-submits on click — no separate "Check" button, no
 * card chrome around the question. Correctness is computed locally against
 * the block's `correctOptionIds` / `correctOptionId` and reported to the
 * parent via `onSubmit(optionText, isCorrect)`.
 *
 * Multi-select MCQs are NOT handled here — the caller should route them to
 * the existing ExerciseRenderer (with `questionCardVariant='flat'`) since
 * multi-select needs a submit-after-selection flow this component skips.
 */
export function ChatQuestionSelectBubble({
  block,
  questionLabel,
  onSubmit,
}: ChatQuestionSelectBubbleProps) {
  const [pickedId, setPickedId] = useState<string | null>(null)

  const choices = getChoices(block)
  const correctIds = getCorrectIds(block)

  const handlePick = (choice: Choice) => {
    if (pickedId) return
    setPickedId(choice.id)
    const isCorrect = correctIds.has(choice.id)
    onSubmit(choice.labelValue, isCorrect)
  }

  return (
    <div className="flex flex-col gap-content-gap">
      {questionLabel && (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary font-extrabold text-body-sm self-start">
          {questionLabel}
        </span>
      )}

      <div className="text-body-md font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={block.prompt} />
      </div>

      <div className="grid grid-cols-1 gap-content-gap-xs mt-2">
        {choices.map((choice) => {
          const isPicked = pickedId === choice.id
          const isDisabled = pickedId !== null
          const isThisCorrect = correctIds.has(choice.id)
          return (
            <button
              key={choice.id}
              type="button"
              disabled={isDisabled}
              onClick={() => handlePick(choice)}
              className={cn(
                'w-full text-right p-3.5 rounded-xl border-2 flex items-center justify-between gap-3',
                'font-semibold text-body-md transition-colors',
                'disabled:cursor-not-allowed',
                !isDisabled &&
                  'border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 text-foreground',
                isDisabled &&
                  !isPicked &&
                  'border-border/40 bg-muted/40 text-muted-foreground opacity-70',
                isPicked && isThisCorrect && 'border-success/60 bg-success/10 text-foreground',
                isPicked && !isThisCorrect && 'border-error/60 bg-error/10 text-foreground',
              )}
            >
              <span className="flex-1 text-right">
                <RichTextRenderer block={choice.labelBlock} />
              </span>
              <ArrowLeft
                className={cn(
                  'w-4 h-4 shrink-0',
                  isPicked && isThisCorrect && 'text-success',
                  isPicked && !isThisCorrect && 'text-error',
                  !isPicked && 'text-primary',
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getChoices(block: QuestionSelectBlock): Choice[] {
  if (block.variant === 'true_false') {
    const tf = block as QuestionSelectTrueFalseBlock
    const options = tf.options ?? [
      { id: 'true', value: true, label: { type: 'rich_text', format: 'md-math-v1', value: 'כן' } },
      {
        id: 'false',
        value: false,
        label: { type: 'rich_text', format: 'md-math-v1', value: 'לא' },
      },
    ]
    return options.map((o) => ({
      id: o.id,
      labelValue: o.label.value,
      labelBlock: o.label,
    }))
  }
  const mcq = block as QuestionSelectMcqBlock
  return mcq.answer.options.map((o) => ({
    id: o.id,
    labelValue: o.content.value,
    labelBlock: o.content,
  }))
}

function getCorrectIds(block: QuestionSelectBlock): Set<string> {
  if (block.variant === 'true_false') {
    const id = (block as QuestionSelectTrueFalseBlock).answer.correctOptionId
    return new Set(id ? [id] : [])
  }
  return new Set((block as QuestionSelectMcqBlock).answer.correctOptionIds)
}
