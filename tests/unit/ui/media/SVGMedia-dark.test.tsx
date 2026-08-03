// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

// Return the input unchanged so we can assert on the raw markup.
vi.mock('@/ui/web/exerciserenderer/utils/svgSanitize', () => ({
  sanitizeSvg: (input: string) => input,
}))

import { SVGMedia } from '@/ui/web/media/SVGMedia'
import { __resetInlineSvgCache } from '@/ui/web/media/SVGMedia/fetchInlineSvg'

const RAW_SVG_A =
  '<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100" fill="black"/></svg>'
const RAW_SVG_B =
  '<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="150" cy="100" r="50"/></svg>'

beforeEach(() => {
  __resetInlineSvgCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => (url.includes('b.svg') ? RAW_SVG_B : RAW_SVG_A),
    })),
  )
})

describe('SVGMedia — initial render', () => {
  it('renders the Image fallback on first paint so no-JS and pre-hydration users see the SVG', () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-initial',
          type: 'svg',
          url: '/media/diagram.svg',
          filename: 'diagram.svg',
          mimeType: 'image/svg+xml',
          width: 200,
          height: 100,
        }}
      />,
    )

    // First paint is the Image, not an empty placeholder.
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('/media/diagram.svg')
  })

  it('carries dark:invert on the initial Image so black line-art stays visible in dark mode', () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-dark-initial',
          type: 'svg',
          url: '/media/diagram.svg',
          filename: 'diagram.svg',
          mimeType: 'image/svg+xml',
          width: 200,
          height: 100,
        }}
      />,
    )

    const img = container.querySelector('img')
    expect(img?.className).toMatch(/dark:invert/)
  })

  it('preserves caller-supplied imgClassName on the initial Image', () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-extra-initial',
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

    const img = container.querySelector('img')
    expect(img?.className).toContain('rounded')
    expect(img?.className).toContain('border')
  })
})

describe('SVGMedia — after fetch resolves', () => {
  it('swaps the Image for the inlined SVG once the fetch completes', async () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-swap',
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

    // Image is gone; inline SVG is present.
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).toBeTruthy()
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

  it('applies dark:invert to the inlined SVG wrapper so dark strokes stay visible', async () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-dark-inline',
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

  it('preserves caller-supplied imgClassName on the inlined SVG wrapper', async () => {
    const { container } = render(
      <SVGMedia
        resource={{
          id: 'svg-extra-inline',
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

  it('centers the SVG inside its wrapper regardless of render phase', async () => {
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

    const initialWrapper = container.firstElementChild as HTMLElement
    expect(initialWrapper.className).toContain('flex')
    expect(initialWrapper.className).toContain('items-center')
    expect(initialWrapper.className).toContain('justify-center')

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy()
    })

    const inlineWrapper = container.firstElementChild as HTMLElement
    expect(inlineWrapper.className).toContain('flex')
    expect(inlineWrapper.className).toContain('items-center')
    expect(inlineWrapper.className).toContain('justify-center')
  })
})

describe('SVGMedia — URL change', () => {
  it('does not show the previous SVG when the resource URL swaps', async () => {
    const resourceA = {
      id: 'a',
      type: 'svg' as const,
      url: '/media/a.svg',
      filename: 'a.svg',
      mimeType: 'image/svg+xml',
      width: 200,
      height: 100,
    }
    const resourceB = {
      id: 'b',
      type: 'svg' as const,
      url: '/media/b.svg',
      filename: 'b.svg',
      mimeType: 'image/svg+xml',
      width: 300,
      height: 200,
    }

    const { container, rerender } = render(<SVGMedia resource={resourceA} />)

    await waitFor(() => {
      expect(container.querySelector('svg rect')).toBeTruthy()
    })

    rerender(<SVGMedia resource={resourceB} />)

    // Immediately after the URL swap the stale <rect>-shaped SVG must be
    // gone — either replaced by the Image fallback or by the new resource's
    // markup, but never by leftover markup from the previous URL.
    expect(container.querySelector('svg rect')).toBeNull()

    await waitFor(() => {
      expect(container.querySelector('svg circle')).toBeTruthy()
    })
  })
})
