/**
 * RenderLayout
 *
 * Renders the layout blocks from a CMS page (e.g., legal pages).
 * Handles common block types: html, content (columns), rich_text.
 */

'use client'

import React from 'react'

import { LexicalToReact } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ContentPageBodyRenderer/lexicalToReact'
import { cn } from '@/infra/utils/ui'
import { AdminHtmlWithMath } from '@/ui/web/shared/AdminHtmlWithMath'

type BodyBlock = Record<string, unknown> & { id?: string; blockType?: string }

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function HtmlBlock({ html }: { html: string }) {
  return (
    <AdminHtmlWithMath
      html={html}
      className="prose dark:prose-invert max-w-none rich-text-content"
    />
  )
}

function ContentColumns({
  columns,
}: {
  columns: Array<{ id?: string; size?: string; richText?: { root?: unknown } }>
}) {
  if (columns.length === 0) return null
  return (
    <div className="grid gap-content-gap-md md:grid-cols-3">
      {columns.map((col, idx) => (
        <div
          key={col.id ?? idx}
          className={cn(
            'prose dark:prose-invert max-w-none',
            col.size === 'oneThird' && 'md:col-span-1',
            col.size === 'twoThirds' && 'md:col-span-2',
            col.size === 'full' && 'md:col-span-3',
          )}
        >
          <LexicalToReact root={col.richText?.root as never} />
        </div>
      ))}
    </div>
  )
}

function renderBlock(block: BodyBlock, key: string): React.ReactNode {
  switch (block.blockType) {
    case 'html': {
      const html = typeof block.html === 'string' ? block.html : ''
      if (!html) return null
      return <HtmlBlock key={key} html={html} />
    }
    case 'content': {
      const columns = Array.isArray(block.columns) ? (block.columns as never) : []
      return <ContentColumns key={key} columns={columns} />
    }
    case 'rich_text': {
      const richText = block as { value?: unknown; format?: string }
      if (!richText.value) return null
      // Handle lexical rich text format
      const root = parseJson<{ root?: unknown }>(richText.value, { root: undefined }).root
      if (!root) return null
      return (
        <div className="prose dark:prose-invert max-w-none">
          <LexicalToReact root={root as never} />
        </div>
      )
    }
    default:
      return null
  }
}

const SPACING_CLASS: Record<string, string> = {
  none: '',
  small: 'mb-3',
  inherit: 'mb-4',
  medium: 'mb-6',
  large: 'mb-10',
}

export function RenderLayout({ blocks }: { blocks: unknown[] }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null

  return (
    <div className="break-words [overflow-wrap:anywhere]">
      {blocks.map((block, idx) => {
        const typedBlock = block as BodyBlock
        const id = (typeof typedBlock.id === 'string' ? typedBlock.id : null) ?? `block-${idx}`
        const spacing = SPACING_CLASS[(typedBlock.spacingAfter as string) ?? 'inherit'] ?? 'mb-4'
        const rendered = renderBlock(typedBlock, id)
        if (!rendered) return null
        return (
          <div key={id} className={spacing}>
            {rendered}
          </div>
        )
      })}
    </div>
  )
}
