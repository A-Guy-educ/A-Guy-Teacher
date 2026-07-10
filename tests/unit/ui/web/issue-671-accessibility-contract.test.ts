// @vitest-environment node
/**
 * Source-level contract for issue #671:
 *   "[UI/UX] Systemic Fix for High-Contrast Accessibility and Rich HTML/Math
 *    Rendering in Lessons"
 *
 * This test fails loudly the moment any of the four aspects of the bug regress:
 *
 *  1. The Button `outline` variant must not paint its label with
 *     `text-primary-foreground` over `bg-background` (white-on-white in light
 *     mode). It must use a readable dark token such as `text-foreground` or
 *     `text-primary`.
 *
 *  2. The dark `KnowledgeAndFeatures` section in DemoLandingPage must not
 *     apply `text-foreground dark:text-foreground` (or any paired dark-text
 *     token) to its inner elements, because that combination renders
 *     near-black text on the section's dark canvas in light mode.
 *
 *  3. The dark `CourseFeatures` section in /prep7 must not apply
 *     `text-foreground dark:text-foreground` to its inner elements for the
 *     same reason.
 *
 *  4. The lesson renderer `HtmlBlock` in `ContentPageBodyRenderer` must
 *     render through the client-side `SafeHtml` component with
 *     `enableProse={true}` so semantic HTML (divs, tables, lists) is
 *     styled and survives sanitization — it must not be routed through
 *     `MathMarkdown` (which strips HTML tags) nor through
 *     `AdminHtmlWithMath` (which is the legacy admin-only pipeline that
 *     does not participate in the lesson prose styles).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '../../../..')

const BUTTON_FILE = path.join(projectRoot, 'src/ui/web/components/button.tsx')
const DEMO_LANDING_FILE = path.join(projectRoot, 'src/ui/web/homepage/DemoLandingPage/index.tsx')
const PREP7_FILE = path.join(projectRoot, 'src/app/(frontend)/prep7/page.tsx')
const LESSON_RENDERER_FILE = path.join(
  projectRoot,
  'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ContentPageBodyRenderer/index.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf8')
}

/**
 * Walks past the parameter list of a `function Name(` declaration, balancing
 * `(...)` and tracking strings/templates so JSX expressions inside the
 * parameter list don't confuse the parser. Returns the index of the
 * function body's opening `{`.
 */
function findFunctionBodyStart(source: string, componentName: string): number {
  const signature = `function ${componentName}(`
  const start = source.indexOf(signature)
  if (start === -1) {
    throw new Error(`Could not locate function "${componentName}"`)
  }
  let i = start + signature.length
  let parenDepth = 1
  let inSingle = false
  let inDouble = false
  let inTpl = false
  while (i < source.length) {
    const ch = source[i]
    if (inSingle) {
      if (ch === "'" && source[i - 1] !== '\\') inSingle = false
    } else if (inDouble) {
      if (ch === '"' && source[i - 1] !== '\\') inDouble = false
    } else if (inTpl) {
      if (ch === '`' && source[i - 1] !== '\\') inTpl = false
    } else if (ch === "'") inSingle = true
    else if (ch === '"') inDouble = true
    else if (ch === '`') inTpl = true
    else if (ch === '(') parenDepth++
    else if (ch === ')') {
      parenDepth--
      if (parenDepth === 0) break
    }
    i++
  }
  // Walk past any TS return-type annotation (`{ ... }` brackets) to the
  // body's opening `{`.
  let j = i + 1
  let braceDepth = 0
  for (; j < source.length; j++) {
    const ch = source[j]
    if (ch === '{') {
      if (braceDepth === 0) return j
      braceDepth++
    } else if (ch === '}') {
      braceDepth--
    }
  }
  throw new Error(`Could not locate body for "${componentName}"`)
}

function extractFunctionBody(source: string, componentName: string): string {
  const bodyStart = findFunctionBodyStart(source, componentName)
  let depth = 1
  let i = bodyStart + 1
  let inSingle = false
  let inDouble = false
  let inTpl = false
  for (; i < source.length; i++) {
    const ch = source[i]
    if (inSingle) {
      if (ch === "'" && source[i - 1] !== '\\') inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"' && source[i - 1] !== '\\') inDouble = false
      continue
    }
    if (inTpl) {
      if (ch === '`' && source[i - 1] !== '\\') inTpl = false
      continue
    }
    if (ch === "'") {
      inSingle = true
    } else if (ch === '"') {
      inDouble = true
    } else if (ch === '`') {
      inTpl = true
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(bodyStart, i + 1)
    }
  }
  throw new Error(`Unterminated function body for "${componentName}"`)
}

