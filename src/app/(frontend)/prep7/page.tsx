'use client'

import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

import { cn } from '@/infra/utils/ui'
import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'

type FeatureKey = 'lessons' | 'practice' | 'exams' | 'support'
type BonusKey = 'whatsapp' | 'sessions'

const featureIcons: Record<FeatureKey, LucideIcon> = {
  lessons: BookOpen,
  practice: Pencil,
  exams: ClipboardCheck,
  support: Bot,
}

const features: FeatureKey[] = ['lessons', 'practice', 'exams', 'support']
const bonuses: BonusKey[] = ['whatsapp', 'sessions']

function youtubeEmbedSrc(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    iv_load_policy: '3',
    loop: '1',
    modestbranding: '1',
    mute: '1',
    playsinline: '1',
    playlist: videoId,
    rel: '0',
  })

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
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
      id="main-content"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden bg-muted text-foreground selection:bg-primary/20 selection:text-primary"
    >
      <div className="fixed left-4 top-4 z-50 flex items-center gap-content-gap-xs rounded-xl border border-border bg-card/90 p-1 shadow-elevation-1 backdrop-blur">
        <LanguageSwitcher />
        <ThemeSelector />
      </div>

      <PageHeader t={t} />
      <Hero t={t} />
      <Story isRtl={isRtl} t={t} />
      <CourseFeatures t={t} />
      <Offer t={t} />
      <Footer t={t} />
    </main>
  )
}

function PageHeader({ t }: { t: (key: string) => string }) {
  return (
    <div className="relative z-20 flex flex-col items-center justify-center px-4 pb-section-xs pt-section-sm">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="flex flex-col items-center transition-opacity duration-normal hover:opacity-hover"
        aria-label="Aguy"
        dir="ltr"
      >
        <AguyLogo className="h-32 w-auto sm:h-36" />
        <div className="mt-4 flex w-full items-center justify-center gap-content-gap-xs">
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-content-gap-xs text-body-sm font-medium text-muted-foreground sm:text-body-md">
            <span>{t('brand.taglinePrimary')}</span>
            <span className="font-bold text-primary">-</span>
            <span>{t('brand.taglineSecondary')}</span>
          </div>
          <div className="h-px w-8 bg-border" />
        </div>
      </button>
    </div>
  )
}

function Hero({ t }: { t: (key: string) => string }) {
  return (
    <section className="relative z-10 mx-auto max-w-4xl px-4 pb-section-md pt-section-xs text-center">
      <h1 className="mb-6 text-display-md font-extrabold leading-tight text-foreground dark:text-white md:text-display-lg lg:text-display-xl">
        {t('hero.titleStart')}{' '}
        <span className="text-secondary dark:text-white">{t('hero.titleHighlight')}</span>
      </h1>
      <p className="mb-10 text-heading-lg font-normal text-muted-foreground dark:text-white/80 md:text-heading-xl">
        <span className="font-bold text-primary">{t('hero.newLabel')}</span> {t('hero.subtitle')}
      </p>

      <div className="flex flex-col items-center justify-center gap-content-gap-sm sm:flex-row">
        <Link
          href="/products"
          className="group inline-flex w-full items-center justify-center gap-content-gap-xs rounded-full bg-primary px-8 py-content-gap-sm text-body-lg font-bold text-primary-foreground shadow-elevation-3 transition-all duration-normal hover:-translate-y-1 hover:shadow-elevation-4 sm:w-auto"
        >
          {t('hero.purchaseCta')}
          <ArrowLeft
            className="h-5 w-5 transition-transform duration-normal group-hover:-translate-x-1"
            aria-hidden
          />
        </Link>
        <Link
          href="/start"
          className="inline-flex w-full items-center justify-center rounded-full border border-border bg-card px-8 py-content-gap-sm text-body-lg font-medium text-muted-foreground shadow-elevation-1 transition-all duration-normal hover:-translate-y-1 hover:bg-background hover:shadow-elevation-2 sm:w-auto"
        >
          {t('hero.trialCta')}
        </Link>
      </div>
    </section>
  )
}

function Story({ isRtl, t }: { isRtl: boolean; t: (key: string) => string }) {
  return (
    <section className="relative flex h-[450px] w-full items-center overflow-hidden border-y border-border bg-muted md:h-[550px]">
      <VideoBackground videoId="EDbWunPa46M" title={t('story.videoTitle')} />
      <div
        className={cn(
          'absolute inset-0 z-10 from-background via-background/80 to-transparent dark:from-black dark:via-black/80',
          isRtl ? 'bg-gradient-to-l' : 'bg-gradient-to-r',
        )}
      />
      <div className="absolute inset-0 z-10 bg-background/20 dark:bg-black/60" />

      <div className="relative z-20 mx-auto w-full max-w-6xl px-4 sm:px-8">
        <div className="max-w-lg">
          <h2 className="mb-5 text-display-sm font-extrabold leading-tight text-foreground dark:text-white md:text-display-md lg:text-display-lg">
            {t('story.title')}
          </h2>
          <div className="mb-6 h-1.5 w-16 rounded-full bg-warning" />
          <p className="text-body-lg font-medium leading-relaxed text-foreground dark:text-white md:text-heading-lg">
            {t('story.descriptionPrefix')}{' '}
            <strong className="font-bold text-primary">{t('story.experience')}</strong>
            {t('story.descriptionSuffix')}
          </p>
        </div>
      </div>
    </section>
  )
}

