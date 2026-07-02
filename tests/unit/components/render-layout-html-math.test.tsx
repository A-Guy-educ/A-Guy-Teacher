// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RenderLayout } from '@/ui/web/layout-blocks/RenderLayout'

describe('RenderLayout HTML blocks', () => {
  it('renders admin HTML math as KaTeX', () => {
    const { container } = render(
      <RenderLayout blocks={[{ blockType: 'html', html: '<p>$x^2+4x$</p>' }]} />,
    )

    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.textContent).not.toContain('$x^2+4x$')
  })
})
