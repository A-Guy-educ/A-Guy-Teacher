'use client'

interface RichContentBubbleProps {
  html: string
}

/**
 * Renders authored HTML (from the lesson JSON). Content is not user-supplied —
 * it comes from the scripted lesson file we control — so raw HTML injection is
 * safe here. If lessons ever move to a CMS with author-editable HTML, wrap this
 * in DOMPurify at the boundary.
 */
export function RichContentBubble({ html }: RichContentBubbleProps) {
  return (
    <div
      className="text-body-md text-foreground leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
