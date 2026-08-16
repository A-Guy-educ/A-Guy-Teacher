import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { AnalyticsProvider } from '@/infra/analytics/providers/AnalyticsProvider'
import { AnalyticsProvider as ExternalAnalyticsProvider } from '@/components/AnalyticsProvider'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AnalyticsProvider>
        <ExternalAnalyticsProvider>
          <HeaderThemeProvider>{children}</HeaderThemeProvider>
        </ExternalAnalyticsProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  )
}
