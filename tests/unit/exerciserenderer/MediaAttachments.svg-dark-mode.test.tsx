// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MediaAttachments } from '@/ui/web/exerciserenderer/components/MediaAttachments'
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

function renderWithMediaMap(ui: React.ReactElement, mediaMap: Record<string, Media>) {
  return render(<MediaMapProvider value={mediaMap}>{ui}</MediaMapProvider>)
}

/**
 * Reproduces issue #652: SVG/diagram media attached to an exercise explanation
 * must remain readable in dark mode by inverting dark pixels to light (otherwise
 * a black-on-white drawing disappears against the dark background).
 *
 * The class that flips colors under the `dark` parent variant is the standard
 * Tailwind `dark:invert` utility. The MediaAttachments component currently
 * renders SVG media exactly like raster images — without that utility.
 *
 * Expected (post-fix): <img> for svg-typed media carries `dark:invert`.
 * Actual (buggy): className is `w-full h-auto max-h-96 max-w-full object-contain`.
 */
describe('MediaAttachments — SVG dark mode support (issue #652)', () => {
  it('applies the `dark:invert` utility to svg-typed media so dark strokes remain visible', () => {
    const svg = createMedia({ id: 'svg1' })

    renderWithMediaMap(<MediaAttachments mediaIds={['svg1']} />, { svg1: svg })

    const img = screen.getByAltText('Circuit diagram') as HTMLImageElement
    expect(img.tagName).toBe('IMG')

    // BUG: current className does not include `dark:invert` so the SVG will be
    // unreadable when the dark theme is active. Asserting presence of the
    // utility is the smallest, most direct reproducer for the issue.
    expect(img.className).toMatch(/dark:invert/)
  })

  it('does NOT apply `dark:invert` to regular raster images (only SVGs need the inversion)', () => {
    const img = createMedia({
      id: 'img1',
      type: 'image',
      url: '/media/photo.png',
      alt: 'A photo',
      mimeType: 'image/png',
    })

    renderWithMediaMap(<MediaAttachments mediaIds={['img1']} />, { img1: img })

    const rendered = screen.getByAltText('A photo') as HTMLImageElement
    expect(rendered.className).not.toMatch(/dark:invert/)
  })

  it('keeps responsive sizing (max-h-96 / max-w-full) on SVG media so small diagrams do not overflow the exercise layout', () => {
    const svg = createMedia({ id: 'svg-small', width: 120, height: 80 })

    renderWithMediaMap(<MediaAttachments mediaIds={['svg-small']} />, { 'svg-small': svg })

    const rendered = screen.getByAltText('Circuit diagram') as HTMLImageElement

    expect(rendered.className).toMatch(/max-h-96/)
    expect(rendered.className).toMatch(/max-w-full/)
  })
})
