'use client'

import React from 'react'
import type { GeometrySpecV1, AxisSpecV1 } from '@/infra/contracts'
import { cn } from '@/infra/utils/ui'
import { AxisRenderer, type DisplaySize } from '@/ui/web/exerciserenderer/blocks/AxisRenderer'
import { GeometryRenderer } from '@/ui/web/exerciserenderer/blocks/GeometryRenderer'
import { AdminHtmlWithMath } from '@/ui/web/shared/AdminHtmlWithMath'

import { LexicalToReact } from './lexicalToReact'

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

function TableBlock({
  headers,
  rows,
  showHeader,
  showBorders,
}: {
  headers: string[]
  rows: string[][]
  showHeader: boolean
  showBorders: boolean
}) {
  if (headers.length === 0 && rows.length === 0) return null
  const cellBorder = showBorders ? 'border border-border' : ''
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-body-sm', showBorders && 'border border-border')}>
        {showHeader && headers.length > 0 ? (
          <thead>
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} className={cn('px-3 py-2 text-start font-semibold', cellBorder)}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={cn('px-3 py-2 align-top', cellBorder)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    case 'tableBlock': {
      const headers = parseJson<string[]>(block.headers, [])
      const rows = parseJson<string[][]>(block.rows, [])
      return (
        <TableBlock
          key={key}
          headers={headers}
          rows={rows}
          showHeader={block.showHeader !== false}
          showBorders={block.showBorders !== false}
        />
      )
    }
    case 'geometryBlock': {
      const spec = parseJson<GeometrySpecV1 | null>(block.spec, null)
      if (!spec) return null
      return <GeometryRenderer key={key} blockId={key} spec={spec} />
    }
    case 'graphBlock': {
      const spec = parseJson<AxisSpecV1 | null>(block.spec, null)
      if (!spec) return null
      const displaySize = (block.displaySize as DisplaySize | undefined) ?? 'medium'
      return <AxisRenderer key={key} blockId={key} spec={spec} displaySize={displaySize} />
    }
    case 'content': {
      const columns = Array.isArray(block.columns) ? (block.columns as never) : []
      return <ContentColumns key={key} columns={columns} />
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

export function ContentPageBodyRenderer({ blocks }: { blocks: BodyBlock[] }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null
  return (
    <div className="break-words [overflow-wrap:anywhere]">
      {blocks.map((block, idx) => {
        const id = (typeof block.id === 'string' ? block.id : null) ?? `body-${idx}`
        const spacing = SPACING_CLASS[(block.spacingAfter as string) ?? 'inherit'] ?? 'mb-4'
        const rendered = renderBlock(block, id)
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
