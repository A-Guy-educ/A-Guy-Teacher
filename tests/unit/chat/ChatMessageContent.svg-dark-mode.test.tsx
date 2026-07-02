// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatMessageContent } from '@/ui/web/chat/ChatMessageContent'
import { SvgAwareImage } from '@/ui/web/shared/MathMarkdown/svgAwareImage'

/**
 * Reproduces issue #652: inline SVG diagrams rendered through the chat
 * markdown component must remain readable in dark mode by acquiring the
 * `dark:invert` Tailwind utility, while raster images must not pick it
 * up. Both cases also keep responsive sizing (`max-h-96`, `max-w-full`).
 */

describe('ChatMessageContent — SVG dark mode support (issue #652)', () => {
  it('applies `dark:invert` to an `<img>` whose src is an SVG', () => {
    const { container } = render(
      <ChatMessageContent content="![diagram](https://cdn.example.com/diagram.svg)" />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.className).toMatch(/dark:invert/)
  })

  it('does NOT apply `dark:invert` to a raster image `<img>`', () => {
    const { container } = render(
      <ChatMessageContent content="![photo](https://cdn.example.com/photo.png)" />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.className).not.toMatch(/dark:invert/)
  })

  it('mixes SVG and raster in the same content — only SVG gets `dark:invert`', () => {
    const markdown = [
      '![diagram](https://cdn.example.com/diagram.svg)',
      '![photo](https://cdn.example.com/photo.jpg)',
    ].join('\n\n')

    const { container } = render(<ChatMessageContent content={markdown} />)

    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(2)

    const svgImg = imgs[0]
    const rasterImg = imgs[1]

    expect(svgImg.getAttribute('src')).toContain('.svg')
    expect(rasterImg.getAttribute('src')).toContain('.jpg')

    expect(svgImg.className).toMatch(/dark:invert/)
    expect(rasterImg.className).not.toMatch(/dark:invert/)
  })

  it('keeps responsive sizing (`max-h-96` / `max-w-full`) on both SVG and raster images', () => {
    const markdown = [
      '![diagram](https://cdn.example.com/diagram.svg)',
      '![photo](https://cdn.example.com/photo.png)',
    ].join('\n\n')

    const { container } = render(<ChatMessageContent content={markdown} />)

    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(2)
    imgs.forEach((img) => {
      expect(img.className).toMatch(/max-h-96/)
      expect(img.className).toMatch(/max-w-full/)
    })
  })

  it('handles SVG src with a query string', () => {
    const { container } = render(
      <ChatMessageContent content="![d](https://cdn.example.com/diagram.svg?v=42)" />,
    )

    const img = container.querySelector('img')
    expect(img?.className).toMatch(/dark:invert/)
  })
})

describe('SvgAwareImage — URL fragment and missing-src contract', () => {
  it('treats an SVG src with a URL fragment as SVG', () => {
    const { container } = render(
      <SvgAwareImage src="https://cdn.example.com/sprite.svg#icon-check" />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.className).toMatch(/dark:invert/)
  })

  it('renders nothing when src is missing', () => {
    const { container } = render(<SvgAwareImage />)
    expect(container.querySelector('img')).toBeNull()
  })
})
