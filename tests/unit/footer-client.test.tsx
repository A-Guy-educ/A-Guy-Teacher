// @vitest-environment jsdom
/**
 * @fileType test
 * @domain frontend
 * @pattern footer-modal
 * @ai-summary Unit tests for the FooterClient modal behaviour: opening,
 *   closing, and swapping between page references; the visibility of CMS
 *   meta/text fields; and the contrast with non-reference links that should
 *   continue to render as plain anchor tags.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FooterClient } from '@/ui/web/footer/FooterClient'
import type { FooterData } from '@/ui/web/footer/footer-data'

// Radix Dialog uses ResizeObserver/IntersectionObserver/hasPointerCapture in some paths.
// Stub them so jsdom does not blow up.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub

afterEach(() => {
  vi.restoreAllMocks()
})

const baseData: FooterData = {
  meta: {
    titleColumn: 'Aguy Learning Platform',
    subtitleColumn: 'Subtitle text',
    introColumn: 'Intro text',
    contact: { email: 'support@aguy.co.il', phone: '+972-50-0000000' },
  },
  text: 'A footer description paragraph',
  navItems: [
    {
      id: 'nav-page',
      link: {
        type: 'reference',
        reference: { relationTo: 'pages', value: 'page-1' },
        label: 'Terms',
      },
    },
    {
      id: 'nav-page-2',
      link: {
        type: 'reference',
        reference: { relationTo: 'pages', value: 'page-2' },
        label: 'Privacy',
      },
    },
    {
      id: 'nav-custom',
      link: { type: 'custom', url: '/about', label: 'About' },
    },
  ],
  legalPages: {
    'page-1': {
      id: 'page-1',
      slug: 'terms-of-service',
      title: 'Terms of Service',
      layout: [{ id: 'b1', blockType: 'html', html: '<p>Terms body</p>' }],
    },
    'page-2': {
      id: 'page-2',
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      layout: [{ id: 'b2', blockType: 'html', html: '<p>Privacy body</p>' }],
    },
  },
}

describe('FooterClient', () => {
  it('renders every meta field that has a value', () => {
    render(<FooterClient data={baseData} version="1.2.3" showExtras={false} />)

    expect(screen.getByText('Aguy Learning Platform')).toBeTruthy()
    expect(screen.getByText('Subtitle text')).toBeTruthy()
    expect(screen.getByText('Intro text')).toBeTruthy()
    expect(screen.getByText('support@aguy.co.il')).toBeTruthy()
    expect(screen.getByText('+972-50-0000000')).toBeTruthy()
    expect(screen.getByText('A footer description paragraph')).toBeTruthy()
  })

  it('renders the version when showExtras is true', () => {
    render(<FooterClient data={baseData} version="1.2.3" />)
    expect(screen.getByText('v1.2.3')).toBeTruthy()
  })

  it('opens the modal when a page-reference link is clicked', () => {
    render(<FooterClient data={baseData} version="1.2.3" showExtras={false} />)

    fireEvent.click(screen.getByTestId('footer-nav-0'))

    expect(screen.getByText('Terms of Service')).toBeTruthy()
    expect(screen.getByText('Terms body')).toBeTruthy()
  })

  it('closes the modal when the same page-reference link is clicked again', () => {
    render(<FooterClient data={baseData} version="1.2.3" showExtras={false} />)

    const button = screen.getByTestId('footer-nav-0')
    fireEvent.click(button)
    expect(screen.getByText('Terms of Service')).toBeTruthy()

    fireEvent.click(button)
    expect(screen.queryByText('Terms of Service')).toBeNull()
  })

  it('swaps the modal content (instead of stacking) when a different page link is clicked', () => {
    render(<FooterClient data={baseData} version="1.2.3" showExtras={false} />)

    fireEvent.click(screen.getByTestId('footer-nav-0'))
    expect(screen.getByText('Terms of Service')).toBeTruthy()

    fireEvent.click(screen.getByTestId('footer-nav-1'))
    expect(screen.getByText('Privacy Policy')).toBeTruthy()
    expect(screen.queryByText('Terms of Service')).toBeNull()
  })

  it('closes the modal when the body of the modal is clicked', () => {
    render(<FooterClient data={baseData} version="1.2.3" showExtras={false} />)

    fireEvent.click(screen.getByTestId('footer-nav-0'))
    expect(screen.getByText('Terms of Service')).toBeTruthy()

    // Clicking the title text (an inner element of the body) closes the modal.
    fireEvent.click(screen.getByText('Terms of Service'))
    expect(screen.queryByText('Terms of Service')).toBeNull()
  })

  it('renders non-reference links as anchors (no modal), without showing the page label as a button', () => {
    render(<FooterClient data={baseData} version="1.2.3" showExtras={false} />)

    const aboutLink = screen.getByText('About')
    expect(aboutLink.tagName).toBe('A')
    expect(aboutLink.getAttribute('href')).toBe('/about')
  })

  it('skips the version/separator block when showExtras is false', () => {
    render(<FooterClient data={baseData} version="1.2.3" showExtras={false} />)
    expect(screen.queryByText('v1.2.3')).toBeNull()
  })
})
