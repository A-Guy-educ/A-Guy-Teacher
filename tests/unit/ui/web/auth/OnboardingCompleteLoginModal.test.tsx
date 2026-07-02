// @vitest-environment jsdom
/**
 * Unit tests for OnboardingCompleteLoginModal
 *
 * Verifies the post-onboarding Google sign-in popup:
 * - Renders the i18n copy from `auth.onboardingComplete.*` (title, description, reassurance)
 * - Renders the Google button with the custom label and `returnTo` prop wired through
 * - Is non-dismissible (no close button rendered, Radix dismissals blocked)
 * - Renders both Hebrew and English locale copy correctly
 */
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OnboardingCompleteLoginModal } from '@/ui/web/auth/OnboardingCompleteLoginModal'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../../../src/i18n/en.json'
import heMessages from '../../../../../src/i18n/he.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enMessagesAny: any = enMessages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const heMessagesAny: any = heMessages

function renderModal(
  locale: 'en' | 'he',
  messages: any,
  isOpen = true,
  returnTo = '/courses/algebra',
) {
  return render(
    <I18nProvider locale={locale} messages={messages}>
      <OnboardingCompleteLoginModal isOpen={isOpen} returnTo={returnTo} />
    </I18nProvider>,
  )
}

describe('OnboardingCompleteLoginModal', () => {
  beforeEach(() => {
    // jsdom doesn't track real navigation; stub location.href setter
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the English copy when open', () => {
    const { getByText } = renderModal('en', enMessagesAny)

    expect(getByText('Great!')).toBeDefined()
    expect(getByText(/I prepared the system just for you/)).toBeDefined()
    expect(getByText('Quick sign-in with Google')).toBeDefined()
    expect(getByText('No cost, no credit card required.')).toBeDefined()
  })

  it('renders the Hebrew copy when open', () => {
    const { getByText } = renderModal('he', heMessagesAny)

    expect(getByText('נהדר!')).toBeDefined()
    expect(getByText('כניסה מהירה עם Google')).toBeDefined()
    expect(getByText('ההרשמה לא כרוכה בעלות או בהזנת אשראי.')).toBeDefined()
  })

  it('navigates to /api/oauth/google with returnTo when the Google button is clicked', () => {
    const { getByText } = renderModal('en', enMessagesAny, true, '/courses/geometry')

    const button = getByText('Quick sign-in with Google').closest('button')
    expect(button).toBeDefined()
    fireEvent.click(button!)

    expect(window.location.href).toBe('/api/oauth/google?returnTo=%2Fcourses%2Fgeometry')
  })

  it('does not render any visible content when closed', () => {
    const { queryByText } = renderModal('en', enMessagesAny, false)

    // Radix portals the open dialog; when `open={false}` the title is not in the DOM
    expect(queryByText('Great!')).toBeNull()
  })

  it('hides the dialog close button (allowDismiss=false)', () => {
    const { container } = renderModal('en', enMessagesAny)

    // Radix Close renders a <button> with sr-only "Close" text when allowDismiss is true
    expect(container.querySelector('[aria-label="Close"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Close"]')).toBeNull()
  })
})
