'use client'

import {
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  ClipboardCheck,
  MessageCircle,
  NotebookTabs,
  Play,
  Sparkles,
  Star,
  Table2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'

type SimTab = 'dashboard' | 'chat' | 'notebook'
type ComparisonKey = 'personal' | 'plan' | 'experience' | 'emotional' | 'cost' | 'availability'
type FeatureKey = 'lessons' | 'exercises' | 'exams' | 'teacher' | 'plan' | 'emotional'
type StoryStatKey = 'experience' | 'hours' | 'exercises' | 'lessons' | 'research'

const comparisonRows: ComparisonKey[] = [
  'personal',
  'plan',
  'experience',
  'emotional',
  'cost',
  'availability',
]

const featureKeys: FeatureKey[] = ['lessons', 'exercises', 'exams', 'teacher', 'plan', 'emotional']
const storyStats: StoryStatKey[] = ['experience', 'hours', 'exercises', 'lessons', 'research']

const featureIcons: Record<FeatureKey, LucideIcon> = {
  lessons: BookOpen,
  exercises: Table2,
  exams: ClipboardCheck,
  teacher: MessageCircle,
  plan: CalendarDays,
  emotional: Star,
}

const simTabs: SimTab[] = ['dashboard', 'chat', 'notebook']

export function DemoLandingPage() {
  const [activeTab, setActiveTab] = useState<SimTab>('dashboard')
  const locale = useLocale()
  const t = useTranslations('landingPage')
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
      <Comparison t={t} />
      <KnowledgeAndFeatures t={t} />
      <Simulation activeTab={activeTab} onTabChange={setActiveTab} t={t} />
      <BottomCta t={t} />
    </main>
  )
}

