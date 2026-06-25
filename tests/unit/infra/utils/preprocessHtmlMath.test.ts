// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { preprocessHtmlMath } from '@/infra/utils/preprocessHtmlMath'

describe('preprocessHtmlMath', () => {
  describe('basic arithmetic expressions', () => {
    it('wraps simple addition expressions with dollar signs', () => {
      const input = '<p>0.1 + 0.2</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$0.1 + 0.2$')
    })

    it('wraps subtraction expressions with dollar signs', () => {
      const input = '<p>5 - 3</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$5 - 3$')
    })

    it('wraps multiplication expressions with × symbol', () => {
      const input = '<p>3 × 4</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$3 × 4$')
    })

    it('wraps division expressions with ÷ symbol', () => {
      const input = '<p>10 ÷ 2</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$10 ÷ 2$')
    })
  })

  describe('fractions', () => {
    it('wraps fraction-like expressions with /', () => {
      const input = '<p>1/2</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$1/2$')
    })

    it('wraps fraction-like expressions with ÷', () => {
      const input = '<p>1 ÷ 2</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$1 ÷ 2$')
    })

    it('wraps negative fractions', () => {
      const input = '<p>-1/2</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$-1/2$')
    })

    it('wraps fractions with decimal numbers', () => {
      const input = '<p>1.5/2.5</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$1.5/2.5$')
    })
  })

  describe('power expressions', () => {
    it('wraps power expressions with ^', () => {
      const input = '<p>2^3</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$2^3$')
    })

    it('wraps power expressions with negative base', () => {
      const input = '<p>-2^3</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$-2^3$')
    })
  })

  describe('complex expressions', () => {
    it('wraps expressions with comparison operators', () => {
      const input = '<p>5 + 1 = 6</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$5 + 1 = 6$')
    })

    it('wraps multiple operations', () => {
      const input = '<p>1 + 2 × 3</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$1 + 2 × 3$')
    })

    it('handles expressions with spaces', () => {
      const input = '<p>0.1 + 0.2 = ?</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$0.1 + 0.2$')
      expect(result).toContain('= ?')
    })
  })

  describe('already-wrapped expressions', () => {
    it('does not double-wrap already dollar-wrapped expressions', () => {
      const input = '<p>$x + y$</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$x + y$')
      expect(result).not.toContain('$$x + y$$')
    })

    it('preserves double-dollar block math', () => {
      const input = '<p>$$x^2$$</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$$x^2$$')
    })
  })

  describe('skipping protected elements', () => {
    it('skips text inside code elements', () => {
      const input = '<code>1 + 2</code>'
      const result = preprocessHtmlMath(input)
      expect(result).not.toContain('$1 + 2$')
      expect(result).toContain('1 + 2')
    })

    it('skips text inside pre elements', () => {
      const input = '<pre>3 × 4</pre>'
      const result = preprocessHtmlMath(input)
      expect(result).not.toContain('$3 × 4$')
      expect(result).toContain('3 × 4')
    })

    it('skips text inside script elements', () => {
      const input = '<script>5 - 3</script>'
      const result = preprocessHtmlMath(input)
      expect(result).not.toContain('$5 - 3$')
    })

    it('skips text inside style elements', () => {
      const input = '<style>p { 1/2 }</style>'
      const result = preprocessHtmlMath(input)
      expect(result).not.toContain('$1/2$')
    })

    it('skips text inside textarea elements', () => {
      const input = '<textarea>6 ÷ 2</textarea>'
      const result = preprocessHtmlMath(input)
      expect(result).not.toContain('$6 ÷ 2$')
    })

    it('skips text inside elements with katex class', () => {
      const input = '<span class="katex">x + y</span>'
      const result = preprocessHtmlMath(input)
      expect(result).not.toContain('$x + y$')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(preprocessHtmlMath('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(preprocessHtmlMath('   ')).toBe('')
    })

    it('handles text without math expressions', () => {
      const input = '<p>Hello world</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('Hello world')
      expect(result).not.toContain('$')
    })

    it('handles nested elements', () => {
      const input = '<div><p><strong>5 + 3</strong></p></div>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$5 + 3$')
    })
  })
})