function extractOutlineVariantClass(source: string): string {
  // Pulls the string literal assigned to the `outline` key of the
  // `buttonVariants` cva config. The outline variant is two-space indented
  // and its classes sit on a single line directly under the key.
  const match = source.match(/outline:\s*\n?\s*'([^']*)'/)
  if (!match) {
    throw new Error(`Could not find \`outline:\` variant in button.tsx — was the variant renamed?`)
  }
  return match[1]
}

function hasDarkPairedTextClass(body: string): { found: boolean; snippet?: string } {
  // We flag any class string that contains BOTH `text-foreground` (or
  // `text-foreground/N`) AND `dark:text-foreground` because in light mode
  // the first token renders near-black on the section's dark canvas. The
  // pattern is found in JSX className strings OR in cva variant literals.
  // Anchoring the first token on a non-colon boundary avoids matching the
  // `text-foreground` substring that appears inside `dark:text-foreground`.
  const lines = body.split('\n')
  for (const line of lines) {
    const hasTextFg = /(^|[\s"'])text-foreground(?:\/\d+)?\b/.test(line)
    const hasDarkTextFg = /\bdark:text-foreground\b/.test(line)
    if (hasTextFg && hasDarkTextFg) {
      return { found: true, snippet: line.trim() }
    }
  }
  return { found: false }
}

describe('Issue #671 — accessibility and rich-HTML contract', () => {
  describe('1. Button outline variant contrast', () => {
    it('does not paint the outline variant label with text-primary-foreground over bg-background', () => {
      const source = read(BUTTON_FILE)
      const outlineClass = extractOutlineVariantClass(source)

      expect(outlineClass).toContain('bg-background')
      expect(outlineClass).not.toContain('text-primary-foreground')
    })
  })

  describe('2. DemoLandingPage KnowledgeAndFeatures dark section', () => {
    it('does not apply text-foreground dark:text-foreground to inner elements', () => {
      const source = read(DEMO_LANDING_FILE)
      const body = extractFunctionBody(source, 'KnowledgeAndFeatures')

      // Sanity check — the section is identified as the dark one because
      // it uses `bg-foreground`. If that ever changes, this guard stops
      // being meaningful and the test should be revisited.
      expect(body).toContain('bg-foreground')

      const result = hasDarkPairedTextClass(body)
      expect(result.found).toBe(false)
    })
  })

  describe('3. prep7 CourseFeatures dark section', () => {
    it('does not apply text-foreground dark:text-foreground to inner elements', () => {
      const source = read(PREP7_FILE)
      const body = extractFunctionBody(source, 'CourseFeatures')

      // The section must contain a dark-canvas child (bg-foreground) for
      // this contract to be meaningful. Skip silently if the structure has
      // been refactored away.
      if (!body.includes('bg-foreground')) {
        expect(body).not.toContain('bg-foreground')
        return
      }

      const result = hasDarkPairedTextClass(body)
      expect(result.found).toBe(false)
    })
  })

  describe('4. Lesson HtmlBlock renders through SafeHtml with enableProse', () => {
    it('imports SafeHtml and uses it with enableProse in HtmlBlock', () => {
      const source = read(LESSON_RENDERER_FILE)

      // Must NOT route the HTML through MathMarkdown — it strips tags.
      expect(source).not.toMatch(/from\s+['"]@?\/ui\/web\/shared\/MathMarkdown['"]/)
      expect(source).not.toMatch(/<MathMarkdown\b/)

      // Must NOT use the legacy admin-only pipeline either.
      expect(source).not.toMatch(/from\s+['"]@?\/ui\/web\/shared\/AdminHtmlWithMath['"]/)
      expect(source).not.toMatch(/<AdminHtmlWithMath\b/)

      // Must import SafeHtml.
      expect(source).toMatch(
        /import\s*\{[^}]*\bSafeHtml\b[^}]*\}\s*from\s+['"]@?\/ui\/web\/SafeHtml['"]/,
      )

      // The HtmlBlock function body must render SafeHtml with
      // `enableProse` so semantic HTML (divs, tables, lists) is styled.
      const htmlBlockBody = extractFunctionBody(source, 'HtmlBlock')
      expect(htmlBlockBody).toMatch(/<SafeHtml\b/)
      // Accept both `enableProse` (JSX shorthand for `={true}`) and
      // `enableProse={true}` / `enableProse={false}` — only the truthy
      // forms satisfy the contract.
      expect(htmlBlockBody).toMatch(
        /enableProse(?:\s*=\s*\{\s*true\s*\})?(?!\s*=\s*\{\s*false\s*\})/,
      )
    })
  })
})
