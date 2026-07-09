// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import { ViewToggle } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ViewToggle'
import { I18nProvider } from '@/ui/web/providers/I18n'

function renderViewToggle(props?: Partial<React.ComponentProps<typeof ViewToggle>>) {
  const onViewChange = vi.fn()

  render(
    <I18nProvider locale="en" messages={enMessages}>
      <ViewToggle hasPdf hasExercises onViewChange={onViewChange} {...props} />
    </I18nProvider>,
  )

  return { onViewChange }
}

describe('ViewToggle', () => {
  afterEach(() => cleanup())

  it('uses the elevation shadow token for the active view button', () => {
    const { onViewChange } = renderViewToggle()

    const scrollButton = screen.getByRole('button', { name: /scroll view/i })
    const interactiveButton = screen.getByRole('button', { name: /interactive exercises/i })

    expect(scrollButton).toHaveClass('shadow-elevation-1')
    expect(scrollButton).not.toHaveClass('shadow-sm')

    fireEvent.click(interactiveButton)

    expect(onViewChange).toHaveBeenCalledWith('interactive')
    expect(interactiveButton).toHaveClass('shadow-elevation-1')
    expect(interactiveButton).not.toHaveClass('shadow-sm')
  })

  it('does not render when only one view mode is available', () => {
    renderViewToggle({ hasExercises: false })

    expect(screen.queryByRole('button', { name: /scroll view/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /interactive exercises/i })).not.toBeInTheDocument()
  })
})
