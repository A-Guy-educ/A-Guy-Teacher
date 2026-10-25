'use client'

import { AppShell, ThemeProvider, applyLocale, type Locale } from '@a-guy/ui'

import { LogoutButton } from './logout-button'

const COPY = {
  en: {
    appName: 'Teacher',
    classes: 'Classes',
    dashboard: 'Dashboard',
    learning: 'Learning site',
    footer: 'A-Guy teacher workspace',
    menu: 'Menu',
    skip: 'Skip to the class dashboard',
    theme: 'Theme',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
    logout: 'Log out',
    loggingOut: 'Logging out…',
  },
  he: {
    appName: 'מורים',
    classes: 'כיתות',
    dashboard: 'לוח בקרה',
    learning: 'אתר הלמידה',
    footer: 'סביבת העבודה למורים של A-Guy',
    menu: 'תפריט',
    skip: 'דילוג לתמונת הכיתה',
    theme: 'ערכת נושא',
    auto: 'אוטומטי',
    light: 'בהיר',
    dark: 'כהה',
    logout: 'התנתקות',
    loggingOut: 'מתנתק…',
  },
} as const

export function AppChrome({
  children,
  dashboardOrigin,
  locale,
  webOrigin,
}: {
  children: React.ReactNode
  dashboardOrigin?: string
  locale: Locale
  webOrigin: string
}) {
  const copy = COPY[locale]

  function changeLocale(nextLocale: Locale) {
    applyLocale(nextLocale, {
      rootDomain: window.location.hostname.endsWith('.aguy.co.il') ? 'aguy.co.il' : undefined,
      secure: window.location.protocol === 'https:',
    })
    window.location.reload()
  }

  return (
    <ThemeProvider>
      <AppShell
        actions={<LogoutButton labels={{ idle: copy.logout, pending: copy.loggingOut }} />}
        appName={copy.appName}
        brandHref={`${webOrigin}/`}
        footer={copy.footer}
        locale={locale}
        localeLabels={{ en: 'English', he: 'עברית' }}
        menuLabel={copy.menu}
        navItems={[
          { href: '/', label: copy.classes, current: true },
          ...(dashboardOrigin ? [{ href: `${dashboardOrigin}/`, label: copy.dashboard }] : []),
          { href: `${webOrigin}/`, label: copy.learning },
        ]}
        onLocaleChange={changeLocale}
        skipLabel={copy.skip}
        themeLabels={{
          label: copy.theme,
          auto: copy.auto,
          light: copy.light,
          dark: copy.dark,
        }}
      >
        {children}
      </AppShell>
    </ThemeProvider>
  )
}
