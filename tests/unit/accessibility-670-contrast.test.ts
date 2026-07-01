// @vitest-environment node
/**
 * Regression guard for issue #670:
 *   "[Accessibility] Broken contrast (black text on dark backgrounds) in
 *    DemoLandingPage and Prep7 page"
 *
 * Bug summary: in light mode the design tokens are
 *   --background = cream  (#fcfaf6)
 *   --foreground = near-black (#1a1c1e)
 *
 * Sections that use `bg-foreground` therefore paint a dark canvas in light
 * mode. Any text-bearing element inside such a section that uses
 * `text-foreground` (or no color, so it inherits `text-foreground` from
 * `<main>`) ends up rendering black text on a black background and is
 * unreadable. The fix is to give those text classes light variants such as
 * `text-background` (or to be explicit via `dark:text-foreground` only).
 *
 * These tests locate the dark-background sections by reading the raw source
 * and assert that no heading or paragraph within them carries
 * `text-foreground` (which would produce the black-on-black outcome in light
 * mode). They are intentionally source-based so they fail loudly the moment
 * someone re-introduces the bad pattern, regardless of how the page is wired.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '../..')

const PREP7_PAGE = path.join(projectRoot, 'src/app/(frontend)/prep7/page.tsx')
const DEMO_LANDING_PAGE = path.join(projectRoot, 'src/ui/web/homepage/DemoLandingPage/index.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf8')
}

/**
 * Extracts the JSX body of the named function/component from the given
 * source. Skips the parameter list (which may itself contain `{...}` for
 * destructuring) by jumping past the closing `)` and any TypeScript
 * return-type annotation, then walks the resulting balanced `{ ... }`
 * block. This is intentionally scoped to per-file use so the regexes stay
 * small and predictable.
 */
