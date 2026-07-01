// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Replace next/image with a plain <img> so we can inspect className in jsdom.
vi.mock('next/image', () => ({
  default: (props: {
    src: string
    alt?: string
    className?: string
    width?: number
    height?: number
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return (
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

import { SVGMedia } from '@/ui/web/media/SVGMedia'

describe('SVGMedia (issue #651)', () => {
  it('centers the SVG inside its wrapper (flex containerization)', () => {
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

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toContain('flex')
    expect(wrapper.className).toContain('items-center')
    expect(wrapper.className).toContain('justify-center')
  })

  it('applies dark:invert to the inner img so black line-art is visible on dark backgrounds', () => {
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

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.className).toMatch(/dark:invert/)
  })

  it('preserves caller-supplied imgClassName alongside dark:invert', () => {
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

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.className).toContain('rounded')
    expect(img?.className).toContain('border')
    expect(img?.className).toMatch(/dark:invert/)
  })
})
