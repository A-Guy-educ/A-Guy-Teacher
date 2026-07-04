// @vitest-environment jsdom
/**
 * Unit tests for OnboardingCompleteLoginModal
 *
 * Verifies the post-onboarding Google sign-in popup:
 * - Renders the i18n copy from `auth.onboardingComplete.*` (title, description, reassurance)
 * - Renders the Google button as a native anchor whose `href` points at
 *   `/api/oauth/google?returnTo=...` so iOS Safari's WebKit engine can navigate
 *   even when the button is rendered inside a non-dismissible Radix Dialog portal.
 *   This lock-in prevents a regression to JS `onClick` + `window.location.href`,
 *   which iOS Safari intermittently drops when paired with React state updates
 *   inside modal layers.
 * - Is non-dismissible (no close button rendered, Radix dismissals blocked)
 * - Renders both Hebrew and English locale copy correctly
 */
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it('renders the Google control as a native anchor with the OAuth href (iOS Safari contract)', () => {
    const { getByText } = renderModal('en', enMessagesAny, true, '/courses/geometry')

    const anchor = getByText('Quick sign-in with Google').closest('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.tagName).toBe('A')
    expect(anchor?.getAttribute('href')).toBe('/api/oauth/google?returnTo=%2Fcourses%2Fgeometry')
  })

  it('does not render the Google control as a <button> (prevents iOS WebKit regression)', () => {
    const { queryByText } = renderModal('en', enMessagesAny)

    // The original implementation used <button onClick> + window.location.href,
    // which iOS Safari dropped inside Radix Dialog portals. The anchor below is
    // the only supported rendering — a regression here means navigation is back
    // to JS-only and the iOS bug will return.
    const button = queryByText('Quick sign-in with Google')?.closest('button')
    expect(button).toBeNull()
  })

  it('URL-encodes the returnTo path segment in the anchor href', () => {
    const { getByText } = renderModal('en', enMessagesAny, true, '/courses/algebra/quadratic')

    const anchor = getByText('Quick sign-in with Google').closest('a')
    expect(anchor?.getAttribute('href')).toBe(
      '/api/oauth/google?returnTo=%2Fcourses%2Falgebra%2Fquadratic',
    )
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
