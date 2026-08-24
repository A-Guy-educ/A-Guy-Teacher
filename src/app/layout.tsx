import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { ThemeInitScript, type Locale } from '@a-guy/ui'

import { AppChrome } from '../components/app-chrome'
import { getDashboardOrigin, getWebOrigin } from '../server/aguy-api'

import '@a-guy/ui/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'A-Guy Teacher',
  description: 'Course management for A-Guy teachers',
  robots: { index: false, follow: false },
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('NEXT_LOCALE')?.value === 'he' ? 'he' : 'en'
  const dashboardOrigin = getDashboardOrigin()?.origin
  const webOrigin = getWebOrigin().origin

  return (
    <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'} data-theme="light">
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <AppChrome dashboardOrigin={dashboardOrigin} locale={locale} webOrigin={webOrigin}>
          {children}
        </AppChrome>
      </body>
    </html>
  )
}
