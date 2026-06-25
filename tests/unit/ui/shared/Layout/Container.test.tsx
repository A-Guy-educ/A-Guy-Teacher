// @vitest-environment jsdom
import { Container } from '@/ui/web/shared/Layout/Container'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Container', () => {
  describe('responsive width (default)', () => {
    it('applies full width on mobile by default', () => {
      const { container } = render(<Container>Content</Container>)
      const div = container.querySelector('div')

      expect(div).not.toBeNull()
      expect(div?.className).toContain('w-full')
    })

    it('applies 92% width on tablet (md breakpoint)', () => {
      const { container } = render(<Container>Content</Container>)
      const div = container.querySelector('div')

      expect(div?.className).toContain('md:w-11/12')
    })

    it('applies max-width 896px on desktop (lg breakpoint)', () => {
      const { container } = render(<Container>Content</Container>)
      const div = container.querySelector('div')

      expect(div?.className).toContain('lg:max-w-[896px]')
    })

    it('centers content with mx-auto', () => {
      const { container } = render(<Container>Content</Container>)
      const div = container.querySelector('div')

      expect(div?.className).toContain('mx-auto')
    })
  })

  describe('non-responsive mode', () => {
    it('applies full width and max-width when responsive is false', () => {
      const { container } = render(<Container responsive={false}>Content</Container>)
      const div = container.querySelector('div')

      expect(div?.className).toContain('w-full')
      expect(div?.className).toContain('max-w-[896px]')
      expect(div?.className).not.toContain('md:w-11/12')
      expect(div?.className).not.toContain('lg:max-w-[896px]')
    })
  })

  describe('custom className', () => {
    it('merges custom className with default classes', () => {
      const { container } = render(<Container className="custom-class another">Content</Container>)
      const div = container.querySelector('div')

      expect(div?.className).toContain('custom-class')
      expect(div?.className).toContain('another')
      expect(div?.className).toContain('w-full')
      expect(div?.className).toContain('mx-auto')
    })
  })

  describe('children', () => {
    it('renders children correctly', () => {
      const { container } = render(
        <Container>
          <span>Child element</span>
        </Container>,
      )

      expect(container.querySelector('span')?.textContent).toContain('Child element')
    })
  })

  describe('passes through additional props', () => {
    it('forwards id prop', () => {
      const { container } = render(<Container id="test-id">Content</Container>)
      const div = container.querySelector('div')

      expect(div?.id).toBe('test-id')
    })

    it('forwards data-testid attribute', () => {
      const { container } = render(<Container data-testid="container-test">Content</Container>)
      const div = container.querySelector('div')

      expect(div?.getAttribute('data-testid')).toBe('container-test')
    })
  })
})
