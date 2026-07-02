// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { renderAdminHtmlWithMath } from '@/infra/utils/renderAdminHtmlWithMath'

describe('renderAdminHtmlWithMath', () => {
  it('renders inline math inside admin HTML as KaTeX', () => {
    const result = renderAdminHtmlWithMath('<p>The equation is $x^2+4x$.</p>')

    expect(result).toContain('class="katex"')
    expect(result).toContain('dir="ltr"')
    expect(result).toContain('isolate')
    expect(result).not.toContain('$x^2+4x$')
  })

  it('renders encoded dollar delimiters from admin HTML as KaTeX', () => {
    const result = renderAdminHtmlWithMath('<p>The equation is &#36;x^2+4x&#36;.</p>')

    expect(result).toContain('class="katex"')
    expect(result).not.toContain('$x^2+4x$')
    expect(result).not.toContain('&#36;x^2+4x&#36;')
  })

  it('renders display math inside admin HTML as KaTeX display mode', () => {
    const result = renderAdminHtmlWithMath('<p>$$x^2 + y^2 = z^2$$</p>')

    expect(result).toContain('class="katex-display"')
    expect(result).toContain('dir="ltr"')
    expect(result).not.toContain('$$x^2 + y^2 = z^2$$')
  })

  it('preserves trusted admin HTML tags and style attributes', () => {
    const result = renderAdminHtmlWithMath('<section style="color:red"><h2>Title</h2></section>')

    expect(result).toContain('<section style="color:red">')
    expect(result).toContain('<h2>Title</h2>')
  })

  it('keeps dollar text that does not look like math', () => {
    const result = renderAdminHtmlWithMath('<p>The prices are $5 and $10 today.</p>')

    expect(result).toContain('$5 and $10')
    expect(result).not.toContain('class="katex"')
  })

  it('does not render math inside code blocks', () => {
    const result = renderAdminHtmlWithMath('<code>$x^2+4x$</code>')

    expect(result).toContain('$x^2+4x$')
    expect(result).not.toContain('class="katex"')
  })

  it('keeps existing bare arithmetic support from HTML preprocessing', () => {
    const result = renderAdminHtmlWithMath('<p>0.1 + 0.2</p>')

    expect(result).toContain('class="katex"')
    expect(result).not.toContain('0.1 + 0.2</p>')
  })

  it('does not require browser DOM globals', () => {
    vi.stubGlobal('DOMParser', undefined)
    vi.stubGlobal('document', undefined)

    try {
      const result = renderAdminHtmlWithMath('<p>The equation is $x^2+4x$.</p>')

      expect(result).toContain('class="katex"')
      expect(result).not.toContain('$x^2+4x$')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
