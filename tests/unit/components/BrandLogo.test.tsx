/**
 * @fileType unit-test
 * @domain components
 * @pattern brand-logo
 * @ai-summary Tests for the A-Guy brand Logo component (bilingual mark).
 */
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Logo } from '@/brands/aguy/components/Logo'

afterEach(() => {
  cleanup()
})

describe('A-Guy Logo component', () => {
  it('renders an svg with the new bilingual viewBox', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('35 30 160 155')
  })

  it('preserves the brand red (#91262C) and brand green (#5D725B) colors', () => {
    const { container } = render(<Logo />)
    const fills = Array.from(container.querySelectorAll('[fill]')).map(
      (el) => el.getAttribute('fill') ?? '',
    )
    expect(fills).toContain('#91262C')
    expect(fills).toContain('#5D725B')
  })

  it('renders the baked-in גאי wordmark group (id="guy-custom")', () => {
    const { container } = render(<Logo />)
    const wordmark = container.querySelector('g#guy-custom')
    expect(wordmark).not.toBeNull()
    // Three letter paths in the wordmark group (gimel, alef, yod → ג, ־, י)
    expect(wordmark?.querySelectorAll('path').length).toBe(3)
  })

  it('applies a default height utility class on the svg', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    const classes = svg?.getAttribute('class') ?? ''
    expect(classes).toContain('h-8')
    expect(classes).toContain('w-auto')
  })

  it('forwards className onto the svg', () => {
    const { container } = render(<Logo className="custom-class h-12" />)
    const svg = container.firstChild as HTMLElement
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg.classList.contains('custom-class')).toBe(true)
    expect(svg.classList.contains('h-12')).toBe(true)
    // The component's own defaults are still merged in via cn().
    expect(svg.classList.contains('w-auto')).toBe(true)
  })

  it('does not render a separate "Aguy" text wordmark (it is baked into the svg)', () => {
    const { container } = render(<Logo />)
    // The old component had a <span>Aguy</span> sibling. It must be gone now that
    // the wordmark is part of the svg, otherwise we'd get a duplicate.
    const span = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'Aguy',
    )
    expect(span).toBeUndefined()
  })
})
