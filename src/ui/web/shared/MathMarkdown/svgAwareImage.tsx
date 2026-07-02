/**
 * @fileType component
 * @domain ui
 * @pattern markdown-image-override
 * @ai-summary Markdown `img` override that inverts dark-line SVGs in dark mode while keeping responsive sizing.
 */

import { cn } from '@/infra/utils/ui'
import { darkInvertIfSvg, isSvgUrl } from './isSvgMedia'

/** Props react-markdown passes to the `img` override. */
export interface SvgAwareImageProps {
  src?: string | Blob
  alt?: string
  title?: string
}

/**
 * Markdown `<img>` override that adds `dark:invert` when the source URL
 * points to an SVG asset. Centralised here so ChatMessageContent and
 * RichTextRenderer cannot drift apart in how they handle SVG diagrams.
 */
export function SvgAwareImage({ src, alt, title }: SvgAwareImageProps) {
  // react-markdown types `src` as `string | Blob`, but inline images always
  // arrive as a string in practice. Skip non-string srcs defensively rather
  // than guess at a fallback URL.
  if (typeof src !== 'string') return null
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt ?? ''}
      title={title}
      loading="lazy"
      className={cn(
        'h-auto max-h-96 max-w-full w-auto object-contain',
        darkInvertIfSvg(isSvgUrl(src)),
      )}
    />
  )
}
