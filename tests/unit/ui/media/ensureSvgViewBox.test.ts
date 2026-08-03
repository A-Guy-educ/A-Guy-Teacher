import { describe, expect, it } from 'vitest'

import { ensureSvgViewBox } from '@/ui/web/media/SVGMedia/ensureSvgViewBox'

describe('ensureSvgViewBox', () => {
  it('adds a viewBox derived from width and height when missing', () => {
    const input = '<svg width="250" height="150"><rect/></svg>'
    const output = ensureSvgViewBox(input)
    expect(output).toContain('viewBox="0 0 250 150"')
    expect(output).toContain('<rect/>')
  })

  it('leaves the SVG unchanged when a viewBox is already declared', () => {
    const input = '<svg viewBox="0 0 100 50" width="200" height="100"><rect/></svg>'
    expect(ensureSvgViewBox(input)).toBe(input)
  })

  it('is case-insensitive when detecting an existing viewBox', () => {
    const input = '<svg VIEWBOX="0 0 10 10" width="20" height="20"/>'
    expect(ensureSvgViewBox(input)).toBe(input)
  })

  it('returns input unchanged when width or height is missing', () => {
    expect(ensureSvgViewBox('<svg width="250"><rect/></svg>')).toBe(
      '<svg width="250"><rect/></svg>',
    )
    expect(ensureSvgViewBox('<svg height="150"><rect/></svg>')).toBe(
      '<svg height="150"><rect/></svg>',
    )
  })

  it('returns input unchanged when there is no <svg> tag', () => {
    expect(ensureSvgViewBox('<div>not an svg</div>')).toBe('<div>not an svg</div>')
    expect(ensureSvgViewBox('')).toBe('')
  })

  it('handles decimal width and height values', () => {
    const input = '<svg width="250.5" height="150.25"/>'
    expect(ensureSvgViewBox(input)).toContain('viewBox="0 0 250.5 150.25"')
  })

  it('handles unquoted attribute values', () => {
    const input = '<svg width=250 height=150><rect/></svg>'
    expect(ensureSvgViewBox(input)).toContain('viewBox="0 0 250 150"')
  })

  it('does not truncate the root tag on a `>` inside a quoted attribute value', () => {
    const input = '<svg data-note="a>b" width="100" height="50"><rect/></svg>'
    expect(ensureSvgViewBox(input)).toContain('viewBox="0 0 100 50"')
  })
})
