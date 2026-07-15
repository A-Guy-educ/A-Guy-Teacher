/**
 * @fileType unit-test
 * @domain exercises
 * @pattern ui-test, student-renderer, layout
 * @ai-summary Unit tests for the 2-option single-select MCQ side-by-side layout
 *
 * Verifies that single-select MCQs with exactly 2 options render as two large
 * side-by-side buttons (mirror of TrueFalseQuestion's layout) rather than the
 * vertical radio-card list, while MCQs with other option counts and multi-
 * select MCQs keep the existing rendering.
 */

// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { McqQuestion } from '@/ui/web/exerciserenderer/questions/McqQuestion'
import type { QuestionSelectMcqBlock, UserAnswer } from '@/ui/web/exerciserenderer/types'

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    selectOne: 'Select one answer',
    selectMultiple: 'Select all that apply',
  }
  return translations[key] || key
}

const createTwoOptionSingleSelect = (): QuestionSelectMcqBlock => ({
  id: 'test-2opt-single',
  type: 'question_select',
  variant: 'mcq',
  selectionMode: 'single',
  prompt: {
    type: 'rich_text',
    format: 'md-math-v1',
    value: 'Pick one',
    mediaIds: [],
  },
  answer: {
    multiSelect: false,
    options: [
      {
        id: 'opt-a',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Option A',
          mediaIds: [],
        },
      },
      {
        id: 'opt-b',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Option B',
          mediaIds: [],
        },
      },
    ],
    correctOptionIds: ['opt-a'],
  },
})

const createThreeOptionSingleSelect = (): QuestionSelectMcqBlock => ({
  id: 'test-3opt-single',
  type: 'question_select',
  variant: 'mcq',
  selectionMode: 'single',
  prompt: {
    type: 'rich_text',
    format: 'md-math-v1',
    value: 'Pick one',
    mediaIds: [],
  },
  answer: {
    multiSelect: false,
    options: [
      {
        id: 'opt-a',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'A',
          mediaIds: [],
        },
      },
      {
        id: 'opt-b',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'B',
          mediaIds: [],
        },
      },
      {
        id: 'opt-c',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'C',
          mediaIds: [],
        },
      },
    ],
    correctOptionIds: ['opt-a'],
  },
})

const createTwoOptionMultiSelect = (): QuestionSelectMcqBlock => ({
  id: 'test-2opt-multi',
  type: 'question_select',
  variant: 'mcq',
  selectionMode: 'multiple',
  prompt: {
    type: 'rich_text',
    format: 'md-math-v1',
    value: 'Pick any',
    mediaIds: [],
  },
  answer: {
    multiSelect: true,
    options: [
      {
        id: 'opt-a',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'A',
          mediaIds: [],
        },
      },
      {
        id: 'opt-b',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'B',
          mediaIds: [],
        },
      },
    ],
    correctOptionIds: ['opt-a', 'opt-b'],
  },
})

describe('McqQuestion — 2-option single-select side-by-side layout', () => {
  let onChange: (answer: UserAnswer) => void

  beforeEach(() => {
    onChange = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Two-option single-select rendering', () => {
    it('renders a grid-cols-2 container with two button-role elements', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const grid = container.querySelector('.grid.grid-cols-2')
      expect(grid).toBeTruthy()
      expect(grid).toHaveClass('gap-content-gap')

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBe(2)
    })

    it('keeps the selectOne hint pill above the buttons', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(screen.getByText('Select one answer')).toBeTruthy()
    })

    it('does NOT render a label element (the buttons replace the label cards)', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(container.querySelectorAll('label').length).toBe(0)
    })
  })

  describe('Two-option single-select interactions', () => {
    it('calls onChange when a button is clicked', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt-a'] })
    })

    it('replaces the prior selection when another button is clicked', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: ['opt-a'] }
      render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[1])

      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt-b'] })
    })

    it('does not call onChange when disabled', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={true}
          checkResult={null}
          t={mockT}
        />,
      )

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      expect(onChange).not.toHaveBeenCalled()
    })

    it('applies the tab-learn accent border to the selected button', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: ['opt-a'] }
      const { container } = render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons[0].className).toContain('border-[hsl(var(--tab-learn))]')
      expect(buttons[1].className).not.toContain('border-[hsl(var(--tab-learn))]')

      // The selected button has a top accent bar with the tab-learn color
      const accentBars = container.querySelectorAll('.absolute.top-0.start-0.end-0.h-1')
      expect(accentBars.length).toBe(2)
    })
  })

  describe('Non-matching variants keep the legacy card-list rendering', () => {
    it('renders the card list (label elements) for single-select MCQs with 3+ options', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={createThreeOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(container.querySelector('.grid.grid-cols-2')).toBeNull()
      expect(container.querySelectorAll('label').length).toBe(3)
      expect(screen.queryAllByRole('button').length).toBe(0)
    })

    it('renders the card list (label elements) for multi-select MCQs with 2 options', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={createTwoOptionMultiSelect()}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(container.querySelector('.grid.grid-cols-2')).toBeNull()
      expect(container.querySelectorAll('label').length).toBe(2)
      expect(screen.queryAllByRole('button').length).toBe(0)
    })
  })

  describe('Long option content wrapping', () => {
    it('allows wrapping on the button (whitespace-normal) so long option text is not truncated', () => {
      const longText =
        'A very long option label that should be allowed to wrap onto multiple lines without being truncated or clipped'
      const question: QuestionSelectMcqBlock = {
        ...createTwoOptionSingleSelect(),
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'opt-a',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: longText,
                mediaIds: [],
              },
            },
            {
              id: 'opt-b',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Short',
                mediaIds: [],
              },
            },
          ],
          correctOptionIds: ['opt-a'],
        },
      }

      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={question}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button.className).toContain('whitespace-normal')
      })
    })
  })
})
