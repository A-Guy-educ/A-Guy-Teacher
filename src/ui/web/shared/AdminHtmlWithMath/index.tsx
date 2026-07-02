'use client'

import { useMemo } from 'react'
import { renderAdminHtmlWithMath } from '@/infra/utils/renderAdminHtmlWithMath'

export interface AdminHtmlWithMathProps {
  html: string
  className?: string
}

/**
 * Renders trusted admin-authored HTML and converts math delimiters to KaTeX.
 */
export function AdminHtmlWithMath({ html, className }: AdminHtmlWithMathProps) {
  const rendered = useMemo(() => renderAdminHtmlWithMath(html), [html])

  if (!rendered) return null

  return <div className={className} dangerouslySetInnerHTML={{ __html: rendered }} />
}