function extractComponentBody(source: string, componentName: string): string {
  const signature = `function ${componentName}(`
  const signatureIdx = source.indexOf(signature)
  if (signatureIdx === -1) {
    throw new Error(`Could not locate component "${componentName}" in source`)
  }

  // Walk past the opening `(`, balancing nested `(`/`)` and `{`/`}`, until
  // we hit the closing `)` of the parameter list. Then jump past any
  // trailing TypeScript annotation, which also contains balanced `{...}`.
  let parenDepth = 1
  let braceDepth = 0
  let angleDepth = 0
  let inSingle = false
  let inDouble = false
  let inTpl = false
  let i = signatureIdx + signature.length
  let paramEnd = -1
  for (; i < source.length; i++) {
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
      if (parenDepth === 0) {
        paramEnd = i
        break
      }
    } else if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    else if (ch === '<') angleDepth++
    else if (ch === '>') angleDepth--
  }
  if (paramEnd === -1) {
    throw new Error(`Could not close parameter list for "${componentName}"`)
  }

  // Skip past any TypeScript return-type annotation that may follow the
  // parameter list — looks for `: <annotation> {`. We only care about the
  // `{` that delimits the function body, so we keep scanning until depth
  // returns to zero and the next non-space token is an opening `{`.
  let j = paramEnd + 1
  // Move past any `: Foo<...>` annotation. We bound-hunt for a `:` then
  // walk through one balanced `<...>` annotation block if present, then
  // return to depth-based scanning for any later TS annotation.
  // Simplification: collect all `{`/`}` after `)` until braceDepth returns
  // to 0 AND a `{` appears at depth 0 — that `{` is the function body.
  let postDepth = braceDepth
  let foundBody = false
  let bodyStart = -1
  for (; j < source.length; j++) {
    const ch = source[j]
    if (ch === '{') {
      if (postDepth === 0) {
        bodyStart = j
        foundBody = true
        break
      }
      postDepth++
    } else if (ch === '}') {
      postDepth--
    }
  }
  if (!foundBody) {
    throw new Error(`Could not locate function body for "${componentName}"`)
  }

  let depth = 1
  let k = bodyStart + 1
  let inStr = false
  let strCh = ''
  for (; k < source.length; k++) {
    const ch = source[k]
    if (inStr) {
      if (ch === strCh && source[k - 1] !== '\\') inStr = false
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = true
      strCh = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return source.slice(bodyStart, k + 1)
}

function findTagWithClassContaining(body: string, tag: 'h2' | 'h4' | 'p'): RegExpMatchArray[] {
  // Match the opening JSX tag <h2 ...>, <h4 ...>, or <p ...> and capture the
  // full className="..." or className={`...`} string so the assertion can
  // inspect its contents. The `[\s\S]*?` stops at the first `>` that closes
  // the opening tag.
  const re = new RegExp(`<${tag}\\b([\\s\\S]*?)>`, 'g')
  return Array.from(body.matchAll(re))
}

function classStringOf(tagMatch: RegExpMatchArray): string {
  // Pulls the value of the `className=` (string or template) attribute out
  // of a tag fragment captured by `findTagWithClassContaining`.
  const attrs = tagMatch[1]
  const stringMatch = attrs.match(/className="([^"]*)"/)
  if (stringMatch) return stringMatch[1]
  const tplMatch = attrs.match(/className=\{`([^`]*)`\}/)
  if (tplMatch) return tplMatch[1]
  return ''
}

function hasDarkTextClass(classString: string): boolean {
  // `text-foreground` (without a `dark:` override that flips it) renders as
  // near-black in light mode, which is the exact failure mode for issue
  // #670. We flag any token that resolves to foreground text in the default
  // (light) palette.
  const tokens = classString.split(/\s+/).filter(Boolean)
  return tokens.some((tok) => {
    if (tok === 'text-foreground') return true
    // `text-foreground/N` (e.g. `text-foreground/70`) is also dark text.
    if (/^text-foreground\/\d+/.test(tok)) return true
    // `dark:text-foreground` by itself is fine (it only applies in dark
    // mode), but if a class already has `text-foreground` AND a
    // `dark:text-foreground`, both modes end up dark. We treat that as
    // dark-text-classed too.
    if (tok === 'text-background' || /^text-background\/\d+/.test(tok)) return false
    return false
  })
}

function darkTextClassTokens(classString: string): string[] {
  return classString
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => {
      if (tok === 'text-foreground') return true
      if (/^text-foreground\/\d+/.test(tok)) return true
      return false
    })
}

function describeSectionAssertion(label: string, body: string): void {
  const tags: Array<'h2' | 'h4' | 'p'> = ['h2', 'h4', 'p']
  for (const tag of tags) {
    const matches = findTagWithClassContaining(body, tag)
    const violators = matches
      .map((m) => ({ raw: m[0], cls: classStringOf(m) }))
      .filter((entry) => hasDarkTextClass(entry.cls))

    if (violators.length > 0) {
      const detail = violators
        .map(
          (v) =>
            `  - ${v.raw.trim()}\n      classes: ${v.cls}\n      offending tokens: ${darkTextClassTokens(v.cls).join(', ')}`,
        )
        .join('\n')
      throw new Error(
        `[${label}] ${tag.toUpperCase()} elements inside a ` +
          `dark-background (bg-foreground) section must NOT use ` +
          `text-foreground (or text-foreground/N) — that renders as near-black ` +
          `text on a dark canvas in light mode (issue #670). ` +
          `Use light text tokens like text-background (or ` +
          `dark:text-foreground when you need it readable in dark mode).\n\n` +
          `Offending ${tag.toUpperCase()} element(s):\n${detail}`,
      )
    }
  }

  expect(matchesIfNoViolators(tags, body)).toBe(true)
}

function matchesIfNoViolators(tags: Array<'h2' | 'h4' | 'p'>, body: string): true {
  // Sanity: at minimum, the body should actually contain headings and
  // paragraphs — if not, this guard isn't testing the right component.
  for (const tag of tags) {
    if (findTagWithClassContaining(body, tag).length > 0) return true
  }
  throw new Error(
    'Expected the dark-background section to contain at least one h2/h4/p element; none found. Either the file was rewritten or the test needs updating.',
  )
}

describe('Issue #670 — contrast for dark-background sections', () => {
  it('prep7 / CourseFeatures does not render dark text on a dark canvas in light mode', () => {
    const source = read(PREP7_PAGE)
    const body = extractComponentBody(source, 'CourseFeatures')

    // Sanity check: this is the exact dark-background section from the bug
    // report — line 153: `<section ... bg-foreground ...>`.
    expect(body).toContain('bg-foreground')

    describeSectionAssertion('prep7 CourseFeatures', body)
  })

  it('DemoLandingPage / KnowledgeAndFeatures does not render dark text on a dark canvas in light mode', () => {
    const source = read(DEMO_LANDING_PAGE)
    const body = extractComponentBody(source, 'KnowledgeAndFeatures')

    // Sanity check: this is the exact dark-background section from the bug
    // report — line 187: `<section ... bg-foreground ...>`.
    expect(body).toContain('bg-foreground')

    describeSectionAssertion('DemoLandingPage KnowledgeAndFeatures', body)
  })
})
