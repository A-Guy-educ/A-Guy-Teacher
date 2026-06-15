/**
 * @fileType parser
 * @domain exercises
 * @ai-summary Parses enumitem-style MCQ where options are nested enumerate [(a)], [(b)], etc. — used in Bagrut exams alongside exam.cls style. Like mcq-exam-cls, defaults to first option when no correct answer is marked.
 */

import { generateId } from '@/infra/types/exercise'
import type { QuestionSelectMcqBlock, InlineRichText, McqOption } from '@/infra/types/exercise'

function makeInlineRichText(value: string): InlineRichText {
  return { type: 'rich_text', format: 'md-math-v1', value: value.trim(), mediaIds: [] }
}

/**
 * Parses enumitem-style MCQ questions.
 *
 * Pattern:
 *   \item <prompt text>
 *   \begin{enumerate}[(a)]
 *   \item <option>
 *   ...
 *   \end{enumerate}
 */
export function parseEnumitemMcq(text: string): QuestionSelectMcqBlock | null {
  const outerMatch =
    /\\item\s+([\s\S]*?)\\begin\{enumerate\}\s*\[\(.*?\)\]\s*([\s\S]*?)\\end\{enumerate\}/m.exec(
      text,
    )
  if (!outerMatch) return null

  const promptText = outerMatch[1].trim()
  const optionsBlock = outerMatch[2]

  const itemPattern = /\\item\s+([^\n\\]*(?:\\[^\n\\]*)*)/g
  const options: McqOption[] = []

  let match: RegExpExecArray | null
  while ((match = itemPattern.exec(optionsBlock)) !== null) {
    const optionText = match[1].trim()
    options.push({ id: generateId(), content: makeInlineRichText(optionText) })
  }

  if (options.length === 0) return null

  const block: QuestionSelectMcqBlock = {
    id: generateId(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    prompt: makeInlineRichText(promptText),
    answer: {
      multiSelect: false,
      options,
      correctOptionIds: [options[0].id],
    },
  }

  return block
}
