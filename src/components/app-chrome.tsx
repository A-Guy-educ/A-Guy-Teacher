'use client'

import { AppShell, ThemeProvider, applyLocale, type Locale } from '@a-guy/ui'

import { LogoutButton } from './logout-button'

const COPY = {
  en: {
    appName: 'Teacher',
    courses: 'Courses',
    dashboard: 'Dashboard',
    learning: 'Learning site',
    footer: 'A-Guy teacher workspace',
    menu: 'Menu',
    skip: 'Skip to course management',
    theme: 'Theme',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
    logout: 'Log out',
    loggingOut: 'Logging out…',
  },
  he: {
    appName: 'מורים',
    courses: 'קורסים',
    dashboard: 'לוח בקרה',
    learning: 'אתר הלמידה',
    footer: 'סביבת העבודה למורים של A-Guy',
    menu: 'תפריט',
    skip: 'דילוג לניהול הקורסים',
    theme: 'ערכת נושא',
    auto: 'אוטומטי',
    light: 'בהיר',
    dark: 'כהה',
    logout: 'התנתקות',
    loggingOut: 'מתנתק…',
  },
} as const

export function AppChrome({ children, locale }: { children: React.ReactNode; locale: Locale }) {
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
        footer={copy.footer}
        locale={locale}
        localeLabels={{ en: 'English', he: 'עברית' }}
        menuLabel={copy.menu}
        navItems={[
          { href: '/', label: copy.courses, current: true },
          { href: 'https://dash.aguy.co.il/', label: copy.dashboard },
          { href: 'https://www.aguy.co.il/', label: copy.learning },
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