function CourseFeatures({ t }: { t: (key: string) => string }) {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-section-lg">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-display-sm font-extrabold text-foreground md:text-display-md">
          {t('courseFeatures.title')}
        </h2>
        <p className="text-body-lg text-muted-foreground md:text-heading-lg">
          {t('courseFeatures.description')}
        </p>
      </div>

      <div className="flex flex-col items-center gap-content-gap-xl lg:flex-row">
        <div className="flex w-full flex-col gap-content-gap-sm lg:w-1/2">
          {features.map((key) => (
            <FeatureCard key={key} featureKey={key} t={t} />
          ))}
        </div>

        <LaptopPreview t={t} />
      </div>
    </section>
  )
}

function FeatureCard({ featureKey, t }: { featureKey: FeatureKey; t: (key: string) => string }) {
  const Icon = featureIcons[featureKey]
  const highlighted = featureKey === 'support'

  return (
    <div
      className={cn(
        'flex items-start gap-content-gap-sm rounded-2xl border bg-card p-card-padding shadow-elevation-1 transition-all duration-normal hover:-translate-y-1 hover:shadow-elevation-2',
        highlighted ? 'border-primary/20 bg-primary-soft' : 'border-border',
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          highlighted ? 'bg-primary/10 text-primary' : 'bg-muted text-secondary',
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <h3 className="mb-1 text-heading-xl font-bold text-foreground">
          {t(`courseFeatures.items.${featureKey}.title`)}
        </h3>
        <p className="text-body-md text-muted-foreground">
          {t(`courseFeatures.items.${featureKey}.description`)}
        </p>
      </div>
    </div>
  )
}

function LaptopPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="relative mt-8 w-full lg:mt-0 lg:w-1/2">
      <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
        <div className="relative z-10 rounded-b-xl rounded-t-3xl border-b-8 border-foreground bg-foreground p-card-padding-sm shadow-card dark:border-zinc-900 dark:bg-zinc-900">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-foreground shadow-inner dark:bg-zinc-900">
            <iframe
              className="absolute left-0 top-0 h-full w-full scale-125 opacity-90"
              src={youtubeEmbedSrc('4BpyIiLs3jI')}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              loading="lazy"
              title={t('courseFeatures.previewVideoTitle')}
            />
            <div className="absolute left-0 top-0 flex w-full flex-col">
              <div className="flex items-center justify-between border-b border-background/10 bg-secondary/95 p-2 shadow-elevation-1 backdrop-blur">
                <div className="rounded bg-card px-2 py-1">
                  <AguyLogo className="h-5 w-auto" compact />
                </div>
                <div className="flex gap-content-gap-xs">
                  <span className="h-2 w-2 rounded-full bg-background/30" />
                  <span className="h-2 w-2 rounded-full bg-background/30" />
                  <span className="h-2 w-2 rounded-full bg-background/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-3 left-1/2 z-0 h-4 w-[115%] -translate-x-1/2 rounded-b-xl border-t border-background/20 bg-muted shadow-elevation-4">
          <div className="mx-auto mt-1 h-1 w-1/5 rounded-full bg-border" />
        </div>
      </div>
    </div>
  )
}

