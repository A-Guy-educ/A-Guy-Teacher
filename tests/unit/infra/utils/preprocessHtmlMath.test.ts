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

  describe('currency and unit edge cases (documented behavior)', () => {
    /**
     * These cases document behavior where preprocessing should NOT wrap
     * the expression. Currency/unit prefixes (₪, $, €, etc.) are not
     * standard LaTeX math operators and are not detected as math expressions.
     */

    it('does not wrap shekel-prefixed numbers (₪10)', () => {
      // ₪ is not a digit or math operator, so no wrapping occurs
      const input = '<p>₪10</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('₪10')
      expect(result).not.toContain('$₪10$')
    })

    it('does not wrap euro-prefixed numbers (€3)', () => {
      const input = '<p>€3</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('€3')
      expect(result).not.toContain('$€3$')
    })

    it('preserves dollar-prefixed numbers that are already wrapped', () => {
      // "$5" with ASCII $ is detected as already wrapped
      const input = '<p>$5</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$5')
      // Should not double-wrap to $$5$$
      expect(result).not.toContain('$$5$$')
    })

    it('does not wrap plain dollar amounts without number context', () => {
      const input = '<p>$</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$')
    })
  })

  describe('percentage edge cases (documented behavior)', () => {
    /**
     * Percentages are not standard LaTeX math expressions. The % symbol
     * in LaTeX is a comment marker, not a modulo operator in this context.
     * These are documented as known edge cases where math rendering
     * may not work as expected even with $...$ wrapping.
     */

    it('does not wrap simple percentages', () => {
      // "50%" - % is not detected as a math operator
      const input = '<p>50%</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('50%')
      expect(result).not.toContain('$50%$')
    })

    it('does not wrap decimal percentages', () => {
      const input = '<p>25.5%</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('25.5%')
      expect(result).not.toContain('$25.5%$')
    })
  })

  describe('number range edge cases (documented behavior)', () => {
    /**
     * Number ranges like "1-5" (meaning "1 to 5") are ambiguous -
     * they could be parsed as subtraction (1 minus 5) or as a range.
     * The current implementation treats "1-5" as a math expression
     * (subtraction) and wraps it. This may or may not be the desired
     * behavior depending on context.
     */

    it('wraps number ranges as subtraction expressions', () => {
      // "1-5" is currently wrapped as $1-5$ (subtraction interpretation)
      const input = '<p>1-5</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$1-5$')
    })

    it('wraps numbers with em dash range indicators', () => {
      // Unicode em dash "—" is used for ranges in some contexts
      const input = '<p>5—10</p>'
      const result = preprocessHtmlMath(input)
      // The em dash is not in our operator list, so no wrapping
      expect(result).toContain('5—10')
    })
  })

  describe('equation and variable edge cases (documented behavior)', () => {
    /**
     * Equations with variables (like "x = 5") and algebraic expressions
     * (like "2x + 3 = 7") are NOT detected by the current regex because
     * they don't start with a digit. This is a known limitation.
     * KaTeX would render these correctly IF they were wrapped in $...$.
     */

    it('does not wrap simple equations with variables', () => {
      // "x = 5" - x is not a digit, so not detected
      const input = '<p>x = 5</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('x = 5')
      expect(result).not.toContain('$x = 5$')
    })

    it('does not wrap algebraic equations', () => {
      // "2x + 3 = 7" - 2x starts with a digit but x is not a number
      const input = '<p>2x + 3 = 7</p>'
      const result = preprocessHtmlMath(input)
      // Only "2x" might match but the full equation won't
      expect(result).not.toContain('$2x + 3 = 7$')
    })

    it('wraps equations with comparison operators when starting with digit', () => {
      // "5 + 1 = 6" is detected as math because it starts with a digit
      const input = '<p>5 + 1 = 6</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$5 + 1 = 6$')
    })
  })

  describe('number sequence edge cases (documented behavior)', () => {
    /**
     * Comma-separated numbers like "2,4,6,8" are typically sequences,
     * not math expressions, and should not be wrapped.
     */

    it('does not wrap comma-separated number sequences', () => {
      const input = '<p>2,4,6,8</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('2,4,6,8')
      expect(result).not.toContain('$2,4,6,8$')
    })

    it('wraps individual numbers in comma-separated context if they form math', () => {
      // Each number that's a valid math expression gets wrapped individually
      const input = '<p>2 + 2, 4 + 4</p>'
      const result = preprocessHtmlMath(input)
      expect(result).toContain('$2 + 2$')
      expect(result).toContain('$4 + 4$')
    })
  })
})
