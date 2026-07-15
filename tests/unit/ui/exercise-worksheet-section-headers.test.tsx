// @vitest-environment jsdom
/**
 * Regression coverage for issue #880 — ExerciseWorksheet's section header
 * rendering (read-only "PDF" view). Each populated section group emits a
 * `worksheet-section-header` test id; the exercise's own content.blocks
 * (sectionIndex: null) emits none.
 */

import '@testing-library/jest-dom'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { ExerciseWorksheet } from '@/ui/web/exerciserenderer/ExerciseWorksheet'
import type { ExerciseBlockGroup } from '@/infra/types/exercise'

vi.mock('@/ui/web/exerciserenderer/blocks/RichTextRenderer', () => ({
  RichTextRenderer: ({ block }: { block: { value: string } }) => (
    <div data-testid="rich">{block.value}</div>
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

describe('ExerciseWorksheet — section headers (issue #880)', () => {
  afterEach(() => cleanup())

  it('renders own blocks without a worksheet section header', () => {
    const groups: ExerciseBlockGroup[] = [
      { sectionIndex: null, blocks: [rich('own-1', 'own prose')] },
    ]
    renderWithI18n(<ExerciseWorksheet groups={groups} />)
    expect(screen.getByTestId('rich')).toHaveTextContent('own prose')
    expect(screen.queryByTestId('worksheet-section-header')).not.toBeInTheDocument()
  })

  it('renders one worksheet header per section with localized label', () => {
    const groups: ExerciseBlockGroup[] = [
      { sectionIndex: null, blocks: [rich('own-1', 'own prose')] },
      { sectionIndex: 0, blocks: [rich('s1-a', 'section one prose')] },
      { sectionIndex: 1, blocks: [rich('s2-a', 'section two prose')] },
    ]
    renderWithI18n(<ExerciseWorksheet groups={groups} />)
    const headers = screen.getAllByTestId('worksheet-section-header')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveAttribute('data-section-index', '0')
    expect(headers[1]).toHaveAttribute('data-section-index', '1')
    expect(headers[0]).toHaveTextContent(/Section\s+A/i)
    expect(headers[1]).toHaveTextContent(/Section\s+B/i)
  })
})
