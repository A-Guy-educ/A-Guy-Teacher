/**
 * @fileType utility
 * @domain infra
 */

/**
 * Regex patterns for detecting math expressions in HTML text nodes.
 * These patterns identify fractions, powers, and basic arithmetic expressions
 * that should be rendered by KaTeX.
 */
const FRACTION_REGEX = /(?:^|[\s ‏])(-?\d+(?:[.,]\d+)?\s*[\/÷]\s*-?\d+(?:[.,]\d+)?)/g
const POWER_REGEX = /(?:^|[\s ‏])(-?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)\s*\^[^{}\s]+)/g
const MATH_EXPRESSION_REGEX =
  /(?:^|[\s ‏])(-?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)(?:\s*[\+\-\*×÷]\s*-?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+))(?:[\s ]*[=<>≤≥]\s*-?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+))?(?:\s*[\+\-\*×÷]\s*-?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+))*)/g

/**
 * Walks through text nodes in an HTML string and wraps detected math expressions
 * with $...$ delimiters so KaTeX can render them.
 *
 * Skips text nodes inside:
 * - Elements with class "katex" (already processed math)
 * - Code, pre, script, style, textarea elements
 * - Empty text nodes
 */
function wrapMathInTextNodes(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node)
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement
    if (!parent) continue
    if (
      parent.closest('.katex') ||
      ['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)
    )
      continue
    const original = textNode.textContent || ''
    if (!original.trim()) continue

    const combined = new RegExp(
      [FRACTION_REGEX.source, POWER_REGEX.source, MATH_EXPRESSION_REGEX.source]
        .join('|')
        .replace(/\/(?:g|m)\b/g, ''),
      'g',
    )
    const wrapped = original.replace(combined, (match) => {
      const trimmed = match.trim()
      if (trimmed.startsWith('$') && trimmed.endsWith('$')) return match
      return `$${trimmed}$`
    })
    if (wrapped !== original) textNode.textContent = wrapped
  }
  return doc.body.innerHTML
}

/**
 * Preprocesses HTML content to wrap detected math expressions with $...$ delimiters
 * so KaTeX can render them properly.
 *
 * This is needed because CMS HTML blocks may contain math expressions like "0.1 + 0.2"
 * that should be rendered by KaTeX instead of appearing as raw text with blank squares.
 *
 * @param html - Raw HTML string from CMS
 * @returns HTML string with math expressions wrapped in $...$ delimiters
 *
 * @example
 * preprocessHtmlMath('<p>0.1 + 0.2 = ?</p>')
 * // Returns: '<p>$0.1 + 0.2$ = ?</p>'
 */
export function preprocessHtmlMath(html: string): string {
  return wrapMathInTextNodes(html)
}
