'use client'

import {
  BookOpen,
  Bot,
  CalendarDays,
  Gift,
  Headphones,
  MessageCircle,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'

type FeatureKey = 'lessons' | 'practice' | 'exams' | 'support'
type BonusKey = 'whatsapp' | 'sessions' | 'boost'

const featureIcons: Record<FeatureKey, LucideIcon> = {
  lessons: BookOpen,
  practice: Bot,
  exams: CalendarDays,
  support: Headphones,
}

const bonusIcons: Record<BonusKey, LucideIcon> = {
  whatsapp: MessageCircle,
  sessions: Users,
  boost: Video,
}

export default function Prep7Page() {
  const locale = useLocale()
  const t = useTranslations('prep7')
  const isRtl = locale === 'he'

  useEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary"
    >
      <div className="fixed left-4 top-4 z-50 flex items-center gap-content-gap-xs rounded-xl border border-border bg-card/90 p-1 shadow-elevation-1 backdrop-blur">
        <LanguageSwitcher />
        <ThemeSelector />
      </div>

      <Hero t={t} />
      <WhoIsAguy t={t} />
      <CourseFeatures t={t} />
      <Benefits t={t} />
      <Bonuses t={t} />
      <Footer t={t} />
    </main>
  )
}

function Hero({ t }: { t: (key: string) => string }) {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden border-b border-border bg-background px-4 pb-20 pt-24 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[520px] max-w-5xl rounded-full bg-primary/10 blur-3xl" />

      {/* Video Background - YouTube Embed */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <iframe
          className="absolute left-1/2 top-1/2 min-h-[100vh] min-w-[177.77vh] -translate-x-1/2 -translate-y-1/2 transform"
          src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ&controls=0&showinfo=0&rel=0&modestbranding=1"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
          title="Background Video"
        />
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
        <h1 className="mb-6 max-w-4xl text-display-md font-extrabold leading-tight text-foreground md:text-display-lg lg:text-display-xl">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mb-10 max-w-3xl text-heading-lg leading-relaxed text-muted-foreground">
          {t('hero.subtitle')}
        </p>

        <div className="flex w-full max-w-xl flex-col justify-center gap-content-gap sm:flex-row">
          <Link
            href="/start"
            className="flex flex-1 items-center justify-center gap-content-gap-xs rounded-xl bg-primary px-8 py-section-xs text-body-lg font-bold text-primary-foreground shadow-elevation-3 transition-all duration-normal hover:-translate-y-1 hover:bg-primary"
          >
            {t('hero.registerCta')}
          </Link>
          <Link
            href="/products"
            className="flex flex-1 items-center justify-center gap-content-gap-xs rounded-xl border border-success/30 bg-card px-8 py-section-xs text-body-lg font-bold text-success shadow-elevation-1 transition-all duration-normal hover:-translate-y-1 hover:border-success hover:bg-success/10"
          >
            {t('hero.trialCta')}
          </Link>
        </div>
      </div>
    </section>
  )
}

