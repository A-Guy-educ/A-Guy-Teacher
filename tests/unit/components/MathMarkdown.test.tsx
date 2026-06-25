// @vitest-environment jsdom
import { MathMarkdown } from '@/ui/web/shared'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('MathMarkdown', () => {
  describe('Plain text (no math)', () => {
    it('renders plain text without math wrappers', () => {
      const { container } = render(<MathMarkdown content="Hello world" />)

      expect(container.querySelector('.isolate.inline-block')).toBeNull()
      expect(container.querySelector('.isolate.block')).toBeNull()
      expect(container.textContent).toContain('Hello world')
    })
  })

  describe('Inline math RTL isolation', () => {
    it('wraps inline math with LTR isolation', () => {
      const { container } = render(<MathMarkdown content="The value is $E = mc^2$ here" />)

      const inlineMath = container.querySelector('.isolate.inline-block[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps multiple inline math expressions', () => {
      const { container } = render(<MathMarkdown content="Given $x = 5$ and $y = 10$" />)

      const inlineMaths = container.querySelectorAll('.isolate.inline-block[dir="ltr"]')
      expect(inlineMaths.length).toBe(2)
    })
  })

  describe('Block math RTL isolation', () => {
    it('wraps block math with LTR isolation', () => {
      const { container } = render(<MathMarkdown content={'$$\nx = \\frac{-b}{2a}\n$$'} />)

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })
  })

  describe('Custom components', () => {
    it('applies custom component overrides when provided', () => {
      const { container } = render(
        <MathMarkdown
          content="Hello world"
          components={{
            p: ({ children }) => <p data-testid="custom-p">{children}</p>,
          }}
        />,
      )

      expect(container.querySelector('[data-testid="custom-p"]')).not.toBeNull()
    })

    it('renders default elements when no components provided', () => {
      const { container } = render(<MathMarkdown content="Hello world" />)

      expect(container.querySelector('p')).not.toBeNull()
      expect(container.querySelector('[data-testid]')).toBeNull()
    })
  })

  describe('className', () => {
    it('applies className to wrapper div', () => {
      const { container } = render(<MathMarkdown content="test" className="my-custom-class" />)

      expect(container.querySelector('.my-custom-class')).not.toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('renders without errors when content is empty', () => {
      const { container } = render(<MathMarkdown content="" />)
      expect(container.firstElementChild).not.toBeNull()
    })

    it('does NOT normalize LaTeX delimiters (that is chat-specific)', () => {
      // MathMarkdown does NOT call normalizeLatexDelimiters.
      // \[...\] is NOT recognized by remark-math, so no KaTeX rendered.
      // This verifies the shared component stays generic.
      const { container } = render(<MathMarkdown content="\\[ x^2 \\]" />)

      expect(container.querySelector('.katex')).toBeNull()
    })
  })

  describe('Decimal arithmetic expressions (via HtmlBlockRenderer preprocessing)', () => {
    /**
     * These tests verify end-to-end math rendering for expressions that
     * are preprocessed by HtmlBlockRenderer (via preprocessHtmlMath) before
     * being passed to MathMarkdown. The preprocessing wraps bare math
     * expressions like "0.1 + 0.2" in $...$ delimiters.
     */

    it('renders decimal addition expressions', () => {
      // "0.1 + 0.2" preprocessed to "$0.1 + 0.2$" by HtmlBlockRenderer
      const { container } = render(<MathMarkdown content="$0.1 + 0.2$" />)
      expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('renders subtraction expressions', () => {
      const { container } = render(<MathMarkdown content="$5 - 3$" />)
      expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('renders multiplication expressions', () => {
      const { container } = render(<MathMarkdown content="$3 × 4$" />)
      expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('renders division expressions', () => {
      const { container } = render(<MathMarkdown content="$10 ÷ 2$" />)
      expect(container.querySelector('.katex')).not.toBeNull()
    })
  })

  describe('Fractions (via HtmlBlockRenderer preprocessing)', () => {
    it('renders simple fraction expressions', () => {
      const { container } = render(<MathMarkdown content="$1/2$" />)
      expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('renders compound fraction expressions', () => {
      // "1/2 + 1/4" preprocessed to "$1/2 + 1/4$" by HtmlBlockRenderer
      const { container } = render(<MathMarkdown content="$1/2 + 1/4$" />)
      expect(container.querySelector('.katex')).not.toBeNull()
    })
  })

  describe('Already-wrapped expressions', () => {
    it('does not double-wrap already dollar-wrapped expressions', () => {
      const { container } = render(<MathMarkdown content="$x + y$" />)
      const katexElements = container.querySelectorAll('.katex')
      // Should render exactly one KaTeX element, not nested ones
      expect(katexElements.length).toBe(1)
    })

    it('preserves double-dollar block math', () => {
      const { container } = render(<MathMarkdown content={'$$\nx^2\n$$'} />)
      expect(container.querySelector('.katex-display')).not.toBeNull()
    })
  })

  describe('Currency and unit edge cases (documented behavior)', () => {
    /**
     * These cases document edge case behavior where math preprocessing
     * should NOT wrap the expression. Currency/unit prefixes (₪, $, €)
     * are not standard LaTeX math operators and are not detected as math.
     */

    it('renders plain text with currency symbols without math delimiters', () => {
      // Currency-prefixed numbers like "₪10" are not standard KaTeX math
      const { container } = render(<MathMarkdown content="The price is ₪10" />)
      expect(container.querySelector('.katex')).toBeNull()
      expect(container.textContent).toContain('₪10')
    })

    it('renders percentages without math rendering', () => {
      // "50%" is not standard KaTeX math syntax
      const { container } = render(<MathMarkdown content="50% discount" />)
      expect(container.querySelector('.katex')).toBeNull()
      expect(container.textContent).toContain('50%')
    })

    it('renders plain text with numbers without adding math delimiters', () => {
      const { container } = render(<MathMarkdown content="The values are 1, 2, 3 and 4" />)
      expect(container.querySelector('.katex')).toBeNull()
      expect(container.textContent).toContain('1, 2, 3 and 4')
    })
  })

  describe('RTL isolation for math in RTL contexts', () => {
    it('wraps inline math with LTR isolation', () => {
      const { container } = render(<MathMarkdown content="$0.1 + 0.2$" />)
      const inlineMath = container.querySelector('.isolate.inline-block[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps block math with LTR isolation', () => {
      const { container } = render(<MathMarkdown content={'$$\n0.1 + 0.2\n$$'} />)
      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })
  })
})
