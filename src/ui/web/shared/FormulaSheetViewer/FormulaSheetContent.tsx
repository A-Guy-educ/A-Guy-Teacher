/**
 * FormulaSheetContent
 *
 * @fileType component
 * @domain formula-sheets
 * @pattern content-renderer
 * @ai-summary Client-side renderer for formula sheet content (PDF or HTML blocks)
 */

'use client'

import Image from 'next/image'
import type { FormulaSheet } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { AdminHtmlWithMath } from '@/ui/web/shared/AdminHtmlWithMath'
import { PDFEmbed } from '../../courses/PDFViewer/PDFEmbed'

export interface FormulaSheetContentProps {
  /** The formula sheet to render */
  sheet: FormulaSheet
}

interface FormulaSheetMedia {
  url?: string
  mimeType?: string
  alt?: string
  width?: number
  height?: number
  filename?: string
}

function isFormulaSheetMedia(value: unknown): value is FormulaSheetMedia {
  return value !== null && typeof value === 'object' && 'url' in value
}

function blockKey(block: Record<string, unknown>, index: number) {
  return typeof block.id === 'string' || typeof block.id === 'number' ? block.id : index
}

/**
 * Render the content of a formula sheet based on its content type.
 *
 * This is a CLIENT component that avoids importing RenderBlocks or RichText
 * (which transitively pull in payload.config.ts → Node.js binary modules).
 * Instead, it renders trusted admin HTML blocks directly.
 */
export function FormulaSheetContent({ sheet }: FormulaSheetContentProps) {
  const { contentType, pdfFile, bodyBlocks } = sheet
  const t = useTranslations('courses')

  switch (contentType) {
    case 'pdf':
      if (!pdfFile || typeof pdfFile === 'string') {
        return <p className="text-muted-foreground">{t('formulaSheetEmpty')}</p>
      }
      return (
        <PDFEmbed pdfUrl={pdfFile.url || `/media/${pdfFile.filename}`} title={sheet.title || ''} />
      )

    case 'richText':
    case 'blocks':
    default: {
      // For blocks, extract HTML content and render directly
      if (!bodyBlocks || !Array.isArray(bodyBlocks) || bodyBlocks.length === 0) {
        return <p className="text-muted-foreground">{t('formulaSheetEmpty')}</p>
      }

      return (
        <div className="formula-sheet-blocks space-y-4">
          {bodyBlocks.map((block, index) => {
            if (block.blockType === 'html' && typeof block.html === 'string') {
              return (
                <AdminHtmlWithMath
                  key={blockKey(block, index)}
                  html={block.html}
                  className="rich-text-content"
                />
              )
            }
            if (block.blockType === 'mediaBlock' && 'media' in block) {
              const media = isFormulaSheetMedia(block.media) ? block.media : null
              if (media?.url) {
                return (
                  <div key={blockKey(block, index)} className="rounded-lg overflow-hidden">
                    {media.mimeType?.startsWith('image/') ? (
                      <Image
                        src={media.url}
                        alt={media.alt || ''}
                        width={media.width || 800}
                        height={media.height || 600}
                        className="w-full h-auto"
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    ) : (
                      <a href={media.url} className="text-primary underline">
                        {media.filename || 'Download'}
                      </a>
                    )}
                  </div>
                )
              }
            }
            // For content blocks, try to extract rich text
            if (block.blockType === 'content' && 'columns' in block) {
              return (
                <div key={blockKey(block, index)} className="prose dark:prose-invert max-w-none">
                  {/* Content blocks have complex structure - skip for now */}
                </div>
              )
            }
            return null
          })}
        </div>
      )
    }
  }
}