function Offer({ t }: { t: (key: string) => string }) {
  return (
    <section className="border-t border-border bg-card py-section-lg">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-10 text-center">
          <h2 className="mb-4 text-display-sm font-extrabold text-foreground md:text-display-md">
            {t('offer.title')}
          </h2>
          <p className="text-body-lg text-muted-foreground">{t('offer.description')}</p>
        </div>

        <div className="mx-auto max-w-3xl overflow-hidden rounded-chat-2xl border border-border bg-card shadow-card">
          <div className="p-card-padding-lg">
            <div className="mb-6 inline-flex items-center gap-content-gap-xs rounded-full bg-success/10 px-4 py-2 text-body-sm font-medium text-success">
              <Tag className="h-4 w-4" aria-hidden />
              {t('offer.badge')}
            </div>

            <div className="mb-8 flex flex-col justify-between gap-content-gap border-b border-border pb-8 md:flex-row md:items-end">
              <div>
                <h3 className="mb-1 text-body-md font-medium text-muted-foreground">
                  {t('offer.priceLabel')}
                </h3>
                <div className="flex items-baseline gap-content-gap-xs text-foreground">
                  <span className="text-display-xl font-extrabold">{t('offer.priceAmount')}</span>
                  <span className="text-display-sm font-bold">{t('offer.priceCurrency')}</span>
                  <span className="text-heading-lg font-normal text-muted-foreground">
                    {t('offer.priceSuffix')}
                  </span>
                </div>
                <p className="mt-2 text-body-sm text-muted-foreground">{t('offer.deadline')}</p>
              </div>

              <Link
                href="/products"
                className="inline-flex w-full justify-center rounded-full bg-primary px-8 py-content-gap-sm text-body-lg font-medium text-primary-foreground shadow-elevation-1 transition-all duration-normal hover:-translate-y-1 hover:shadow-elevation-2 md:w-auto"
              >
                {t('offer.purchaseCta')}
              </Link>
            </div>

            <div>
              <h4 className="mb-4 text-heading-lg font-bold text-foreground">
                {t('offer.bonusesTitle')}
              </h4>
              <ul className="space-y-4">
                {bonuses.map((key) => (
                  <li key={key} className="flex items-start gap-content-gap-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                    <div>
                      <span className="font-bold text-foreground">
                        {t(`offer.bonuses.${key}.title`)}
                      </span>
                      <p className="mt-1 text-body-sm text-muted-foreground">
                        {t(`offer.bonuses.${key}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer({ t }: { t: (key: string) => string }) {
  return (
    <div className="relative z-20 border-t border-border bg-muted py-section-xs text-center">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4">
        <AguyLogo className="mb-4 h-10 w-auto opacity-60" compact />
        <p className="text-body-sm font-medium text-muted-foreground">{t('footer.copyright')}</p>
      </div>
    </div>
  )
}

function VideoBackground({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[200vh] min-h-[800px] w-[200vw] min-w-[1200px] -translate-x-1/2 -translate-y-1/2 sm:h-[150vh] sm:w-[150vw]">
        <iframe
          className="h-full w-full"
          src={youtubeEmbedSrc(videoId)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
          title={title}
        />
      </div>
    </div>
  )
}

function AguyLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="35 30 160 155"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        transform="translate(50, 35) scale(0.6)"
        fill="#801421"
        d="M198.867,58.948h-30.566c-0.686,0-1.24-0.557-1.24-1.24v-30.57c0-0.686,0.558-1.24,1.24-1.24h30.566 c0.688,0,1.24,0.558,1.24,1.24v30.567C200.107,58.392,199.553,58.948,198.867,58.948"
      />
      <path
        fill="#7B8D7A"
        fillRule="evenodd"
        d="M147.166,88.743l-7.594,6.373c-0.486,0.407-1.217,0.346-1.627-0.145l-14.447-17.219c-0.408-0.488-0.348-1.216,0.143-1.627l7.596-6.373c0.486-0.408,1.216-0.348,1.627,0.143l14.449,17.22C147.719,87.603,147.656,88.332,147.166,88.743 M80.648,119.769l8.48,10.104c0.438,0.523,0.371,1.308-0.154,1.746l-22.109,18.555c-0.521,0.439-1.307,0.373-1.748-0.151l-8.479-10.104c-0.441-0.524-0.371-1.309,0.152-1.748l22.11-18.554C79.428,119.179,80.207,119.243,80.648,119.769 M41.061,154.111l12.012,-10.078c0.525,-0.439,1.309,-0.371,1.746,0.15l5.779,6.887c0.439,0.527,0.373,1.311,-0.152,1.748l-11.664,9.787Z M79.409,179.709l14.145,-51.029l-10.994,-13.1c-0.439,-0.527,-0.371,-1.311,0.152,-1.748l37.562,-31.521c0.524,-0.438,1.307,-0.37,1.746,0.154l11.035,13.146c0.438,0.525,0.37,1.311,-0.152,1.747L97.82,126.796c0.025,0.035,0.053,0.066,0.074,0.104c0.051,0.086,0.086,0.182,0.125,0.27c0.016,0.037,0.039,0.068,0.053,0.107l0.008,0.027c0,0.002,0.002,0.004,0.006,0.008l18.502,52.668L112.31,181.011l-7.971,-22.688H89.871V158.321l-6.215,22.424Z M96.25,135.3l-5.17,18.648h11.725Z"
      />
      {!compact && (
        <g fill="#801421" transform="translate(120 150) scale(0.4)">
          <path d="M0 18 Q0 0 18 0 H48 V13 H20 Q13 13 13 20 V42 Q13 49 20 49 H35 V36 H35 V10 H48 V58 Q48 76 30 76 H8 V63 H28 Q35 63 35 56 V53 H18 Q0 53 0 40 Z" />
          <path d="M62 0 H75 V40 Q75 49 84 49 H96 V0 H109 V62 H84 Q62 62 62 40 Z" />
          <path d="M123 0 H137 L153 43 L169 0 H183 L160 60 Q154 76 137 76 H125 V63 H136 Q144 63 147 55 Z" />
        </g>
      )}
    </svg>
  )
}
