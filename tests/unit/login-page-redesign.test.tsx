// @vitest-environment jsdom

import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LoginPageContent } from '@/app/(frontend)/login/LoginPageContent'
import { LoginForm } from '@/app/(frontend)/login/LoginForm'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { PasswordLoginProvider } from '@/ui/web/providers/PasswordLoginProvider'
import enMessages from '../../src/i18n/en.json'
import heMessages from '../../src/i18n/he.json'
import { getBrand } from '@/brands'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergedEnMessages: any = { ...enMessages, ...getBrand().messages.en }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergedHeMessages: any = { ...heMessages, ...getBrand().messages.he }

afterEach(() => {
  cleanup()
})

const renderWithI18n = (locale = 'en', children: React.ReactNode) => {
  const messages = locale === 'he' ? mergedHeMessages : mergedEnMessages
  return render(
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>,
  )
}

describe('Login Page Redesign - i18n translations', () => {
  it('Hebrew translations contain all new login keys', () => {
    const login = mergedHeMessages.auth.login as unknown as Record<string, string>
    expect(login.headingBold).toBe('שלום,')
    expect(login.headingRest).toBe('מוכנים להצליח?')
    expect(login.quickLogin).toBe('כניסה מהירה')
    expect(login.loginFreeOfCharge).toBe('הכניסה למערכת - ללא תשלום')
    expect(login.secureAccess).toBe('גישה מהירה ומאובטחת.')
    expect(login.oneClickEntry).toBe('בלחיצה אחת אתם בפנים.')
    expect(login.needHelp).toBe('זקוקים לעזרה?')
  })

  it('English translations contain all new login keys', () => {
    const login = mergedEnMessages.auth.login as unknown as Record<string, string>
    expect(login.headingBold).toBe('Hello,')
    expect(login.headingRest).toBe('Ready to Succeed?')
    expect(login.quickLogin).toBe('Quick Login')
    expect(login.loginFreeOfCharge).toBe('Login to the system — free of charge')
    expect(login.secureAccess).toBe('Fast and secure access.')
    expect(login.oneClickEntry).toBe("One click and you're in.")
    expect(login.needHelp).toBe('Need help?')
  })

  it('brand.heroSubtitle is present in merged English messages', () => {
    const brand = mergedEnMessages.brand as Record<string, string>
    expect(brand.heroSubtitle).toBe('A-Guy Your Personal Tutor')
  })

  it('brand.heroSubtitle is present in merged Hebrew messages', () => {
    const brand = mergedHeMessages.brand as Record<string, string>
    expect(brand.heroSubtitle).toBe('A-Guy המורה הפרטי שלכם')
  })
})

describe('LoginPageContent', () => {
  it('renders hero heading as gradient text in Hebrew', () => {
    renderWithI18n('he', <LoginPageContent />)

    expect(screen.getByText('מוכנים להצליח?')).toBeTruthy()
  })

  it('renders hero heading as gradient text in English', () => {
    renderWithI18n('en', <LoginPageContent />)

    expect(screen.getByText('Ready to Succeed?')).toBeTruthy()
  })

  it('renders help link "זקוקים לעזרה?"', () => {
    renderWithI18n('he', <LoginPageContent />)

    expect(screen.getByText('זקוקים לעזרה?')).toBeTruthy()
  })

  it('renders help link in English', () => {
    renderWithI18n('en', <LoginPageContent />)

    expect(screen.getByText('Need help?')).toBeTruthy()
  })

  it('heading is a semantic h1 element', () => {
    renderWithI18n('en', <LoginPageContent />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeTruthy()
  })
})

describe('LoginForm - brand.heroSubtitle rendering', () => {
  const renderWithPasswordDisabled = (children: React.ReactNode) => {
    return render(
      <I18nProvider locale="he" messages={mergedHeMessages}>
        <PasswordLoginProvider enabled={false}>{children}</PasswordLoginProvider>
      </I18nProvider>,
    )
  }

  it('renders brand.heroSubtitle text in Hebrew (not the translation key)', () => {
    renderWithPasswordDisabled(<LoginForm />)

    // Should render the Hebrew translation, NOT the key "auth.login.brand.heroSubtitle"
    expect(screen.getByText('A-Guy המורה הפרטי שלכם')).toBeTruthy()
  })

  it('renders brand.heroSubtitle text in English', () => {
    render(
      <I18nProvider locale="en" messages={mergedEnMessages}>
        <PasswordLoginProvider enabled={false}>
          <LoginForm />
        </PasswordLoginProvider>
      </I18nProvider>,
    )

    expect(screen.getByText('A-Guy Your Personal Tutor')).toBeTruthy()
  })
})

describe('LoginForm - Google only mode (password disabled)', () => {
  const renderWithPasswordDisabled = (children: React.ReactNode) => {
    return render(
      <I18nProvider locale="he" messages={mergedHeMessages}>
        <PasswordLoginProvider enabled={false}>{children}</PasswordLoginProvider>
      </I18nProvider>,
    )
  }

  it('renders "כניסה מהירה" section label', () => {
    renderWithPasswordDisabled(<LoginForm />)

    expect(screen.getByText('כניסה מהירה')).toBeTruthy()
  })

  it('renders Google SSO button', () => {
    renderWithPasswordDisabled(<LoginForm />)

    expect(screen.getByRole('button', { name: /המשך עם Google/i })).toBeTruthy()
  })

  it('renders three-line subtitle in password disabled mode', () => {
    renderWithPasswordDisabled(<LoginForm />)

    expect(screen.getByText(/הכניסה למערכת - ללא תשלום/)).toBeTruthy()
    expect(screen.getByText(/גישה מהירה ומאובטחת/)).toBeTruthy()
    expect(screen.getByText(/בלחיצה אחת אתם בפנים/)).toBeTruthy()
  })

  it('does NOT render email/password fields when password is disabled', () => {
    renderWithPasswordDisabled(<LoginForm />)

    expect(screen.queryByLabelText(/אימייל/)).toBeNull()
    expect(screen.queryByLabelText(/סיסמה/)).toBeNull()
  })
})

describe('LoginForm - Password enabled mode', () => {
  const renderWithPasswordEnabled = (children: React.ReactNode) => {
    return render(
      <I18nProvider locale="he" messages={mergedHeMessages}>
        <PasswordLoginProvider enabled={true}>{children}</PasswordLoginProvider>
      </I18nProvider>,
    )
  }

  it('renders email and password inputs when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByLabelText(/אימייל/)).toBeTruthy()
    expect(screen.getByLabelText(/סיסמה/)).toBeTruthy()
  })

  it('renders Google SSO button when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByRole('button', { name: /המשך עם Google/i })).toBeTruthy()
  })

  it('renders three-line subtitle when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByText(/הכניסה למערכת - ללא תשלום/)).toBeTruthy()
    expect(screen.getByText(/גישה מהירה ומאובטחת/)).toBeTruthy()
    expect(screen.getByText(/בלחיצה אחת אתם בפנים/)).toBeTruthy()
  })

  it('renders login button', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByRole('button', { name: /התחבר/ })).toBeTruthy()
  })

  it('renders "כניסה מהירה" label when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByText('כניסה מהירה')).toBeTruthy()
  })
})
