// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RichTextRenderer } from '@/ui/web/exerciserenderer/blocks/RichTextRenderer'
import { MediaMapProvider } from '@/ui/web/exerciserenderer/context/MediaMapContext'
import type { Media } from '@/infra/types/content'

function createMedia(overrides: Partial<Media> & { id: string }): Media {
  return {
    filename: 'diagram.svg',
    url: '/media/diagram.svg',
    alt: 'Circuit diagram',
    mimeType: 'image/svg+xml',
    type: 'svg',
    filesize: 2048,
    width: 240,
    height: 160,
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Media
}

function renderWithMediaMap(
  ui: React.ReactElement,
  mediaMap: Record<string, Media> = {},
): ReturnType<typeof render> {
  return render(<MediaMapProvider value={mediaMap}>{ui}</MediaMapProvider>)
}

/**
 * Reproduces issue #652: rich-text explanations referenced from exercise
 * blocks may include inline SVG diagrams. The `dark:invert` Tailwind utility
 * must reach them so dark-line diagrams remain visible under the dark theme.
 * Raster images must NOT get the same treatment.
 */
describe('RichTextRenderer — SVG dark mode support (issue #652)', () => {
  it('applies `dark:invert` to a markdown `<img>` whose src is an SVG', () => {
    const { container } = renderWithMediaMap(
      <RichTextRenderer
        block={{
          type: 'rich_text',
          format: 'md-math-v1',
          value: '![diagram](https://cdn.example.com/diagram.svg)',
        }}
      />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.className).toMatch(/dark:invert/)
  })

  it('does NOT apply `dark:invert` to a raster markdown image', () => {
    const { container } = renderWithMediaMap(
      <RichTextRenderer
        block={{
          type: 'rich_text',
          format: 'md-math-v1',
          value: '![photo](https://cdn.example.com/photo.png)',
        }}
      />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.className).not.toMatch(/dark:invert/)
  })

  it('keeps responsive sizing on both SVG and raster markdown images', () => {
    const markdown = [
      '![diagram](https://cdn.example.com/diagram.svg)',
      '![photo](https://cdn.example.com/photo.png)',
    ].join('\n\n')

    const { container } = renderWithMediaMap(
      <RichTextRenderer block={{ type: 'rich_text', format: 'md-math-v1', value: markdown }} />,
    )

    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(2)
    imgs.forEach((img) => {
      expect(img.className).toMatch(/max-h-96/)
      expect(img.className).toMatch(/max-w-full/)
    })
  })

  it('preserves the dark-mode inversion for an SVG attached via mediaIds', () => {
    const svg = createMedia({
      id: 'svg-inline',
      url: '/media/inline.svg',
      alt: 'Inline SVG',
    })

    const { container } = renderWithMediaMap(
      <RichTextRenderer
        block={{
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'See diagram below.',
          mediaIds: ['svg-inline'],
        }}
      />,
      { 'svg-inline': svg },
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.className).toMatch(/dark:invert/)
    expect(img?.className).toMatch(/max-h-96/)
    expect(img?.className).toMatch(/max-w-full/)
  })

  it('does NOT invert a raster image attached via mediaIds', () => {
    const raster = createMedia({
      id: 'raster',
      type: 'image',
      url: '/media/photo.png',
      alt: 'A photo',
      mimeType: 'image/png',
      filename: 'photo.png',
    })

    const { container } = renderWithMediaMap(
      <RichTextRenderer
        block={{
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'See photo below.',
          mediaIds: ['raster'],
        }}
      />,
      { raster },
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.className).not.toMatch(/dark:invert/)
  })
})
