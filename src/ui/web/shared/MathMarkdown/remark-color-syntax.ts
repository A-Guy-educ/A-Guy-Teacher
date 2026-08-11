/**
 * @fileType utility
 * @domain ui
 * @pattern remark-plugin
 * @ai-summary Remark plugin transforming ::token{text} syntax for highlights, named colors, and sizes (single-node only)
 */

import { visit } from 'unist-util-visit'

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

type PhrasingContent = Text | HighlightTextNode

interface Root extends Parent {
  type: 'root'
  children: Node[]
}

/**
 * Whitelisted tokens that are allowed for rendering.
 * Any token not in this list will be rendered as literal text.
 *
 * Categories:
 * - Numbered highlights: text-highlight-1..8 (design-system palette slots)
 * - Named colors: text-red/orange/yellow/green/blue/purple/pink/gray/black
 *   (semantic aliases mapping to the same palette slots)
 * - Sizes: text-size-xs/small/medium/large/xlarge/xxlarge
 */
const ALLOWED_TOKENS = [
  'text-highlight-1',
  'text-highlight-2',
  'text-highlight-3',
  'text-highlight-4',
  'text-highlight-5',
  'text-highlight-6',
  'text-highlight-7',
  'text-highlight-8',
  'text-red',
  'text-orange',
  'text-yellow',
  'text-green',
  'text-blue',
  'text-purple',
  'text-pink',
  'text-gray',
  'text-black',
  'text-size-xs',
  'text-size-small',
  'text-size-medium',
  'text-size-large',
  'text-size-xlarge',
  'text-size-xxlarge',
] as const
type AllowedToken = (typeof ALLOWED_TOKENS)[number]

function isAllowedToken(token: string): token is AllowedToken {
  return ALLOWED_TOKENS.includes(token as AllowedToken)
}

/**
 * Custom mdast node for highlighted text with hast data.
 * The data.hName and data.hProperties will be used by remark-rehype.
 */
interface HighlightTextNode extends Parent {
  type: 'highlightText'
  children: PhrasingContent[]
  data: {
    hName: 'span'
    hProperties: {
      className: string[]
    }
  }
}

/**
 * Simplified remark plugin to transform ::token{text} syntax.
 *
 * IMPORTANT: This plugin ONLY transforms syntax when BOTH the opening marker
 * ::token{ and the matching closing } exist within the SAME text node.
 *
 * If the opening and closing are not in the same text node (e.g., because
 * markdown parsing created separate nodes for bold, italic, etc.), the text
 * is left unchanged as literal text.
 *
 * WHAT IT DOES:
 * - Parses ::<token>{...} for any token in ALLOWED_TOKENS
 *   - Numbered highlights: text-highlight-1..8
 *   - Named colors: text-red/orange/yellow/green/blue/purple/pink/gray/black
 *   - Sizes: text-size-xs/small/medium/large/xlarge/xxlarge
 * - ONLY when opening and closing exist in same text node
 * - Emits: <span class="aguy-<token>">content</span>
 * - Recursively processes text after the closing brace for multiple tokens
 *
 * WHAT IT DOESN'T DO:
 * - Does NOT scan across multiple nodes
 * - Does NOT support nested markdown (bold, italic, etc.) inside tokens
 * - If closing brace not in same node, leaves node untouched
 *
 * SCOPE:
 * - Transforms in paragraphs, headings, and list items
 * - Does NOT transform in code blocks, tables, etc.
 *
 * SECURITY:
 * - Only tokens in ALLOWED_TOKENS are transformed
 * - Uses data.hName and data.hProperties (safe remark-rehype directives)
 * - No raw HTML, only CSS classes
 *
 * @example Works (same node)
 * Input:  "This is ::text-green{important} text"
 * Output: <p>This is <span class="aguy-text-green">important</span> text</p>
 *
 * @example Doesn't work (cross-node)
 * Input:  "::text-green{**bold**}" (bold creates separate nodes)
 * Output: <p>::text-green{<strong>bold</strong>}</p> (literal text)
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

/**
 * Transform children nodes to handle highlight syntax within single text nodes.
 *
 * @param children - Array of child nodes to process
 * @returns Transformed array of nodes
 */
function transformChildren(children: Node[]): Node[] {
  const result: Node[] = []

  for (const node of children) {
    // Only process text nodes
    if (node.type !== 'text') {
      result.push(node)
      continue
    }

    const textNode = node as Text
    const text = textNode.value

    // Look for opening marker ::<token>{
    // Generic pattern — the whitelist below decides what actually transforms.
    const markerMatch = text.match(/::([a-z0-9-]+)\{/)

    if (!markerMatch) {
      // No marker found, keep node as-is
      result.push(node)
      continue
    }

    const token = markerMatch[1]
    const markerIndex = markerMatch.index!
    const markerEnd = markerIndex + markerMatch[0].length

    // Only process whitelisted tokens
    if (!isAllowedToken(token)) {
      result.push(node)
      continue
    }

    // Look for FIRST closing brace in the SAME text node
    // We take the first } we find - no brace depth tracking needed
    const textAfterMarker = text.substring(markerEnd)
    const closingIndex = textAfterMarker.indexOf('}')

    if (closingIndex === -1) {
      // No closing brace in same node - leave untouched (no partial edits)
      result.push(node)
      continue
    }

    // Both opening and closing found in same node - transform it!

    // 1. Text before marker (if any)
    if (markerIndex > 0) {
      result.push({
        type: 'text',
        value: text.substring(0, markerIndex),
      } as Text)
    }

    // 2. Content between markers
    const content = textAfterMarker.substring(0, closingIndex)
    const highlightNode: HighlightTextNode = {
      type: 'highlightText',
      children: [
        {
          type: 'text',
          value: content,
        } as Text,
      ],
      data: {
        hName: 'span',
        hProperties: {
          className: [`aguy-${token}`],
        },
      },
    }
    result.push(highlightNode as Node)

    // 3. Text after closing brace (if any)
    const textAfterClosing = textAfterMarker.substring(closingIndex + 1)
    if (textAfterClosing) {
      // Recursively process in case there are more highlights
      const remainingNodes = transformChildren([{ type: 'text', value: textAfterClosing } as Text])
      result.push(...remainingNodes)
    }
  }

  return result
}
