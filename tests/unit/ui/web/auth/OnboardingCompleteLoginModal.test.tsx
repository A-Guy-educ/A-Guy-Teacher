// @vitest-environment jsdom
/**
 * Unit tests for OnboardingCompleteLoginModal
 *
 * Verifies the post-onboarding Google sign-in popup:
 * - Renders the i18n copy from `auth.onboardingComplete.*` (title with emoji,
 *   descriptionBold, descriptionRest, primaryCta). The reassurance line was
 *   removed in #778.
 * - Renders the description as two stacked lines: first line bold, second line
 *   regular weight.
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
    const { getByText, queryByText } = renderModal('en', enMessagesAny)

    expect(getByText('Great! 🎉')).toBeDefined()
    expect(getByText("I've prepared your personalized learning system.")).toBeDefined()
    expect(getByText("Just a quick sign-in and we're on our way together")).toBeDefined()
    expect(getByText('Quick sign-in with Google')).toBeDefined()
    // Reassurance line was removed in #778 — must not be in the DOM.
    expect(queryByText('No cost, no credit card required.')).toBeNull()
  })

  it('renders the Hebrew copy when open', () => {
    const { getByText, queryByText } = renderModal('he', heMessagesAny)

    expect(getByText('נהדר! 🎉')).toBeDefined()
    expect(getByText('הכנתי עבורך את מערכת הלמידה המותאמת אישית.')).toBeDefined()
    expect(getByText('רק חיבור מהיר ויוצאים לדרך המשותפת')).toBeDefined()
    expect(getByText('כניסה מהירה עם Google')).toBeDefined()
    // Reassurance line was removed in #778 — must not be in the DOM.
    expect(queryByText('ההרשמה לא כרוכה בעלות או בהזנת אשראי.')).toBeNull()
  })

  it('renders the description first line in bold and second line in regular weight (English)', () => {
    const { getByText } = renderModal('en', enMessagesAny)

    const bold = getByText("I've prepared your personalized learning system.")
    const rest = getByText("Just a quick sign-in and we're on our way together")

    expect((bold as HTMLElement).className).toContain('font-bold')
    expect((rest as HTMLElement).className).toContain('font-normal')
  })

  it('renders the description first line in bold and second line in regular weight (Hebrew)', () => {
    const { getByText } = renderModal('he', heMessagesAny)

    const bold = getByText('הכנתי עבורך את מערכת הלמידה המותאמת אישית.')
    const rest = getByText('רק חיבור מהיר ויוצאים לדרך המשותפת')

    expect((bold as HTMLElement).className).toContain('font-bold')
    expect((rest as HTMLElement).className).toContain('font-normal')
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
    expect(queryByText('Great! 🎉')).toBeNull()
  })

  it('hides the dialog close button (allowDismiss=false)', () => {
    const { container } = renderModal('en', enMessagesAny)

    // Radix Close renders a <button> with sr-only "Close" text when allowDismiss is true
    expect(container.querySelector('[aria-label="Close"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Close"]')).toBeNull()
  })
})
