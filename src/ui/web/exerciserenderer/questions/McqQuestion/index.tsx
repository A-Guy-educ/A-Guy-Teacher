/**
 * Multiple Choice Question Component
 * Displays a question with multiple choice option cards (single or multi-select)
 *
 * Single-select MCQs with exactly 2 options render as two side-by-side large
 * buttons (mirror of TrueFalseQuestion's layout) for visual parity with the
 * binary choice. Multi-select MCQs and MCQs with != 2 options keep the
 * vertical radio/checkbox card list.
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { Checkbox } from '@/ui/web/components/checkbox'
import { AlertCircle } from 'lucide-react'
import type { QuestionSelectMcqBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface McqQuestionProps {
  question: QuestionSelectMcqBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
  /**
   * Optional handler used ONLY by the 2-option single-select button variant.
   * When provided, clicking a button both selects the option AND triggers an
   * immediate check (equivalent to selecting + pressing "Check Answer" in
   * one action). Card-list variants (3+ options or multi-select) ignore
   * this prop and keep the explicit Check Answer flow.
   */
  onAutoSubmit?: (answer: UserAnswer) => void
}

/**
 * Transform \frac to \dfrac for display-style fractions in MCQ options
 * This improves readability by rendering fractions larger
 * Note: \frac does not occur as substring in \dfrac, so simple replacement is safe
 */
function transformFractionsToDisplayStyle(content: string): string {
  if (!content) return content
  return content.replace(/\\frac\b/g, '\\dfrac')
}

export function McqQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult: _checkResult,
  t,
  onAutoSubmit,
}: McqQuestionProps) {
  const selectedIds = answer.type === 'mcq' ? answer.selectedIds : []

  const isTwoOptionSingleSelect =
    !question.answer.multiSelect && question.answer.options.length === 2

  const handleOptionClick = (optionId: string) => {
    if (disabled) return

    let newSelectedIds: string[]
    if (question.answer.multiSelect) {
      newSelectedIds = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId]
    } else {
      newSelectedIds = [optionId]
    }

    const nextAnswer: UserAnswer = { type: 'mcq', selectedIds: newSelectedIds }

    // 2-option single-select buttons: clicking selects AND triggers a check in
    // one action. Other variants fall through to the explicit Check Answer flow.
    if (isTwoOptionSingleSelect && onAutoSubmit) {
      onAutoSubmit(nextAnswer)
      return
    }

    onChange(nextAnswer)
  }

  // Convert InlineRichText to RichTextBlock for renderer
  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  return (
    <div className="flex flex-col gap-content-gap">
      {/* Question container — translucent in light mode, solid in dark */}
      <div className="rounded-2xl border border-border/40 bg-background/60 dark:bg-card dark:border-border/60 dark:shadow-card p-content-gap">
        {/* Color accent bar */}
        <div
          className="w-8 h-1 rounded-full mb-3"
          style={{ backgroundColor: 'hsl(var(--tab-learn))' }}
        />
        <div className="text-body-md font-medium text-foreground leading-relaxed">
          <RichTextRenderer block={promptBlock} />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-body-xs border border-border/20 w-fit">
        <AlertCircle className="w-3.5 h-3.5" />
        {question.answer.multiSelect ? t('selectMultiple') : t('selectOne')}
      </div>

      {isTwoOptionSingleSelect ? (
        <div className="grid grid-cols-2 gap-content-gap">
          {question.answer.options.map((option, index) => {
            const isSelected = selectedIds.includes(option.id)
            const transformedValue = transformFractionsToDisplayStyle(option.content.value)
            const optionBlock: RichTextBlock = {
              ...option.content,
              value: transformedValue,
              id: `${question.id}-option-${option.id}`,
              mediaIds: option.content.mediaIds || [],
            }
            return (
              <motion.button
                key={option.id}
                type="button"
                onClick={() => handleOptionClick(option.id)}
                disabled={disabled}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={!disabled ? { y: -2 } : undefined}
                whileTap={!disabled ? { scale: 0.97 } : undefined}
                className={cn(
                  'relative overflow-hidden rounded-xl border-2 p-5 text-heading-sm font-bold transition-all duration-normal whitespace-normal',
                  'bg-background/50 dark:bg-card dark:shadow-card',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  !disabled &&
                    !isSelected &&
                    'border-border/40 dark:border-border/50 hover:border-[hsl(var(--tab-learn)/0.5)] dark:hover:shadow-card-hover cursor-pointer',
                  isSelected &&
                    'border-[hsl(var(--tab-learn))] bg-[hsl(var(--tab-learn)/0.08)] dark:shadow-card-hover',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                {/* Colored top accent bar — shows when selected */}
                {!disabled && (
                  <div
                    className="absolute top-0 start-0 end-0 h-1 rounded-t-xl"
                    style={{
                      backgroundColor: isSelected ? 'hsl(var(--tab-learn))' : 'transparent',
                      opacity: isSelected ? 1 : 0,
                      transition: 'all 0.2s',
                    }}
                  />
                )}
                <div className="flex items-center justify-center gap-content-gap-xs">
                  <RichTextRenderer block={optionBlock} />
                </div>
              </motion.button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {question.answer.options.map((option, index) => {
            const isSelected = selectedIds.includes(option.id)
            // Transform fractions to display style for better readability in MCQ options
            const transformedValue = transformFractionsToDisplayStyle(option.content.value)
            const optionBlock: RichTextBlock = {
              ...option.content,
              value: transformedValue,
              id: `${question.id}-option-${option.id}`,
              mediaIds: option.content.mediaIds || [],
            }
            return (
              <motion.label
                key={option.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                whileHover={!disabled ? { y: -2 } : undefined}
                className={cn(
                  'relative flex items-start gap-3 p-card-padding-sm rounded-xl border-2 transition-all duration-normal cursor-pointer overflow-hidden',
                  'bg-background/50 dark:bg-card',
                  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                  !disabled &&
                    !isSelected &&
                    'border-border/40 dark:border-border/50 hover:border-[hsl(var(--tab-learn)/0.5)] dark:hover:shadow-card-hover',
                  isSelected &&
                    'border-[hsl(var(--tab-learn))] bg-[hsl(var(--tab-learn)/0.07)] dark:shadow-card-hover',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
                onClick={() => !question.answer.multiSelect && handleOptionClick(option.id)}
              >
                {/* Colored left accent bar — shows on hover and selected */}
                {!disabled && (
                  <div
                    className={cn(
                      'absolute start-0 top-0 bottom-0 w-1 rounded-l-xl transition-all duration-normal',
                    )}
                    style={{
                      backgroundColor: isSelected ? 'hsl(var(--tab-learn))' : 'transparent',
                      opacity: isSelected ? 1 : 0,
                    }}
                  />
                )}
                {question.answer.multiSelect ? (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleOptionClick(option.id)}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                ) : (
                  <div
                    className={cn(
                      'w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                      'bg-background',
                      !isSelected && 'border-border',
                      isSelected &&
                        'border-[hsl(var(--tab-learn))] bg-[hsl(var(--tab-learn))] ring-2 ring-[hsl(var(--tab-learn)/0.2)] ring-offset-2',
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        className="w-2.5 h-2.5 rounded-full bg-white"
                      />
                    )}
                  </div>
                )}
                <div className="flex-1 text-body-lg text-foreground">
                  <RichTextRenderer block={optionBlock} />
                </div>
              </motion.label>
            )
          })}
        </div>
      )}
    </div>
  )
}
