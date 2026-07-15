// @vitest-environment jsdom
/**
 * Regression coverage for issue #880 — exercise renderer blank on
 * sections-format course + missing a/b/c section labels.
 *
 * Verifies the new section-header behavior on ExerciseRenderer:
 *   - Each populated section group renders a header labeled "Section A",
 *     "Section B", … (locale-aware: "סעיף א", "סעיף ב", … in Hebrew).
 *   - The exercise's own content.blocks renders WITHOUT a section header
 *     (legacy path is preserved).
 *   - The own-blocks group comes first, then each section group in
 *     playlist/section.order order, matching getExerciseBlockGroups().
 */

import '@testing-library/jest-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'

// Heavy block renderers don't need to do anything for these tests —
// we only assert on section header DOM + presence of the rich-text block.
vi.mock('@/ui/web/exerciserenderer/blocks/LatexBlockRenderer', () => ({
  LatexBlockRenderer: ({ block }: { block: { latex: string } }) => (
    <div data-testid="latex-block">{block.latex}</div>
  ),
}))
vi.mock('@/ui/web/exerciserenderer/blocks/RichTextRenderer', () => ({
  RichTextRenderer: ({ block }: { block: { value: string } }) => (
    <div data-testid="rich-text">{block.value}</div>
  ),
}))

function renderWithI18n(ui: React.ReactElement, locale: 'en' | 'he' = 'en') {
  return render(
    <I18nProvider locale={locale} messages={locale === 'en' ? enMessages : heMessages}>
      {ui}
    </I18nProvider>,
  )
}

const rich = (id: string, value: string): ExerciseBlockGroup['blocks'][number] => ({
  id,
  type: 'rich_text',
  format: 'md-math-v1',
  value,
  mediaIds: [],
})

describe('ExerciseRenderer — section headers (issue #880)', () => {
  afterEach(() => cleanup())

  it('renders own blocks first without a section header (legacy path)', () => {
    const groups: ExerciseBlockGroup[] = [
      { sectionIndex: null, blocks: [rich('own-1', 'own prose')] },
    ]
    renderWithI18n(<ExerciseRenderer groups={groups} />)
    expect(screen.getByTestId('rich-text')).toHaveTextContent('own prose')
    expect(screen.queryByTestId('exercise-section-header')).not.toBeInTheDocument()
  })

  it('renders a localized Section A header before the first section group (English)', () => {
    const groups: ExerciseBlockGroup[] = [
      { sectionIndex: 0, blocks: [rich('s1-a', 'first section prose')] },
    ]
    renderWithI18n(<ExerciseRenderer groups={groups} />)
    const header = screen.getByTestId('exercise-section-header')
    expect(header).toHaveAttribute('data-section-index', '0')
    // Header text: lowercase badge letter + "Section <UPPER>" prefix.
    expect(within(header).getByText(/Section\s+A/i)).toBeInTheDocument()
    expect(header.querySelector('span span')).toHaveTextContent('a')
    expect(screen.getByTestId('rich-text')).toHaveTextContent('first section prose')
  })

  it('renders localized סעיף א / ב headers in Hebrew (RTL)', () => {
    const groups: ExerciseBlockGroup[] = [
      { sectionIndex: 0, blocks: [rich('s1-a', 's1')] },
      { sectionIndex: 1, blocks: [rich('s2-a', 's2')] },
    ]
    renderWithI18n(
      <ExerciseRenderer groups={groups} hideLatexBlocks={false} />,
      'he',
    )
    const headers = screen.getAllByTestId('exercise-section-header')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveAttribute('data-section-index', '0')
    expect(headers[1]).toHaveAttribute('data-section-index', '1')
    expect(headers[0]).toHaveTextContent('סעיף')
    expect(headers[1]).toHaveTextContent('סעיף')
  })

  it('emits one header per section, with own blocks rendered first', () => {
    const groups: ExerciseBlockGroup[] = [
      { sectionIndex: null, blocks: [rich('own-1', 'own prose')] },
      { sectionIndex: 0, blocks: [rich('s1-a', 'section one prose')] },
      { sectionIndex: 1, blocks: [rich('s2-a', 'section two prose')] },
    ]
    renderWithI18n(<ExerciseRenderer groups={groups} />)
    const headers = screen.getAllByTestId('exercise-section-header')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveAttribute('data-section-index', '0')
    expect(headers[1]).toHaveAttribute('data-section-index', '1')
    expect(within(headers[0]).getByText(/Section\s+A/i)).toBeInTheDocument()
    expect(within(headers[1]).getByText(/Section\s+B/i)).toBeInTheDocument()
    // All three prose blocks render in order.
    const blocks = screen.getAllByTestId('rich-text')
    expect(blocks[0]).toHaveTextContent('own prose')
    expect(blocks[1]).toHaveTextContent('section one prose')
    expect(blocks[2]).toHaveTextContent('section two prose')
  })
})