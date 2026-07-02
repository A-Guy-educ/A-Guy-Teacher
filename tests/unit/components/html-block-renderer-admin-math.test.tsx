// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HtmlBlockRenderer } from '@/ui/web/exerciserenderer/blocks/HtmlBlockRenderer'

describe('HtmlBlockRenderer admin HTML math', () => {
  it('renders admin HTML math as KaTeX', () => {
    const { container } = render(
      <HtmlBlockRenderer block={{ type: 'html', html: '<p>$x^2+4x$</p>' } as never} />,
    )

    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.textContent).not.toContain('$x^2+4x$')
  })
})
