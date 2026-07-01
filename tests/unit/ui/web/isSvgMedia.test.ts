import { describe, expect, it } from 'vitest'
import { darkInvertIfSvg, isSvgMedia, isSvgUrl } from '@/ui/web/shared/MathMarkdown/isSvgMedia'
import type { Media } from '@/infra/types/content'

function createMedia(overrides: Partial<Media> & { id: string }): Media {
  return {
    filename: 'diagram.svg',
    url: '/media/diagram.svg',
    alt: 'Circuit',
    mimeType: 'image/svg+xml',
    type: 'svg',
    filesize: 2048,
    ...overrides,
  } as Media
}

describe('isSvgMedia', () => {
  it('returns true when type is "svg"', () => {
    expect(isSvgMedia(createMedia({ id: '1' }))).toBe(true)
  })

  it('returns true when mediaType is "svg"', () => {
    expect(isSvgMedia(createMedia({ id: '1', type: 'something-else', mediaType: 'svg' }))).toBe(
      true,
    )
  })

  it('returns true for image/svg+xml mimeType (case-insensitive)', () => {
    expect(isSvgMedia(createMedia({ id: '1', type: 'image', mimeType: 'image/svg+xml' }))).toBe(
      true,
    )
    expect(isSvgMedia(createMedia({ id: '1', type: 'image', mimeType: 'IMAGE/SVG+XML' }))).toBe(
      true,
    )
  })

  it('returns true when the URL ends with .svg', () => {
    expect(isSvgMedia(createMedia({ id: '1', type: 'image', url: 'https://cdn/x/y.svg' }))).toBe(
      true,
    )
  })

  it('returns true when the URL ends with .svg followed by a query string', () => {
    expect(
      isSvgMedia(createMedia({ id: '1', type: 'image', url: '/media/diagram.svg?v=42&t=1' })),
    ).toBe(true)
  })

  it('does NOT trust filename alone when other signals say raster', () => {
    expect(
      isSvgMedia(
        createMedia({
          id: '1',
          type: 'image',
          url: '/media/photo.png',
          mimeType: 'image/png',
          filename: 'diagram.svg',
        }),
      ),
    ).toBe(false)
  })

  it('treats `type: "svg"` as authoritative even when mimeType + URL disagree', () => {
    expect(
      isSvgMedia(
        createMedia({
          id: '1',
          type: 'svg',
          url: '/media/asset-12345',
          mimeType: 'image/png',
        }),
      ),
    ).toBe(true)
  })

  it('treats `mimeType: image/svg+xml` as authoritative even when URL has no extension', () => {
    expect(
      isSvgMedia(
        createMedia({
          id: '1',
          type: 'image',
          url: 'https://cdn.example.com/asset-12345',
          mimeType: 'image/svg+xml',
        }),
      ),
    ).toBe(true)
  })

  it('matches .svg followed by a URL fragment', () => {
    expect(
      isSvgMedia(createMedia({ id: '1', type: 'image', url: 'https://cdn/x/sprite.svg#icon' })),
    ).toBe(true)
  })

  it('returns false for png / jpg / webp', () => {
    expect(
      isSvgMedia(
        createMedia({
          id: '1',
          type: 'image',
          mimeType: 'image/png',
          filename: 'a.png',
          url: '/a.png',
        }),
      ),
    ).toBe(false)
    expect(
      isSvgMedia(
        createMedia({
          id: '1',
          type: 'image',
          mimeType: 'image/jpeg',
          filename: 'a.jpg',
          url: '/a.jpg',
        }),
      ),
    ).toBe(false)
    expect(
      isSvgMedia(
        createMedia({
          id: '1',
          type: 'image',
          mimeType: 'image/webp',
          filename: 'a.webp',
          url: '/a.webp',
        }),
      ),
    ).toBe(false)
  })

  it('returns false for video / external types', () => {
    expect(
      isSvgMedia(
        createMedia({
          id: '1',
          type: 'video',
          mimeType: 'video/mp4',
          filename: 'a.mp4',
          url: '/a.mp4',
        }),
      ),
    ).toBe(false)
    expect(
      isSvgMedia({
        id: '1',
        type: 'external',
      }),
    ).toBe(false)
  })

  it('does not throw on null / missing fields', () => {
    expect(
      isSvgMedia({
        id: '1',
      }),
    ).toBe(false)
  })
})

describe('isSvgUrl', () => {
  it('matches .svg URLs', () => {
    expect(isSvgUrl('https://cdn.example.com/diagram.svg')).toBe(true)
    expect(isSvgUrl('/media/diagram.svg')).toBe(true)
  })

  it('matches .svg with query string', () => {
    expect(isSvgUrl('https://cdn.example.com/diagram.svg?v=42')).toBe(true)
  })

  it('matches .svg with URL fragment (e.g. SVG sprite <use> references)', () => {
    expect(isSvgUrl('https://cdn.example.com/sprite.svg#icon-check')).toBe(true)
    expect(isSvgUrl('/media/sprite.svg#icon')).toBe(true)
  })

  it('matches .svg with both query string and fragment', () => {
    expect(isSvgUrl('https://cdn.example.com/diagram.svg?v=1#icon')).toBe(true)
  })

  it('is case-insensitive on the extension', () => {
    expect(isSvgUrl('https://cdn.example.com/diagram.SVG')).toBe(true)
  })

  it('rejects non-svg URLs', () => {
    expect(isSvgUrl('https://cdn.example.com/photo.png')).toBe(false)
    expect(isSvgUrl('https://cdn.example.com/asset.svgx')).toBe(false)
    expect(isSvgUrl('/media/sub/file.png')).toBe(false)
  })

  it('treats null / undefined as non-svg', () => {
    expect(isSvgUrl(undefined)).toBe(false)
    expect(isSvgUrl(null)).toBe(false)
    expect(isSvgUrl('')).toBe(false)
  })
})

describe('darkInvertIfSvg', () => {
  it("returns 'dark:invert' for SVG media", () => {
    expect(darkInvertIfSvg(true)).toBe('dark:invert')
  })

  it('returns false for raster media so cn() drops the class', () => {
    expect(darkInvertIfSvg(false)).toBe(false)
  })
})
