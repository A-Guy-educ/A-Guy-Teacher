/**
 * @fileType utility
 * @domain ui
 * @pattern remark-plugin
 * @ai-summary Remark plugin transforming ::token{text} syntax for highlights, named colors, and sizes (recurses into inline formatting and spans siblings).
 */

import { visit } from 'unist-util-visit'
import { isAllowedColorToken } from '@/infra/utils/allowedColorTokens'

// Local type definitions for mdast nodes (to avoid adding new dependencies)

interface Node {
  type: string
  data?: Record<string, unknown>
}

interface Parent extends Node {
  children: Node[]
}

interface Text extends Node {
  type: 'text'
  value: string
}

interface Root extends Parent {
  type: 'root'
  children: Node[]
}

/**
 * Custom mdast node for highlighted text with hast data.
 * The data.hName and data.hProperties will be used by remark-rehype.
 */
interface HighlightTextNode extends Parent {
  type: 'highlightText'
  // Widened to any phrasing content so we can preserve nested strong/em/etc.
  // that fall between the opening and closing braces in the mdast tree.
  children: Node[]
  data: {
    hName: 'span'
    hProperties: {
      className: string[]
    }
  }
}

/**
 * Remark plugin that transforms ::<token>{...} syntax into
 * <span class="aguy-<token>">...</span> for whitelisted color/size tokens.
 *
 * The plugin runs on `paragraph`, `heading`, and `listItem` nodes and:
 *
 * 1. Recurses into inline formatting nodes (strong, emphasis, delete, link…)
 *    so tokens fully contained inside `**bold**` or `*italic*` are picked up.
 * 2. Scans forward across sibling nodes when the opening `{` and closing `}`
 *    land in different text nodes (a common outcome when the author sprinkles
 *    bold/italic through the middle of a token). Any inline formatting between
 *    the braces is preserved inside the emitted `<span>`.
 * 3. Falls through unrecognised tokens as literal text (whitelist enforcement).
 * 4. Never touches code blocks, tables, or other non-phrasing content.
 *
 * SECURITY
 * - Only tokens in `ALLOWED_COLOR_TOKENS` are transformed.
 * - Uses `data.hName` + `data.hProperties` (safe remark-rehype directives) —
 *   never raw HTML — so unknown tokens can't inject markup.
 *
 * @example Single text node
 *   Input:  "This is ::text-green{important} text"
 *   Output: <p>This is <span class="aguy-text-green">important</span> text</p>
 *
 * @example Token fully inside bold
 *   Input:  "**intro ::text-blue{here} end**"
 *   Output: <p><strong>intro <span class="aguy-text-blue">here</span> end</strong></p>
 *
 * @example Token straddles an inline node
 *   Input:  "start ::text-blue{some *bold* here} end"
 *   Output: <p>start <span class="aguy-text-blue">some <em>bold</em> here</span> end</p>
 */
export function remarkColorSyntax() {
  return (tree: Root) => {
    const transformer = (node: Parent) => {
      node.children = transformChildren(node.children)
    }

    visit(tree, 'paragraph', transformer)
    visit(tree, 'heading', transformer)
    visit(tree, 'listItem', transformer)
  }
}

function hasChildren(node: Node): node is Parent {
  return node.type !== 'text' && 'children' in node && Array.isArray((node as Parent).children)
}

function makeHighlightNode(token: string, children: Node[]): HighlightTextNode {
  return {
    type: 'highlightText',
    children,
    data: {
      hName: 'span',
      hProperties: {
        className: [`aguy-${token}`],
      },
    },
  }
}

/**
 * Transform a list of sibling children:
 *   1) Recurse into any child with its own children so nested tokens (e.g.
 *      inside `<strong>`) are transformed too.
 *   2) Walk the siblings left-to-right, greedily consuming ::<token>{...}
 *      spans that may cross node boundaries.
 */
function transformChildren(children: Node[]): Node[] {
  // Step 1: recurse into inline formatting containers.
  for (const child of children) {
    if (hasChildren(child)) {
      child.children = transformChildren(child.children)
    }
  }

  // Step 2: sibling-aware scan for tokens.
  const result: Node[] = []
  let i = 0
  while (i < children.length) {
    const consumed = tryConsumeToken(children, i, result)
    if (consumed > 0) {
      i += consumed
    } else {
      result.push(children[i])
      i++
    }
  }
  return result
}

/**
 * Try to match a ::<token>{...} span starting at `children[start]`. Pushes the
 * resulting nodes onto `output` and returns how many source children were
 * consumed. Returns 0 when there is no match at this position.
 */
function tryConsumeToken(children: Node[], start: number, output: Node[]): number {
  const startNode = children[start]
  if (startNode.type !== 'text') return 0

  const startText = (startNode as Text).value
  const markerMatch = startText.match(/::([a-z0-9-]+)\{/)
  if (!markerMatch) return 0

  const token = markerMatch[1]
  if (!isAllowedColorToken(token)) return 0

  const markerIndex = markerMatch.index!
  const afterMarker = startText.substring(markerIndex + markerMatch[0].length)
  const prefix = markerIndex > 0 ? startText.substring(0, markerIndex) : ''

  // Fast path: closing brace lives in the same text node.
  const localClose = afterMarker.indexOf('}')
  if (localClose !== -1) {
    if (prefix) output.push({ type: 'text', value: prefix } as Text)
    output.push(
      makeHighlightNode(token, [
        { type: 'text', value: afterMarker.substring(0, localClose) } as Text,
      ]),
    )
    const trailing = afterMarker.substring(localClose + 1)
    if (trailing) {
      // Reprocess trailing text so back-to-back tokens on one line still work.
      output.push(...transformChildren([{ type: 'text', value: trailing } as Text]))
    }
    return 1
  }

  // Cross-node scan: closing brace lives in a later sibling.
  const collected: Node[] = []
  if (afterMarker) collected.push({ type: 'text', value: afterMarker } as Text)

  for (let j = start + 1; j < children.length; j++) {
    const sibling = children[j]

    if (sibling.type !== 'text') {
      // Inline formatting (strong/em/link/etc.) — keep it inside the span.
      // Its own children were already recursed in step 1.
      collected.push(sibling)
      continue
    }

    const sibText = (sibling as Text).value
    const closeIdx = sibText.indexOf('}')
    if (closeIdx === -1) {
      collected.push(sibling)
      continue
    }

    // Found the closing brace.
    const inside = sibText.substring(0, closeIdx)
    if (inside) collected.push({ type: 'text', value: inside } as Text)

    if (prefix) output.push({ type: 'text', value: prefix } as Text)
    output.push(makeHighlightNode(token, collected))

    const trailing = sibText.substring(closeIdx + 1)
    const remainder: Node[] = []
    if (trailing) remainder.push({ type: 'text', value: trailing } as Text)
    remainder.push(...children.slice(j + 1))

    // Reprocess the tail so additional tokens on the same line still fire.
    output.push(...transformChildren(remainder))

    // We already consumed everything from `start` through end of siblings.
    return children.length - start
  }

  // No closing brace anywhere — leave the original node untouched.
  return 0
}
