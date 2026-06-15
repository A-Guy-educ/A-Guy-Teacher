'use client'

import { isRTL } from '@/i18n/config'
import { cn } from '@/infra/utils/ui'
import type { User } from '@/infra/types/content'
import { BrandLogo } from '@/ui/web/BrandLogo'
import { UserDropdown } from '@/ui/web/UserDropdown'
import { Button } from '@/ui/web/components/button'
import { usePasswordLogin } from '@/ui/web/providers/PasswordLoginProvider'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ArrowLeft, ArrowRight, Maximize2, Menu, Minimize2 } from 'lucide-react'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl?: string
  onMenuClick?: () => void
  user?: User | null
  isAuthLoading?: boolean
  currentUrl?: string
  isFullscreen?: boolean
  onFullscreenToggle?: () => void
}

export function ExerciseHeader({
  exerciseTitle,
  backUrl,
  onMenuClick,
  user,
  isAuthLoading,
  currentUrl,
  isFullscreen = false,
  onFullscreenToggle,
}: ExerciseHeaderProps) {
  const t = useTranslations('courses')
  const tCommon = useTranslations('common.header')
  const passwordLogin = usePasswordLogin()
  const locale = useLocale()
  const rtl = isRTL(locale as 'en' | 'he')
  const router = useRouterWithLoading()
  const returnToParam = currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else if (backUrl) {
      router.push(backUrl)
    } else {
      router.push('/courses')
    }
  }

  const hamburgerButton = onMenuClick ? (
    <button
      type="button"
      onClick={onMenuClick}
      className="p-2 rounded-lg hover:bg-muted transition-colors duration-normal lg:hidden text-foreground"
      aria-label="Open menu"
    >
      <Menu className="w-6 h-6 text-foreground" />
    </button>
  ) : null

  const fullscreenButton = onFullscreenToggle ? (
    <button
      type="button"
      onClick={onFullscreenToggle}
      className="h-9 w-10 rounded-full border border-foreground/20 bg-muted shadow-elevation-1 hover:bg-card hover:border-foreground/35 transition-all duration-normal lg:hidden text-foreground flex items-center justify-center"
      aria-label={isFullscreen ? 'Collapse exercise view' : 'Expand exercise view'}
      title={isFullscreen ? 'Collapse' : 'Expand'}
    >
      {isFullscreen ? (
        <Minimize2 className="w-5 h-5 text-foreground" />
      ) : (
        <Maximize2 className="w-5 h-5 text-foreground" />
      )}
    </button>
  ) : null

  const desktopAuth = (
    <div
      className="hidden lg:flex items-center gap-content-gap-xs"
      data-testid="exercise-header-auth"
    >
      {isAuthLoading ? (
        <div className="w-20 h-8 animate-pulse bg-muted rounded" aria-hidden="true" />
      ) : user ? (
        <UserDropdown user={user} />
      ) : (
        <div className="flex items-center gap-content-gap-xs">
          <Button size="sm" asChild>
            <SystemLink href={`/login${returnToParam}`}>{tCommon('login')}</SystemLink>
          </Button>
          {passwordLogin && (
            <Button size="sm" variant="outline" asChild>
              <SystemLink href={`/signup${returnToParam}`}>{tCommon('signup')}</SystemLink>
            </Button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center flex-shrink-0 z-[100] relative">
      <button
        onClick={handleBack}
        className={cn(
          'flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors duration-normal flex-shrink-0 absolute cursor-pointer',
          rtl ? 'right-5' : 'left-5',
        )}
        aria-label={t('backToLesson')}
      >
        {rtl ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
      </button>

      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-body-lg font-extrabold tracking-tight max-w-[40%] text-center truncate">
        {exerciseTitle}
      </h1>

      <div
        className={cn(
          'flex items-center gap-0 lg:gap-content-gap-xs flex-shrink-0 fixed top-[10px] z-[101]',
          rtl ? 'left-5' : 'right-5',
        )}
      >
        {rtl ? (
          <>
            {fullscreenButton}
            {hamburgerButton}
            <BrandLogo className="h-8 w-auto hidden lg:flex" />
            {desktopAuth}
          </>
        ) : (
          <>
            <BrandLogo className="h-8 w-auto hidden lg:flex" />
            {desktopAuth}
            {hamburgerButton}
            {fullscreenButton}
          </>
        )}
      </div>
    </header>
  )
}