function Hero({ t }: { t: (key: string) => string }) {
  return (
    <section className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden border-b border-border bg-background px-4 pb-20 pt-24 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[520px] max-w-5xl rounded-full bg-primary/10 blur-3xl" />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
        <LogoMark />

        <div className="mb-6 inline-flex items-center gap-content-gap-xs rounded-full border border-success/20 bg-success/10 px-4 py-2 text-body-sm font-bold text-success">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          {t('hero.eyebrow')}
        </div>

        <h1 className="mb-6 max-w-4xl text-display-md font-extrabold leading-tight text-foreground md:text-display-lg lg:text-display-xl">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mb-10 max-w-3xl text-heading-lg leading-relaxed text-muted-foreground">
          {t('hero.subtitle')}
        </p>

        <div className="flex w-full max-w-xl flex-col justify-center gap-content-gap sm:flex-row">
          <Link
            href="/products"
            className="flex flex-1 items-center justify-center gap-content-gap-xs rounded-xl bg-primary px-8 py-section-xs text-body-lg font-bold text-primary-foreground shadow-elevation-3 transition-all duration-normal hover:-translate-y-1 hover:bg-primary/90"
          >
            {t('hero.plansCta')}
          </Link>
          <Link
            href="/start"
            className="flex flex-1 items-center justify-center gap-content-gap-xs rounded-xl border border-success/30 bg-card px-8 py-section-xs text-body-lg font-bold text-success shadow-elevation-1 transition-all duration-normal hover:-translate-y-1 hover:border-success hover:bg-success/10"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
            {t('hero.trialCta')}
          </Link>
        </div>

        <Link
          href="/login"
          className="mt-6 text-body-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors duration-normal hover:text-primary"
        >
          {t('hero.loginCta')}
        </Link>

        <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-content-gap-sm sm:grid-cols-3">
          {(['lessons', 'exercises', 'exams'] as const).map((key) => (
            <div
              key={key}
              className="rounded-2xl border border-border bg-card/80 p-card-padding-sm shadow-elevation-1 backdrop-blur"
            >
              <p className="text-display-sm font-black text-primary">
                {t(`hero.stats.${key}.value`)}
              </p>
              <p className="text-body-sm font-semibold text-muted-foreground">
                {t(`hero.stats.${key}.label`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Comparison({ t }: { t: (key: string) => string }) {
  return (
    <section className="bg-muted/30 px-4 py-section-xl">
      <div className="mx-auto max-w-6xl">
        <SectionHeader title={t('comparison.title')} description={t('comparison.description')} />

        <div className="grid grid-cols-1 items-stretch gap-content-gap-xl md:grid-cols-2">
          <ComparisonCard
            title={t('comparison.aguy')}
            icon={<Bot className="h-6 w-6" />}
            highlighted
          >
            {comparisonRows.map((row) => (
              <ComparisonItem
                key={row}
                positive
                label={t(`comparison.rows.${row}.label`)}
                value={t(`comparison.rows.${row}.aguy`)}
              />
            ))}
          </ComparisonCard>

          <ComparisonCard title={t('comparison.tutor')} icon={<UserRound className="h-6 w-6" />}>
            {comparisonRows.map((row) => (
              <ComparisonItem
                key={row}
                positive={row === 'emotional'}
                warning={row === 'experience'}
                label={t(`comparison.rows.${row}.label`)}
                value={t(`comparison.rows.${row}.tutor`)}
              />
            ))}
          </ComparisonCard>
        </div>
      </div>
    </section>
  )
}

function KnowledgeAndFeatures({ t }: { t: (key: string) => string }) {
  return (
    <section className="relative overflow-hidden bg-foreground px-4 py-section-xl text-background dark:bg-card">
      <div className="pointer-events-none absolute inset-0 bg-primary/10" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-20 grid items-center gap-content-gap-xl md:grid-cols-2">
          <div>
            <p className="mb-3 text-body-sm font-bold uppercase text-success">
              {t('hero.previewBadge')}
            </p>
            <h2 className="mb-6 text-display-sm font-extrabold md:text-display-md">
              {t('story.title')}
            </h2>
            <p className="text-heading-lg leading-relaxed text-background/75 dark:text-muted-foreground">
              {t('story.description')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-content-gap-sm">
            {storyStats.map((key, index) => (
              <div
                key={key}
                className={
                  index === 0
                    ? 'rounded-2xl border border-background/10 bg-background/10 p-card-padding-sm backdrop-blur sm:col-span-2'
                    : 'rounded-2xl border border-background/10 bg-background/10 p-card-padding-sm backdrop-blur'
                }
              >
                <p className="text-display-sm font-black">{t(`story.stats.${key}.value`)}</p>
                <p className="text-body-sm font-semibold text-background/70 dark:text-muted-foreground">
                  {t(`story.stats.${key}.label`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-background/10 pt-20">
          <SectionHeader
            title={t('features.title')}
            description={t('features.description')}
            inverted
          />

          <div className="grid gap-content-gap-lg md:grid-cols-2 lg:grid-cols-3">
            {featureKeys.map((key) => {
              const Icon = featureIcons[key]

              return (
                <div
                  key={key}
                  className="rounded-3xl border border-background/10 bg-background/10 p-card-padding-lg transition-colors duration-normal hover:border-background/30"
                >
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-background/10 text-success">
                    <Icon className="h-7 w-7" aria-hidden />
                  </div>
                  <h4 className="mb-2 text-heading-xl font-bold">
                    {t(`features.items.${key}.title`)}
                  </h4>
                  <p className="text-background/70 dark:text-muted-foreground">
                    {t(`features.items.${key}.description`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function Simulation({
  activeTab,
  onTabChange,
  t,
}: {
  activeTab: SimTab
  onTabChange: (tab: SimTab) => void
  t: (key: string) => string
}) {
  return (
    <section className="border-b border-border bg-background px-4 py-section-xl">
      <div className="mx-auto max-w-6xl">
        <SectionHeader title={t('simulation.title')} description={t('simulation.description')} />

        <div className="mb-8 flex flex-wrap justify-center gap-content-gap-sm">
          {simTabs.map((tab) => (
            <SimButton key={tab} active={activeTab === tab} onClick={() => onTabChange(tab)}>
              {t(`simulation.tabs.${tab}`)}
            </SimButton>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevation-2">
          <div className="flex items-center border-b border-border bg-muted/40 px-5 py-section-xs">
            <span className="h-3 w-3 rounded-full bg-destructive/70" />
            <span className="h-3 w-3 rounded-full bg-warning/70" />
            <span className="h-3 w-3 rounded-full bg-success/70" />
          </div>

          {activeTab === 'dashboard' && <DashboardPreview t={t} />}
          {activeTab === 'chat' && <ChatPreview t={t} />}
          {activeTab === 'notebook' && <NotebookPreview t={t} />}
        </div>
      </div>
    </section>
  )
}

function BottomCta({ t }: { t: (key: string) => string }) {
  return (
    <section className="bg-primary px-4 py-20 text-center text-primary-foreground">
      <h2 className="mb-4 text-display-sm font-extrabold md:text-display-lg">{t('cta.title')}</h2>
      <p className="mx-auto mb-8 max-w-2xl text-heading-lg text-primary-foreground/80">
        {t('cta.description')}
      </p>
      <div className="flex flex-col justify-center gap-content-gap sm:flex-row">
        <Link
          href="/products"
          className="rounded-xl bg-card px-8 py-section-xs text-body-lg font-bold text-primary shadow-card-hover transition-all duration-normal hover:-translate-y-1"
        >
          {t('cta.join')}
        </Link>
        <Link
          href="/start"
          className="rounded-xl border border-primary-foreground/30 bg-primary-foreground/10 px-8 py-section-xs text-body-lg font-bold text-primary-foreground transition-all duration-normal hover:bg-primary-foreground/20"
        >
          {t('cta.trial')}
        </Link>
      </div>
    </section>
  )
}

function LogoMark() {
  return (
    <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-card text-display-sm font-black text-primary shadow-elevation-2">
      A
    </div>
  )
}

function SectionHeader({
  title,
  description,
  inverted = false,
}: {
  title: string
  description: string
  inverted?: boolean
}) {
  return (
    <div className="mx-auto mb-14 max-w-3xl text-center">
      <h2 className="mb-4 text-display-sm font-extrabold md:text-display-md">{title}</h2>
      <p
        className={
          inverted ? 'text-heading-lg text-background/75' : 'text-heading-lg text-muted-foreground'
        }
      >
        {description}
      </p>
    </div>
  )
}

function ComparisonCard({
  title,
  icon,
  children,
  highlighted = false,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  highlighted?: boolean
}) {
  return (
    <div
      className={
        highlighted
          ? 'relative overflow-hidden rounded-3xl border-2 border-primary bg-card p-card-padding shadow-elevation-3'
          : 'rounded-3xl border border-border bg-card p-card-padding shadow-elevation-1'
      }
    >
      <div
        className={
          highlighted
            ? 'mb-6 flex items-center gap-content-gap-sm text-primary'
            : 'mb-6 flex items-center gap-content-gap-sm text-muted-foreground'
        }
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">{icon}</div>
        <h3 className="text-heading-xl font-bold text-foreground">{title}</h3>
      </div>
      <ul className="space-y-5">{children}</ul>
    </div>
  )
}

function ComparisonItem({
  positive,
  warning = false,
  label,
  value,
}: {
  positive: boolean
  warning?: boolean
  label: string
  value: string
}) {
  const Icon = positive ? Check : warning ? Sparkles : X

  return (
    <li className="flex items-start gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0">
      <Icon
        className={
          positive
            ? 'mt-0.5 h-5 w-5 shrink-0 text-success'
            : warning
              ? 'mt-0.5 h-5 w-5 shrink-0 text-warning'
              : 'mt-0.5 h-5 w-5 shrink-0 text-destructive'
        }
        strokeWidth={positive ? 3 : 2.5}
        aria-hidden
      />
      <div>
        <strong className="block text-body-md text-foreground">{label}</strong>
        <span className="text-body-sm text-muted-foreground">{value}</span>
      </div>
    </li>
  )
}

function SimButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'min-w-[150px] flex-1 rounded-2xl border-2 border-primary bg-primary px-5 py-3 font-bold text-primary-foreground shadow-elevation-3 transition-all duration-normal'
          : 'min-w-[150px] flex-1 rounded-2xl border border-border bg-card px-5 py-3 font-bold text-muted-foreground transition-all duration-normal hover:bg-muted'
      }
    >
      {children}
    </button>
  )
}

function DashboardPreview({ t }: { t: (key: string) => string }) {
  const cards = ['triangles', 'order', 'fractions'] as const

  return (
    <div className="bg-muted/30 p-card-padding-sm md:p-card-padding-lg">
      <div className="mb-8 text-center">
        <h3 className="mb-1 text-display-sm font-extrabold text-foreground">
          {t('simulation.dashboard.title')}
        </h3>
        <div className="relative mx-auto mt-2 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[3%] rounded-full bg-primary" />
          <span className="absolute left-2 -top-1.5 text-[9px] font-bold text-muted-foreground">
            {t('simulation.dashboard.progress')}
          </span>
        </div>
      </div>

      <div className="mb-8 flex flex-col items-center justify-between gap-content-gap rounded-3xl border border-border bg-card p-card-padding shadow-elevation-1 md:flex-row">
        <div className="flex items-center gap-content-gap">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Play className="h-6 w-6 fill-current" aria-hidden />
          </div>
          <div>
            <p className="text-body-sm font-bold text-primary">
              {t('simulation.dashboard.triangles.badge')}
            </p>
            <h4 className="text-heading-xl font-extrabold text-foreground">
              {t('simulation.dashboard.triangles.title')}
            </h4>
            <p className="text-body-sm text-muted-foreground">
              {t('simulation.dashboard.triangles.status')}
            </p>
          </div>
        </div>
        <Link
          href="/start"
          className="self-stretch rounded-2xl bg-primary px-8 py-3 text-center font-bold text-primary-foreground shadow-elevation-3 transition-all duration-normal hover:bg-primary/90 md:self-auto"
        >
          {t('hero.trialCta')}
        </Link>
      </div>

      <div className="grid gap-content-gap-lg text-start md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card}
            className="rounded-2xl border border-border bg-card p-5 shadow-elevation-1"
          >
            <div className="mb-4 flex items-start justify-between gap-content-gap-sm">
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-body-xs font-bold text-success">
                {t(`simulation.dashboard.${card}.badge`)}
              </span>
            </div>
            <h5 className="mb-2 text-body-lg font-bold text-foreground">
              {t(`simulation.dashboard.${card}.title`)}
            </h5>
            <p className="text-body-xs text-muted-foreground">
              {t(`simulation.dashboard.${card}.status`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="grid min-h-[500px] grid-cols-1 bg-muted/30 lg:grid-cols-12">
      <div className="flex flex-col gap-content-gap border-border bg-card p-card-padding-sm lg:col-span-5 lg:border-e">
        <MessageBubble label={t('simulation.chat.teacher')} tone="primary">
          {t('simulation.chat.message')}
        </MessageBubble>
        <MessageBubble label={t('simulation.chat.feedback')} tone="success">
          {t('simulation.chat.feedback')}
        </MessageBubble>
      </div>

      <div className="p-card-padding lg:col-span-7">
        <span className="mb-1 block text-body-xs font-bold uppercase text-muted-foreground">
          {t('simulation.tabs.chat')}
        </span>
        <h3 className="mb-6 text-body-lg font-bold text-foreground">
          {t('simulation.chat.exerciseTitle')}
        </h3>
        <div className="my-4 w-full rounded-3xl border border-border bg-card p-card-padding text-center shadow-elevation-1">
          <NumberLine />
        </div>
        <Link
          href="/start"
          className="inline-block rounded-2xl bg-success px-6 py-3 font-bold text-success-foreground shadow-elevation-3"
        >
          {t('simulation.chat.next')}
        </Link>
      </div>
    </div>
  )
}

function NotebookPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="grid min-h-[500px] grid-cols-1 bg-muted/30 lg:grid-cols-12">
      <div className="flex flex-col justify-between border-border bg-card p-card-padding-sm lg:col-span-5 lg:border-e">
        <MessageBubble label={t('simulation.chat.teacher')} tone="primary">
          {t('simulation.notebook.prompt')}
        </MessageBubble>
      </div>

      <div className="p-card-padding lg:col-span-7">
        <div className="rounded-3xl border border-border bg-card p-card-padding shadow-elevation-1">
          <div className="mb-4 flex items-center gap-content-gap-xs text-muted-foreground">
            <NotebookTabs className="h-5 w-5 text-primary" />
            <span className="text-body-sm font-bold">{t('simulation.notebook.title')}</span>
          </div>
          <div className="h-60 rounded-2xl border border-dashed border-border bg-muted/40 p-card-padding-sm">
            <div className="mx-auto h-full max-w-sm rounded-full border-2 border-primary/70" />
          </div>
          <p className="mt-4 rounded-2xl bg-success/10 p-card-padding-sm text-body-sm font-bold text-success">
            {t('simulation.notebook.feedback')}
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'primary' | 'success'
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-card-padding-sm text-start">
      <div className="mb-3 flex items-center gap-content-gap-xs">
        <div
          className={
            tone === 'primary'
              ? 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'
              : 'flex h-6 w-6 items-center justify-center rounded-full bg-success text-[10px] font-bold text-success-foreground'
          }
        >
          {tone === 'primary' ? 'A' : '✓'}
        </div>
        <span className="text-body-xs font-bold text-muted-foreground">{label}</span>
      </div>
      <p className="text-body-sm font-bold leading-relaxed text-foreground">{children}</p>
    </div>
  )
}

function NumberLine() {
  const values = ['-5', '-4', '-3', '-2', '-1', '0', '1', '2']

  return (
    <div className="relative mx-auto flex max-w-xl items-center justify-between border-t-2 border-border pt-4">
      {values.map((value) => (
        <div key={value} className="relative flex flex-col items-center gap-content-gap-xs">
          <span className="absolute -top-[25px] h-3 w-0.5 bg-border" />
          <span className="text-body-sm font-bold text-muted-foreground">{value}</span>
          {value === '-3' || value === '-1' || value === '2' ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-body-xs font-bold text-primary-foreground shadow-elevation-3">
              {value === '-3' ? 'A' : value === '-1' ? 'B' : 'C'}
            </span>
          ) : (
            <span className="h-7 w-7" />
          )}
        </div>
      ))}
    </div>
  )
}
