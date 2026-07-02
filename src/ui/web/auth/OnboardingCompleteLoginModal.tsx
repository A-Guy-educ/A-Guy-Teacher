'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/web/components/dialog'
import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { useTranslations } from '@/ui/web/providers/I18n'

interface OnboardingCompleteLoginModalProps {
  isOpen: boolean
  returnTo: string
}

/**
 * Non-dismissible registration popup shown at the end of the `/start`
 * onboarding wizard for unauthenticated visitors. Mirrors `AuthGateModal`'s
 * structural pattern (Dialog with `allowDismiss={false}` + Google button)
 * but with onboarding-specific copy and no escape-hatch link.
 */
export function OnboardingCompleteLoginModal({
  isOpen,
  returnTo,
}: OnboardingCompleteLoginModalProps) {
  const t = useTranslations('auth.onboardingComplete')

  return (
    <Dialog open={isOpen}>
      <DialogContent allowDismiss={false} className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-heading-xl">{t('title')}</DialogTitle>
          <DialogDescription className="mt-2">{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col items-center gap-3">
          <GoogleLoginButton returnTo={returnTo} label={t('primaryCta')} className="w-full" />
          <p className="text-body-xs text-muted-foreground text-center">{t('reassurance')}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
