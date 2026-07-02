/**
 * Issue #651 — `/api/media` POST must classify SVG uploads as `type: 'svg'` so
 * downstream consumers (e.g. `MediaAttachments` dark-mode inversion,
 * `isImageType`, the SVG-dispatched `Media` index) see a consistent shape.
 *
 * The route uses `inferMediaType(file.type, filename)` from
 * `@/infra/media/inferMediaType` as the discriminator. This test pins the
 * discriminator output for the SVG mime type and adjacent types, so a
 * regression in the classifier is caught at the unit level rather than via a
 * live upload smoke test.
 */

import { MediaType } from '@/infra/media/types'
import { inferMediaType } from '@/infra/media/inferMediaType'
import { describe, expect, it } from 'vitest'

describe('media route — type inference discriminator (issue #651)', () => {
  it('classifies image/svg+xml as svg so the dark:invert branch in MediaAttachments is reached', () => {
    expect(inferMediaType('image/svg+xml')).toBe(MediaType.SVG)
    expect(inferMediaType('image/svg+xml', 'diagram.svg')).toBe(MediaType.SVG)
  })

  it('classifies raster images as image (not svg) so they are not inverted on dark backgrounds', () => {
    expect(inferMediaType('image/png')).toBe(MediaType.Image)
    expect(inferMediaType('image/jpeg')).toBe(MediaType.Image)
    expect(inferMediaType('image/webp')).toBe(MediaType.Image)
  })

  it('classifies video and audio mime types to their own buckets', () => {
    expect(inferMediaType('video/mp4')).toBe(MediaType.Video)
    expect(inferMediaType('audio/mpeg')).toBe(MediaType.Audio)
  })

  it('classifies PDFs as pdf', () => {
    expect(inferMediaType('application/pdf')).toBe(MediaType.PDF)
  })

  it('falls back to other for unknown mime types', () => {
    expect(inferMediaType('application/x-funky-unknown')).toBe(MediaType.Other)
  })

  it('returns other when mime type is missing or empty', () => {
    expect(inferMediaType(undefined)).toBe(MediaType.Other)
    expect(inferMediaType(null)).toBe(MediaType.Other)
    expect(inferMediaType('')).toBe(MediaType.Other)
  })
})
