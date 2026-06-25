'use client'

import React from 'react'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'

interface LexicalNode {
  type: string
  children?: LexicalNode[]
  text?: string
  format?: number
  tag?: string
  listType?: string
  fields?: { url?: string }
  url?: string
  latex?: string
}

const FMT_BOLD = 1
const FMT_ITALIC = 2
const FMT_STRIKETHROUGH = 4
const FMT_UNDERLINE = 8
const FMT_CODE = 16

function applyTextFormats(text: string, format = 0): React.ReactNode {
  let node: React.ReactNode = text
  if (format & FMT_CODE) node = <code>{node}</code>
  if (format & FMT_STRIKETHROUGH) node = <s>{node}</s>
  if (format & FMT_UNDERLINE) node = <u>{node}</u>
  if (format & FMT_ITALIC) node = <em>{node}</em>
  if (format & FMT_BOLD) node = <strong>{node}</strong>
  return node
}

function renderChildren(children: LexicalNode[] | undefined): React.ReactNode {
  if (!Array.isArray(children)) return null
  return children.map((child, i) => <React.Fragment key={i}>{renderNode(child)}</React.Fragment>)
}

function renderNode(node: LexicalNode | undefined): React.ReactNode {
  if (!node) return null

  switch (node.type) {
    case 'text':
      return applyTextFormats(node.text ?? '', node.format ?? 0)

    case 'paragraph':
      return <p>{renderChildren(node.children)}</p>

    case 'heading': {
      const tag = (node.tag ?? 'h2') as keyof React.JSX.IntrinsicElements
      return React.createElement(tag, null, renderChildren(node.children))
    }

    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      return <Tag>{renderChildren(node.children)}</Tag>
    }

    case 'listitem':
      return <li>{renderChildren(node.children)}</li>

    case 'quote':
      return <blockquote>{renderChildren(node.children)}</blockquote>

    case 'link': {
      const href = node.fields?.url ?? node.url ?? '#'
      return <a href={href}>{renderChildren(node.children)}</a>
    }

    case 'linebreak':
      return <br />

    case 'math': {
      const latex = node.latex ?? node.text ?? ''
      if (!latex) return null
      return <MathMarkdown content={latex} className="rich-text-content" />
    }

    case 'root':
      return <>{renderChildren(node.children)}</>

    default:
      if (Array.isArray(node.children)) {
        return <>{renderChildren(node.children)}</>
      }
      return null
  }
}

export function LexicalToReact({ root }: { root: LexicalNode | undefined }) {
  return <>{renderNode(root)}</>
}
