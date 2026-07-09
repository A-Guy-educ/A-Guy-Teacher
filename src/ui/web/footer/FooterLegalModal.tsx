/**
 * @fileType component
 * @domain frontend
 * @pattern legal-modal
 * @ai-summary Renders the content of a CMS legal page inside a Dialog. The page
 * content is provided pre-loaded by the server, so opening the modal does not
 * trigger a network request. Clicking the body of the modal closes it.
 */
'use client'

import { useCallback } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/web/components/dialog'
import { RenderLayout } from '@/ui/web/layout-blocks/RenderLayout'

import type { FooterLegalPage } from './footer-data'

interface FooterLegalModalProps {
  page: FooterLegalPage | null
  isOpen: boolean
  onClose: () => void
}

export function FooterLegalModal({ page, isOpen, onClose }: FooterLegalModalProps) {
  const handleContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('a, button')) return
      onClose()
    },
    [onClose],
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        className="sm:max-w-2xl max-h-[80vh] overflow-y-auto"
        onPointerDownOutside={onClose}
        onEscapeKeyDown={onClose}
      >
        {page ? (
          <div onClick={handleContentClick} className="cursor-pointer select-text">
            <DialogHeader>
              <DialogTitle>{page.title}</DialogTitle>
            </DialogHeader>
            {page.layout.length > 0 ? (
              <div className="mt-4">
                <RenderLayout blocks={page.layout} />
              </div>
            ) : (
              <p className="mt-4 text-body-sm text-muted-foreground">{page.title}</p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
