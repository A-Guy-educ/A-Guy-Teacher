/**
 * Fallback panel rendered when a signed-in non-admin lands on /dashboard.
 * Extracted as a client component so it can consume `useTranslations` —
 * the parent /dashboard page is a Server Component and can't use hooks.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary "Admin only" fallback panel for non-admin visitors
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function NotAuthorizedPanel() {
  const t = useTranslations('dashboard')

  return (
    <main className="p-card-padding-lg">
      <h1 className="text-heading-xl font-semibold mb-2">{t('adminOnlyTitle')}</h1>
      <p className="text-muted-foreground">{t('adminOnlyBody')}</p>
    </main>
  )
}
