// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Replace next/image with a plain <img> so we can inspect className in jsdom.
vi.mock('next/image', () => ({
  default: (props: {
    src: string
    alt?: string
    className?: string
    width?: number
    height?: number
  }) => {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={props.src}
        alt={props.alt ?? ''}
        className={props.className}
        width={props.width}
        height={props.height}
      />
    )
  },
}))

vi.mock('@/infra/utils/ui', () => ({
  cn: (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/infra/utils/getMediaUrl', () => ({
  getMediaUrl: (url: string) => url,
}))

// The component sanitizes fetched SVG via DOMPurify. In this test we
// return the input unchanged so we can assert on the raw markup.
vi.mock('@/ui/web/exerciserenderer/utils/svgSanitize', () => ({
  sanitizeSvg: (input: string) => input,
}))

import { SVGMedia } from '@/ui/web/media/SVGMedia'

const RAW_SVG =
  '<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100" fill="black"/></svg>'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => RAW_SVG })),
  )
})

describe('SVGMedia (issue #651)', () => {
  it('centers the SVG inside its wrapper (flex containerization)', async () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-center',
          type: 'svg',
          url: '/media/diagram.svg',
          filename: 'diagram.svg',
          mimeType: 'image/svg+xml',
          width: 200,
          height: 100,
        }}
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy()
    })

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toContain('flex')
    expect(wrapper.className).toContain('items-center')
    expect(wrapper.className).toContain('justify-center')
  })

  it('applies dark:invert to the inline SVG so black line-art is visible on dark backgrounds', async () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-dark',
          type: 'svg',
          url: '/media/diagram.svg',
          filename: 'diagram.svg',
          mimeType: 'image/svg+xml',
          width: 200,
          height: 100,
        }}
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy()
    })

    const inlineWrapper = container.querySelector('svg')?.parentElement as HTMLElement
    expect(inlineWrapper.className).toMatch(/dark:invert/)
  })

  it('preserves caller-supplied imgClassName alongside dark:invert', async () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-extra',
          type: 'svg',
          url: '/media/diagram.svg',
          filename: 'diagram.svg',
          mimeType: 'image/svg+xml',
          width: 200,
          height: 100,
        }}
        imgClassName="rounded border"
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy()
    })

    const inlineWrapper = container.querySelector('svg')?.parentElement as HTMLElement
    expect(inlineWrapper.className).toContain('rounded')
    expect(inlineWrapper.className).toContain('border')
    expect(inlineWrapper.className).toMatch(/dark:invert/)
  })

  it('injects a viewBox into fetched SVGs that lack one, so they scale correctly at any size', async () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-viewbox',
          type: 'svg',
          url: '/media/diagram.svg',
          filename: 'diagram.svg',
          mimeType: 'image/svg+xml',
          width: 200,
          height: 100,
        }}
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy()
    })

    const svg = container.querySelector('svg') as SVGElement
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 100')
  })
})