function WhoIsAguy({ t }: { t: (key: string) => string }) {
  return (
    <section className="bg-muted/30 px-4 py-section-xl">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-content-gap-xl md:grid-cols-2">
          <div>
            <h2 className="mb-6 text-display-sm font-extrabold md:text-display-md">
              {t('whoIsAguy.title')}
            </h2>
            <p className="text-heading-lg leading-relaxed text-muted-foreground">
              {t('whoIsAguy.description')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-content-gap-sm">
            <div className="rounded-2xl border border-border bg-card p-card-padding-sm shadow-elevation-1">
              <p className="text-display-sm font-black text-primary">
                {t('whoIsAguy.stats.experience.value')}
              </p>
              <p className="text-body-sm font-semibold text-muted-foreground">
                {t('whoIsAguy.stats.experience.label')}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-card-padding-sm shadow-elevation-1">
              <p className="text-display-sm font-black text-primary">
                {t('whoIsAguy.stats.students.value')}
              </p>
              <p className="text-body-sm font-semibold text-muted-foreground">
                {t('whoIsAguy.stats.students.label')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CourseFeatures({ t }: { t: (key: string) => string }) {
  const features: FeatureKey[] = ['lessons', 'practice', 'exams', 'support']

  return (
    <section className="relative overflow-hidden bg-foreground px-4 py-section-xl text-background dark:bg-card">
      <div className="pointer-events-none absolute inset-0 bg-primary/10" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-display-sm font-extrabold md:text-display-md">
            {t('courseFeatures.title')}
          </h2>
          <p className="text-heading-lg text-background/75 dark:text-foreground">
            {t('courseFeatures.description')}
          </p>
        </div>

        <div className="grid gap-content-gap-lg md:grid-cols-2 lg:grid-cols-4">
          {features.map((key) => {
            const Icon = featureIcons[key]

            return (
              <div
                key={key}
                className="rounded-3xl border border-foreground/10 bg-foreground/10 p-card-padding-lg transition-colors duration-normal hover:border-foreground/30 dark:border-background/10 dark:bg-background/10"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-foreground/10 text-success dark:bg-background/10">
                  <Icon className="h-7 w-7" aria-hidden />
                </div>
                <h4 className="mb-2 text-heading-xl font-bold text-foreground dark:text-foreground">
                  {t(`courseFeatures.items.${key}.title`)}
                </h4>
                <p className="text-foreground/70 dark:text-foreground">
                  {t(`courseFeatures.items.${key}.description`)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Benefits({ t }: { t: (key: string) => string }) {
  return (
    <section className="bg-primary px-4 py-section-xl text-center text-primary-foreground">
      <h2 className="mb-4 text-display-sm font-extrabold md:text-display-lg">
        {t('benefits.title')}
      </h2>
      <p className="mx-auto mb-6 max-w-2xl text-heading-lg text-primary-foreground/80">
        {t('benefits.description')}
      </p>

      <div className="mb-8 inline-flex items-center gap-content-gap-xs rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-6 py-3 text-body-lg font-bold">
        <span className="text-display-sm font-black text-primary-foreground">
          {t('benefits.discount')}
        </span>
      </div>

      <p className="mb-8 text-heading-lg text-primary-foreground/80">{t('benefits.deadline')}</p>

      <Link
        href="/start"
        className="inline-flex items-center justify-center gap-content-gap-xs rounded-xl bg-card px-8 py-section-xs text-body-lg font-bold text-primary shadow-elevation-3 transition-all duration-normal hover:-translate-y-1"
      >
        {t('benefits.cta')}
      </Link>
    </section>
  )
}

function Bonuses({ t }: { t: (key: string) => string }) {
  const bonuses: BonusKey[] = ['whatsapp', 'sessions', 'boost']

  return (
    <section className="bg-muted/30 px-4 py-section-xl">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-display-sm font-extrabold md:text-display-md">
            {t('bonuses.title')}
          </h2>
          <p className="text-heading-lg text-muted-foreground">{t('bonuses.description')}</p>
        </div>

        <div className="grid gap-content-gap-lg md:grid-cols-3">
          {bonuses.map((key) => {
            const Icon = bonusIcons[key]

            return (
              <div
                key={key}
                className="flex flex-col items-center rounded-3xl border border-border bg-card p-card-padding-lg text-center shadow-elevation-1"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Gift className="h-7 w-7" aria-hidden />
                </div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h4 className="mb-2 text-heading-xl font-bold text-foreground">
                  {t(`bonuses.items.${key}.title`)}
                </h4>
                <p className="text-body-sm text-muted-foreground">
                  {t(`bonuses.items.${key}.description`)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Footer({ t }: { t: (key: string) => string }) {
  return (
    <footer className="border-t border-border bg-card px-4 py-section-sm text-center">
      <p className="text-body-sm text-muted-foreground">{t('footer.copyright')}</p>
    </footer>
  )
}
