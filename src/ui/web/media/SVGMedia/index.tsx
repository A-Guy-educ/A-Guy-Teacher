'use client'

import { cn } from '@/infra/utils/ui'
import React, { useEffect, useState } from 'react'
import Image from 'next/image'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import { fetchInlineSvg } from './fetchInlineSvg'

export const SVGMedia: React.FC<MediaProps> = (props) => {
  const { resource, className, imgClassName, alt } = props

  const resourceObj = resource && typeof resource === 'object' ? resource : null
  const filename = resourceObj?.filename
  const url = resourceObj?.url
  const altFromResource = resourceObj?.alt
  const width = resourceObj?.width
  const height = resourceObj?.height

  const svgUrl = url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null

  const [inlineMarkup, setInlineMarkup] = useState<string | null>(null)

  useEffect(() => {
    // Reset immediately so a URL swap cannot leak the previous SVG's markup
    // into the new URL's render pass. Without this, the `inlineMarkup` branch
    // below would keep showing the old image (or worse, show it as belonging
    // to the new resource) until the new fetch resolves.
    setInlineMarkup(null)

    if (!svgUrl) return
    let cancelled = false

    fetchInlineSvg(svgUrl)
      .then((html) => {
        if (!cancelled) setInlineMarkup(html)
      })
      .catch(() => {
        // On failure the Image fallback below stays visible — no permanent
        // blank hole. See fetchInlineSvg for why failures are not cached.
      })

    return () => {
      cancelled = true
    }
  }, [svgUrl])

  if (!resourceObj || !svgUrl) return null

  const altText = alt || altFromResource || 'SVG image'

  if (inlineMarkup) {
    return (
      <div
        className={cn('svg-media flex items-center justify-center', className)}
        role="img"
        aria-label={altText}
      >
        <div
          className={cn(
            'max-w-full h-auto dark:invert [&>svg]:max-w-full [&>svg]:h-auto',
            imgClassName,
          )}
          dangerouslySetInnerHTML={{ __html: inlineMarkup }}
        />
      </div>
    )
  }

  // Initial render (SSR + first client paint before the fetch resolves) shows
  // the raw Image so browsers can preload it in parallel with the JS bundle
  // and no-JS clients still see the SVG. It is also the permanent fallback if
  // the fetch fails — the viewBox mis-scaling this component fixes affects
  // rendered dimensions, not whether anything renders at all.
  return (
    <div className={cn('svg-media flex items-center justify-center', className)}>
      <Image
        src={svgUrl}
        alt={altText}
        width={width || 800}
        height={height || 600}
        className={cn('max-w-full h-auto dark:invert', imgClassName)}
        unoptimized
      />
    </div>
  )
}
