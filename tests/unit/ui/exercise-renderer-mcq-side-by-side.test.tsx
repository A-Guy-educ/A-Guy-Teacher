/**
 * @fileType unit-test
 * @domain exercises
 * @pattern ui-test, student-renderer, layout
 * @ai-summary Unit tests for the 2-option single-select MCQ side-by-side layout
 *
 * Verifies that single-select MCQs with exactly 2 options render as two large
 * side-by-side buttons (mirror of TrueFalseQuestion's layout) rather than the
 * vertical radio-card list, while MCQs with other option counts and multi-
 * select MCQs keep the existing rendering. Also covers the auto-check behavior
 * (issue #886): a button click in a 2-option MCQ mounted inside ExerciseRenderer
 * selects + checks in one action.
 */

// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { McqQuestion } from '@/ui/web/exerciserenderer/questions/McqQuestion'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import enMessages from '../../../src/i18n/en.json'
import { I18nProvider } from '@/ui/web/providers/I18n'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'
import type { QuestionSelectMcqBlock, UserAnswer } from '@/ui/web/exerciserenderer/types'

// Stub renderers we don't exercise in the auto-check integration tests —
// keeps the DOM small and predictable.
vi.mock('@/ui/web/exerciserenderer/blocks/LatexBlockRenderer', () => ({
  LatexBlockRenderer: () => null,
}))
vi.mock('@/ui/web/exerciserenderer/blocks/RichTextRenderer', () => ({
  RichTextRenderer: ({ block }: { block: { value: string } }) => (
    <div data-testid="rich-text">{block.value}</div>
  ),
}))

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

  describe('onAutoSubmit prop (auto-check wiring)', () => {
    it('prefers onAutoSubmit over onChange when provided (2-option single-select)', () => {
      const onChange = vi.fn()
      const onAutoSubmit = vi.fn()
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          onAutoSubmit={onAutoSubmit}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      expect(onAutoSubmit).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt-a'] })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('falls back to onChange when onAutoSubmit is not provided (legacy callers)', () => {
      const onChange = vi.fn()
      const onAutoSubmit = vi.fn()
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      // Render WITHOUT onAutoSubmit prop → should still call onChange
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
      expect(onAutoSubmit).not.toHaveBeenCalled()
    })

    it('does NOT use onAutoSubmit for 3+ option single-select (card-list variant)', () => {
      const onChange = vi.fn()
      const onAutoSubmit = vi.fn()
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={createThreeOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          onAutoSubmit={onAutoSubmit}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      // Card-list variant — click the first label
      const labels = container.querySelectorAll('label')
      fireEvent.click(labels[0])

      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt-a'] })
      expect(onAutoSubmit).not.toHaveBeenCalled()
    })

    it('does NOT use onAutoSubmit for multi-select MCQ (card-list variant)', () => {
      const onChange = vi.fn()
      const onAutoSubmit = vi.fn()
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={createTwoOptionMultiSelect()}
          answer={answer}
          onChange={onChange}
          onAutoSubmit={onAutoSubmit}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const labels = container.querySelectorAll('label')
      fireEvent.click(labels[0])

      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt-a'] })
      expect(onAutoSubmit).not.toHaveBeenCalled()
    })

    it('does not fire either handler when disabled', () => {
      const onChange = vi.fn()
      const onAutoSubmit = vi.fn()
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={createTwoOptionSingleSelect()}
          answer={answer}
          onChange={onChange}
          onAutoSubmit={onAutoSubmit}
          disabled={true}
          checkResult={null}
          t={mockT}
        />,
      )

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      expect(onChange).not.toHaveBeenCalled()
      expect(onAutoSubmit).not.toHaveBeenCalled()
    })
  })
})

/**
 * Auto-check integration tests: a 2-option MCQ mounted inside ExerciseRenderer
 * should select + check in one click (issue #886). Card-list variants are
 * covered by the McqQuestion-level tests above.
 */
describe('ExerciseRenderer — 2-option MCQ auto-check (issue #886)', () => {
  afterEach(() => {
    cleanup()
  })

  function renderExercise(groups: ExerciseBlockGroup[]) {
    return render(
      <I18nProvider locale="en" messages={enMessages}>
        <ExerciseRenderer groups={groups} />
      </I18nProvider>,
    )
  }

  function buildGroupsWithMcq(
    question: QuestionSelectMcqBlock,
    correctOptionIds: string[],
  ): ExerciseBlockGroup[] {
    return [
      {
        sectionIndex: null,
        blocks: [
          {
            ...question,
            answer: { ...question.answer, correctOptionIds },
          } as ExerciseBlockGroup['blocks'][number],
        ],
      },
    ]
  }

  it('selects + checks a 2-option MCQ in one click on the correct option', async () => {
    const groups = buildGroupsWithMcq(createTwoOptionSingleSelect(), ['opt-a'])

    renderExercise(groups)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    // The feedback appears in the FeedbackDisplay (and the Check Answer button
    // turns into "Correct!" once disabled — both are valid signals).
    await waitFor(() => {
      expect(screen.getAllByText('Correct!').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('selects + checks a 2-option MCQ in one click on the incorrect option', async () => {
    const groups = buildGroupsWithMcq(createTwoOptionSingleSelect(), ['opt-a'])

    renderExercise(groups)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1]) // opt-b — wrong

    await waitFor(() => {
      expect(screen.getAllByText('Incorrect').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('dispatches the exercise-incorrect-answer event exactly once on the first incorrect auto-check', async () => {
    const groups = buildGroupsWithMcq(createTwoOptionSingleSelect(), ['opt-a'])

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    let incorrectEvents = 0
    dispatchSpy.mockImplementation((event: Event) => {
      if (event.type === 'exercise-incorrect-answer') incorrectEvents += 1
      return true
    })

    renderExercise(groups)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1]) // wrong answer

    await waitFor(() => {
      expect(screen.getAllByText('Incorrect').length).toBeGreaterThanOrEqual(1)
    })

    expect(incorrectEvents).toBe(1)

    // Click the other button — still incorrect (correct is opt-a), but the
    // chat trigger has already fired, so no duplicate event.
    fireEvent.click(buttons[0])

    await waitFor(() => {
      expect(incorrectEvents).toBe(1)
    })

    dispatchSpy.mockRestore()
  })

  it('disables the buttons after a correct auto-check so a second click is a no-op', async () => {
    const groups = buildGroupsWithMcq(createTwoOptionSingleSelect(), ['opt-a'])

    renderExercise(groups)

    const buttonsBefore = screen.getAllByRole('button')
    fireEvent.click(buttonsBefore[0]) // correct

    await waitFor(() => {
      expect(screen.getAllByText('Correct!').length).toBeGreaterThanOrEqual(1)
    })

    const buttonsAfter = screen.getAllByRole('button')
    expect(buttonsAfter[0]).toBeDisabled()
    expect(buttonsAfter[1]).toBeDisabled()

    // A second click on either button should be a no-op (handled by `disabled`
    // in McqQuestion). We don't dispatch a custom event for the check here;
    // this assertion is the source-of-truth.
  })
})
