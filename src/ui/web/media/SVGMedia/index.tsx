'use client'

import { cn } from '@/infra/utils/ui'
import React, { useEffect, useState } from 'react'
import Image from 'next/image'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import { sanitizeSvg } from '@/ui/web/exerciserenderer/utils/svgSanitize'
import { ensureSvgViewBox } from './ensureSvgViewBox'

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
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    if (!svgUrl) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(svgUrl)
        if (!res.ok) {
          if (!cancelled) setFetchFailed(true)
          return
        }
        const raw = await res.text()
        const normalized = ensureSvgViewBox(raw)
        const sanitized = sanitizeSvg(normalized)
        if (!cancelled) setInlineMarkup(sanitized)
      } catch {
        if (!cancelled) setFetchFailed(true)
      }
    })()
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

  if (fetchFailed) {
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

  return (
    <div
      className={cn('svg-media flex items-center justify-center', className)}
      aria-label={altText}
      role="img"
      style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
    />
  )
}
