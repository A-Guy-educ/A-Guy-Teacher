import katex from 'katex'

const MATH_RE =
  /(?<!\\)\$\$([\s\S]+?)\$\$(?!\d)|(?<!\\)\$\$([^$\n]+?)\$(?!\$|\d)|(?<!\\)\$([^$\n]+?)\$(?!\d)/g
const TAG_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype\b[^>]*>|<\/?[A-Za-z][^>]*>/gi
const DOLLAR_ENTITY_RE = /&(dollar|#36|#x24);/gi
const SKIP_TAGS = new Set(['code', 'pre', 'script', 'style', 'textarea'])
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const DECIMAL = String.raw`-?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)`
const FRACTION = String.raw`-?\d+(?:[.,]\d+)?\s*[\/÷]\s*-?\d+(?:[.,]\d+)?`
const POWER = String.raw`${DECIMAL}\s*\^[^{}\s<]+`
const ARITHMETIC = String.raw`${DECIMAL}(?:\s*[\+\-\*×÷]\s*${DECIMAL})(?:[\s ‏]*[=<>≤≥]\s*${DECIMAL})?(?:\s*[\+\-\*×÷]\s*${DECIMAL})*`
const BARE_MATH_RE = new RegExp(`(^|[\\s ‏])(${FRACTION}|${POWER}|${ARITHMETIC})`, 'g')

type StackEntry = {
  name: string
  skip: boolean
}

function wrapInline(rendered: string): string {
  return `<span dir="ltr" class="isolate inline-block align-middle">${rendered}</span>`
}

function wrapDisplay(rendered: string): string {
  return `<div dir="ltr" class="isolate block text-center mt-3 mb-3">${rendered}</div>`
}

function canRenderInlineMath(source: string): boolean {
  const value = source.trim()
  if (!value) return false
  if (/^[A-Za-z]$/.test(value)) return true
  return /[\\^_{}=<>+\-*×÷/]|\d[A-Za-z]|[A-Za-z]\d/.test(value)
}

function renderMath(source: string, displayMode: boolean): string | null {
  const value = source.trim()
  if (!value) return null
  if (!displayMode && !canRenderInlineMath(value)) return null

  const rendered = katex.renderToString(value, {
    displayMode,
    throwOnError: false,
    strict: false,
    trust: false,
  })

  return displayMode ? wrapDisplay(rendered) : wrapInline(rendered)
}

function renderBareMathInText(text: string): string {
  BARE_MATH_RE.lastIndex = 0
  return text.replace(BARE_MATH_RE, (match, prefix: string, source: string) => {
    const rendered = renderMath(source, false)
    return rendered ? `${prefix}${rendered}` : match
  })
}

function renderMathInText(text: string): string {
  const original = text.replace(DOLLAR_ENTITY_RE, '$')
  MATH_RE.lastIndex = 0

  let match: RegExpExecArray | null
  let lastIndex = 0
  let changed = false
  let renderedText = ''

  while ((match = MATH_RE.exec(original))) {
    const [raw, display, malformedInline, inline] = match
    const isDisplay = display !== undefined
    const source = display ?? malformedInline ?? inline
    if (source === undefined) continue
    const rendered = renderMath(source, isDisplay)

    if (!rendered) continue

    renderedText += renderBareMathInText(original.slice(lastIndex, match.index))
    renderedText += rendered
    lastIndex = match.index + raw.length
    changed = true
  }

  if (!changed) return renderBareMathInText(original)

  renderedText += renderBareMathInText(original.slice(lastIndex))
  return renderedText
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderTextWithMath(text: string): string {
  if (!text) return ''
  return renderMathInText(escapeHtml(text))
}

function extractBodyHtml(html: string): string {
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html)
  if (bodyMatch) return bodyMatch[1] ?? ''

  return html
    .replace(/^\s*<!doctype\b[^>]*>\s*/i, '')
    .replace(/^\s*<html\b[^>]*>\s*/i, '')
    .replace(/\s*<\/html\s*>\s*$/i, '')
}

function getTagName(tag: string): string | null {
  const match = /^<\/?\s*([A-Za-z][\w:-]*)/.exec(tag)
  return match?.[1]?.toLowerCase() ?? null
}

function hasKatexClass(tag: string): boolean {
  const match = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
  const className = match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
  return className.split(/\s+/).includes('katex')
}

function closesTag(tag: string): boolean {
  return /^<\s*\//.test(tag)
}

function selfClosesTag(tag: string, name: string): boolean {
  return VOID_TAGS.has(name) || /\/\s*>$/.test(tag)
}

function closeStackEntry(stack: StackEntry[], name: string): void {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const entry = stack.pop()
    if (entry?.name === name) return
  }
}

function isSkippingText(stack: StackEntry[]): boolean {
  return stack.some((entry) => entry.skip)
}

/**
 * Renders admin-authored HTML with KaTeX math.
 *
 * This intentionally does not sanitize: HtmlBlock content is restricted to
 * trusted admins at authoring time. See `.ai-docs/knowledge/admin-html-content.md`.
 */
export function renderAdminHtmlWithMath(html: string): string {
  if (!html?.trim()) return ''

  const source = extractBodyHtml(html)
  const stack: StackEntry[] = []
  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  TAG_RE.lastIndex = 0
  while ((match = TAG_RE.exec(source))) {
    const tag = match[0]
    const text = source.slice(lastIndex, match.index)
    result += isSkippingText(stack) ? text : renderMathInText(text)
    result += tag

    const name = getTagName(tag)
    if (name) {
      if (closesTag(tag)) {
        closeStackEntry(stack, name)
      } else if (!selfClosesTag(tag, name)) {
        stack.push({ name, skip: SKIP_TAGS.has(name) || hasKatexClass(tag) })
      }
    }

    lastIndex = match.index + tag.length
  }

  const tail = source.slice(lastIndex)
  result += isSkippingText(stack) ? tail : renderMathInText(tail)
  return result
}
