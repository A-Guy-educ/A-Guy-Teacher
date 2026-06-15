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
  Plus,
  Sparkles,
  Star,
  Table2,
  UserRound,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

type SimTab = 'dashboard' | 'chat' | 'notebook'

const comparisonRows = [
  'personal',
  'plan',
  'experience',
  'emotional',
  'cost',
  'availability',
] as const
const featureKeys = ['lessons', 'exercises', 'exams', 'teacher', 'plan', 'emotional'] as const
const storyStats = ['experience', 'hours', 'exercises', 'lessons', 'research'] as const

const featureIcons = {
  lessons: BookOpen,
  exercises: Table2,
  exams: ClipboardCheck,
  teacher: MessageCircle,
  plan: CalendarDays,
  emotional: Star,
} as const

const featureIconClasses = {
  lessons: 'text-[#91262C]',
  exercises: 'text-blue-400',
  exams: 'text-[#5D725B]',
  teacher: 'text-purple-400',
  plan: 'text-amber-400',
  emotional: 'text-pink-400',
} as const

export function DemoLandingPage() {
  const [activeTab, setActiveTab] = useState<SimTab>('dashboard')

  useEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])

  return (
    <main
      dir="rtl"
      className="demo-landing w-full overflow-x-hidden bg-[#F9FAFB] font-['Assistant',sans-serif] text-gray-800 selection:bg-[#91262C]/20 selection:text-[#91262C]"
    >
      <style jsx global>{`
        .demo-landing {
          --landing-bg: #f9fafb;
          --landing-surface: #ffffff;
          --landing-surface-soft: #f9fafb;
          --landing-surface-muted: #f3f4f6;
          --landing-text: #111827;
          --landing-text-soft: #374151;
          --landing-muted: #6b7280;
          --landing-muted-strong: #4b5563;
          --landing-border: #e5e7eb;
          --landing-border-soft: #f3f4f6;
          --landing-red: #91262c;
          --landing-red-hover: #7f1d1d;
          --landing-red-soft: #f5e6e8;
          --landing-green: #5d725b;
          --landing-green-soft: #eaefea;
          --landing-dark: #111827;
          --landing-dark-deep: #030712;
          --landing-dark-card: #1f2937;
          --landing-dark-card-2: #111827;
          --landing-dark-border: #374151;
          --landing-glow: rgba(145, 38, 44, 0.3);
          --landing-browser-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
        }

        html[data-theme='dark'] .demo-landing {
          --landing-bg: #11100f;
          --landing-surface: #181716;
          --landing-surface-soft: #201f1d;
          --landing-surface-muted: #262420;
          --landing-text: #fff7ec;
          --landing-text-soft: #eee1d3;
          --landing-muted: #cbbdaf;
          --landing-muted-strong: #e3d6c8;
          --landing-border: rgba(255, 247, 236, 0.16);
          --landing-border-soft: rgba(255, 247, 236, 0.1);
          --landing-red: #d06a73;
          --landing-red-hover: #e18089;
          --landing-red-soft: rgba(208, 106, 115, 0.18);
          --landing-green: #a8b79f;
          --landing-green-soft: rgba(168, 183, 159, 0.18);
          --landing-dark: #11100f;
          --landing-dark-deep: #0b0a09;
          --landing-dark-card: #1b1917;
          --landing-dark-card-2: #121110;
          --landing-dark-border: rgba(255, 247, 236, 0.16);
          --landing-glow: rgba(208, 106, 115, 0.22);
          --landing-browser-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
        }

        .demo-landing,
        .demo-landing .bg-\\[\\#F9FAFB\\] {
          background-color: var(--landing-bg) !important;
          color: var(--landing-text-soft);
        }

        .demo-landing .landing-hero,
        .demo-landing .landing-simulation {
          background-color: var(--landing-surface) !important;
          border-color: var(--landing-border) !important;
        }

        .demo-landing .landing-comparison {
          background-color: var(--landing-bg) !important;
        }

        .demo-landing .landing-features {
          background-color: var(--landing-dark-deep) !important;
        }

        .demo-landing .landing-cta {
          background-color: var(--landing-red) !important;
        }

        .demo-landing .landing-cta-primary {
          background-color: #fff7ec !important;
          color: #91262c !important;
          box-shadow: 0 18px 40px rgba(55, 16, 19, 0.18) !important;
        }

        .demo-landing .landing-cta-primary:hover {
          background-color: #ffffff !important;
        }

        .demo-landing .landing-cta-secondary {
          background-color: rgba(255, 255, 255, 0.12) !important;
          border-color: rgba(255, 255, 255, 0.42) !important;
          color: #ffffff !important;
        }

        .demo-landing .landing-cta-secondary:hover {
          background-color: rgba(255, 255, 255, 0.2) !important;
        }

        .demo-landing .bg-white,
        .demo-landing [class*='to-white'] {
          background-color: var(--landing-surface) !important;
        }

        .demo-landing .bg-gray-50,
        .demo-landing .bg-gray-50\\/50 {
          background-color: var(--landing-surface-soft) !important;
        }

        .demo-landing .bg-gray-100 {
          background-color: var(--landing-surface-muted) !important;
        }

        .demo-landing .bg-gray-900,
        .demo-landing [class*='from-gray-900'],
        .demo-landing [class*='via-gray-900'],
        .demo-landing [class*='to-gray-950'] {
          background-color: var(--landing-dark-deep) !important;
        }

        .demo-landing .from-gray-800,
        .demo-landing .bg-gray-800\\/50,
        .demo-landing .bg-gray-700 {
          background-color: var(--landing-dark-card) !important;
        }

        .demo-landing .to-gray-900 {
          --tw-gradient-to: var(--landing-dark-card-2) var(--tw-gradient-to-position) !important;
        }

        .demo-landing .text-gray-900,
        .demo-landing .text-gray-800 {
          color: var(--landing-text) !important;
        }

        .demo-landing .text-gray-700,
        .demo-landing .text-gray-600 {
          color: var(--landing-text-soft) !important;
        }

        .demo-landing .text-gray-500,
        .demo-landing .text-gray-400,
        .demo-landing .text-gray-300 {
          color: var(--landing-muted) !important;
        }

        .demo-landing .border-gray-50,
        .demo-landing .border-gray-100,
        .demo-landing .border-gray-200,
        .demo-landing .border-gray-300 {
          border-color: var(--landing-border-soft) !important;
        }

        .demo-landing .border-gray-700,
        .demo-landing .border-gray-700\\/60 {
          border-color: var(--landing-dark-border) !important;
        }

        .demo-landing .border-b,
        .demo-landing .border-t,
        .demo-landing .border-l {
          border-color: var(--landing-border) !important;
        }

        .demo-landing [class*='bg-[#91262C]'] {
          background-color: var(--landing-red) !important;
        }

        .demo-landing [class*='text-[#91262C]'] {
          color: var(--landing-red) !important;
        }

        .demo-landing [class*='border-[#91262C]'] {
          border-color: var(--landing-red) !important;
        }

        .demo-landing [class*='bg-[#5D725B]'] {
          background-color: var(--landing-green) !important;
        }

        .demo-landing [class*='text-[#5D725B]'] {
          color: var(--landing-green) !important;
        }

        .demo-landing [class*='border-[#5D725B]'] {
          border-color: color-mix(in srgb, var(--landing-green) 40%, transparent) !important;
        }

        .demo-landing [class*='bg-[#EAEFEA]'],
        .demo-landing .bg-green-100 {
          background-color: var(--landing-green-soft) !important;
        }

        .demo-landing .text-green-700,
        .demo-landing .text-green-600 {
          color: var(--landing-green) !important;
        }

        .demo-landing [class*='from-[#EAEFEA]'] {
          --tw-gradient-from: var(--landing-green-soft) var(--tw-gradient-from-position) !important;
          --tw-gradient-to: color-mix(in srgb, var(--landing-green-soft) 0%, transparent)
            var(--tw-gradient-to-position) !important;
        }

        .demo-landing [class*='bg-[#F5E6E8]'],
        .demo-landing .bg-red-100 {
          background-color: var(--landing-red-soft) !important;
        }

        .demo-landing [class*='from-[#F5E6E8]'],
        .demo-landing .from-red-50\\/40 {
          --tw-gradient-from: var(--landing-red-soft) var(--tw-gradient-from-position) !important;
          --tw-gradient-to: color-mix(in srgb, var(--landing-red-soft) 0%, transparent)
            var(--tw-gradient-to-position) !important;
        }

        .demo-landing [class*='from-[#91262C]'] {
          --tw-gradient-from: var(--landing-red) var(--tw-gradient-from-position) !important;
          --tw-gradient-to: color-mix(in srgb, var(--landing-red) 0%, transparent)
            var(--tw-gradient-to-position) !important;
        }

        .demo-landing [class*='to-[#b3333b]'] {
          --tw-gradient-to: var(--landing-red-hover) var(--tw-gradient-to-position) !important;
        }

        .demo-landing [class*='from-aguy'],
        .demo-landing .shadow-\\[0_20px_50px_rgba\\(0\\,0\\,0\\,0\\.1\\)\\] {
          box-shadow: var(--landing-browser-shadow) !important;
        }

        .demo-landing .bg-dots {
          background-image: radial-gradient(var(--landing-border) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .demo-landing .bg-math-grid {
          background-color: var(--landing-surface);
          background-image:
            linear-gradient(to right, var(--landing-border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--landing-border) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        html[data-theme='dark'] .demo-landing .landing-comparison,
        html[data-theme='dark'] .demo-landing .landing-simulation {
          background-color: var(--landing-bg) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-comparison .bg-white,
        html[data-theme='dark'] .demo-landing .landing-comparison [class*='to-white'],
        html[data-theme='dark'] .demo-landing .landing-simulation .bg-white,
        html[data-theme='dark'] .demo-landing .landing-simulation [class*='to-white'] {
          background-color: var(--landing-surface) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-comparison [class*='from-[#EAEFEA]'],
        html[data-theme='dark'] .demo-landing .landing-simulation [class*='from-[#EAEFEA]'] {
          --tw-gradient-from: var(--landing-green-soft) var(--tw-gradient-from-position) !important;
          --tw-gradient-to: var(--landing-surface) var(--tw-gradient-to-position) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-simulation .bg-gray-50,
        html[data-theme='dark'] .demo-landing .landing-simulation .bg-gray-50\\/50 {
          background-color: var(--landing-surface-soft) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-simulation .bg-gray-900,
        html[data-theme='dark'] .demo-landing .landing-simulation .from-gray-800,
        html[data-theme='dark'] .demo-landing .landing-simulation .to-gray-900 {
          background-color: var(--landing-dark-card-2) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-simulation-frame {
          border-color: rgba(255, 247, 236, 0.2) !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(208, 106, 115, 0.12), transparent 34%), #12100f !important;
          box-shadow:
            0 26px 80px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-browser-bar {
          border-color: rgba(255, 247, 236, 0.12) !important;
          background-color: #211f1c !important;
        }

        html[data-theme='dark'] .demo-landing .landing-url-pill {
          background-color: #0f0e0d !important;
          color: #d8cabd !important;
          box-shadow: inset 0 0 0 1px rgba(255, 247, 236, 0.1) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-dashboard-preview {
          background:
            linear-gradient(180deg, rgba(255, 247, 236, 0.04), transparent 42%), #171513 !important;
        }

        html[data-theme='dark'] .demo-landing .landing-dashboard-progress {
          background-color: rgba(255, 247, 236, 0.16) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-dashboard-progress-label {
          color: #f1dfcb !important;
          text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
        }

        html[data-theme='dark'] .demo-landing .landing-dashboard-continue {
          border-color: rgba(208, 106, 115, 0.42) !important;
          background:
            linear-gradient(90deg, rgba(208, 106, 115, 0.22), rgba(255, 247, 236, 0.07)), #211f1c !important;
          box-shadow:
            0 18px 42px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-dashboard-play {
          background-color: rgba(208, 106, 115, 0.22) !important;
          color: #f09aa2 !important;
        }

        html[data-theme='dark'] .demo-landing .landing-dashboard-card {
          border-color: rgba(255, 247, 236, 0.12) !important;
          background-color: #11100f !important;
          box-shadow:
            0 18px 40px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
        }

        html[data-theme='dark'] .demo-landing .landing-card-progress {
          border-color: rgba(255, 247, 236, 0.18) !important;
          color: #efe1d1 !important;
        }

        .demo-landing .landing-cta .landing-cta-primary,
        html[data-theme='dark'] .demo-landing .landing-cta .landing-cta-primary {
          background-color: #fff7ec !important;
          color: #91262c !important;
        }

        .demo-landing .landing-cta .landing-cta-primary:hover,
        html[data-theme='dark'] .demo-landing .landing-cta .landing-cta-primary:hover {
          background-color: #ffffff !important;
        }

        .demo-landing .landing-cta .landing-cta-secondary,
        html[data-theme='dark'] .demo-landing .landing-cta .landing-cta-secondary {
          background-color: rgba(255, 255, 255, 0.12) !important;
          border-color: rgba(255, 255, 255, 0.42) !important;
          color: #ffffff !important;
        }
      `}</style>
      <Hero />
      <Comparison />
      <KnowledgeAndFeatures />
      <Simulation activeTab={activeTab} onTabChange={setActiveTab} />
      <BottomCta />
    </main>
  )
}

function Hero() {
  return (
    <section className="landing-hero relative flex min-h-[80vh] flex-col items-center overflow-hidden border-b border-gray-100 bg-white px-4 pb-20 pt-16 text-center">
      <div className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-full max-w-5xl -translate-x-1/2 rounded-full bg-gradient-to-b from-[#F5E6E8]/40 to-transparent opacity-80 blur-3xl" />

      <div className="relative z-10 mx-auto mt-8 flex w-full max-w-4xl flex-col items-center">
        <LogoMark />

        <div className="mb-6 inline-flex items-center gap-content-gap-xs rounded-full border border-[#5D725B]/20 bg-[#EAEFEA]/50 px-4 py-2 text-body-sm font-bold text-[#5D725B]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#5D725B]" />
          הדור הבא של הלמידה כבר כאן
        </div>

        <h1 className="mb-6 text-display-md font-extrabold leading-[1.1] tracking-tight text-gray-900 md:text-6xl lg:text-7xl">
          ממש כמו <span className="text-[#91262C]">מורה פרטי</span>
          <span className="mt-3 block text-heading-xl font-bold text-gray-500 md:mt-4 md:text-display-sm lg:text-display-md">
            רק זמין יותר, משתלם יותר ומותאם בדיוק בשבילך
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-body-lg font-medium leading-relaxed text-gray-600 md:text-heading-xl">
          לא משנה מה מצבכם כרגע, עם <span className="font-bold text-gray-900">Aguy</span> אפשר
          להתחיל כל למידת מתמטיקה ממש מאפס. פלטפורמה אישית המשמשת כ{' '}
          <span className="font-bold text-[#91262C]">מורה פרטי לכל דבר</span>: מאבחנת, מלמדת, מעודדת
          למידה עצמית ומעדכנת את הסטטוס בצורה עקבית.
        </p>

        <div className="flex w-full max-w-md flex-col gap-content-gap sm:flex-row sm:justify-center">
          <Link
            href="/start"
            className="flex flex-1 items-center justify-center gap-content-gap-xs rounded-xl border-2 border-[#91262C] bg-[#91262C] px-8 py-section-xs text-body-lg font-bold text-white shadow-card-hover shadow-red-900/20 transition-all hover:-translate-y-1 hover:bg-red-900 hover:shadow-2xl"
          >
            מסלולים והרשמה
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href="/start"
            className="flex flex-1 items-center justify-center gap-content-gap-xs rounded-xl border-2 border-[#5D725B]/30 bg-white px-8 py-section-xs text-body-lg font-bold text-[#5D725B] shadow-elevation-1 transition-all hover:-translate-y-1 hover:border-[#5D725B] hover:shadow-card-hover"
          >
            ניסיון (חינם)
          </Link>
        </div>

        <Link
          href="/start"
          className="mt-6 text-body-sm font-medium text-gray-500 underline underline-offset-4 transition-colors hover:text-[#91262C]"
        >
          כבר מנויים? היכנסו למערכת
        </Link>
      </div>
    </section>
  )
}

function Comparison() {
  return (
    <section className="landing-comparison relative bg-[#F9FAFB] px-4 py-section-xl">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-display-sm font-extrabold text-gray-900 md:text-display-lg">
            כל מה שטוב במורה פרטי. <span className="text-[#5D725B]">רק טוב יותר.</span>
          </h2>
          <p className="mx-auto max-w-2xl text-heading-xl text-gray-600">
            לקחנו את החוויה של שיעור פרטי - יחס אישי, הבנת הקשיים והכוונה צמודה - והפכנו אותה
            לטכנולוגיה חכמה ונגישה.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-content-gap-xl md:grid-cols-2">
          <ComparisonCard
            title="מערכת Aguy"
            icon={<Bot className="h-6 w-6" />}
            highlighted
            badge="הפתרון החכם והמשתלם"
          >
            {comparisonRows.map((row) => (
              <ComparisonItem
                key={row}
                positive
                label={comparisonText[row].label}
                value={comparisonText[row].aguyValue}
                note={comparisonText[row].aguyNote}
                last={row === 'availability'}
              />
            ))}
          </ComparisonCard>

          <ComparisonCard title="מורה פרטי רגיל" icon={<UserRound className="h-6 w-6" />}>
            {comparisonRows.map((row) => (
              <ComparisonItem
                key={row}
                positive={comparisonText[row].tutorPositive}
                warning={Boolean('warning' in comparisonText[row] && comparisonText[row].warning)}
                label={comparisonText[row].label}
                value={comparisonText[row].tutorValue}
                note={comparisonText[row].tutorNote}
                last={row === 'availability'}
              />
            ))}
          </ComparisonCard>
        </div>
      </div>
    </section>
  )
}

function KnowledgeAndFeatures() {
  return (
    <section className="landing-features relative overflow-hidden bg-gray-900 bg-dots px-4 py-section-xl text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900/95 to-gray-950" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-16 grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-3 font-bold text-[#5D725B]">איך נוצר Aguy?</p>
            <h2 className="mb-6 text-display-sm font-extrabold leading-tight md:text-display-lg">
              ידע אנושי שהומר לטכנולוגיה.
              <br />
              <span className="text-gray-500">לא עוד אלגוריתם קר.</span>
            </h2>
            <p className="text-body-lg leading-relaxed text-gray-300">
              מתוך מודעות גבוהה לרגישות ולשוני בין התלמידים, יצרנו פלטפורמה שמביאה לידי ביטוי עשרות
              אלפי שעות לימוד פרטניות וקבוצתיות כדי לתת מענה אישי לכל אחד ואחת.
            </p>
            <div className="mt-8 rounded-2xl border border-gray-700/60 bg-gray-800/50 p-5 backdrop-blur">
              <h3 className="mb-2 font-bold text-white">גישה רגישה ומותאמת:</h3>
              <p className="text-body-sm text-gray-400">
                המערכת מזהה קשיים ותסכולים בזמן אמת, ומציעה הכוונה חמה ומעודדת בדיוק ברגע הנכון.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-content-gap">
            {storyStats.map((key, index) => (
              <div
                key={key}
                className={
                  index === 4
                    ? 'rounded-2xl border border-gray-700/60 bg-gray-800/50 p-5 backdrop-blur sm:col-span-2'
                    : 'rounded-2xl border border-gray-700/60 bg-gray-800/50 p-5 backdrop-blur'
                }
              >
                <p className="mb-1 text-display-sm font-black text-white">{storyText[key].value}</p>
                <p className="text-body-sm font-semibold text-gray-400">{storyText[key].label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-800 pt-20">
          <div className="mb-12 text-center">
            <h3 className="mb-4 text-display-sm font-bold md:text-display-md">
              אז מה המערכת כוללת?
            </h3>
            <p className="mx-auto max-w-2xl text-body-lg text-gray-400">
              מעטפת לימודית שלמה שסוגרת את כל הפינות, מהיסודות ועד ההרחבה.
            </p>
          </div>

          <div className="grid gap-content-gap-lg md:grid-cols-2 lg:grid-cols-3">
            {featureKeys.map((key) => {
              const Icon = featureIcons[key]

              return (
                <div
                  key={key}
                  className="rounded-3xl border border-gray-700 bg-gradient-to-b from-gray-800 to-gray-900 p-card-padding-lg transition-colors hover:border-gray-500"
                >
                  <div
                    className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gray-700 ${featureIconClasses[key]}`}
                  >
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h4 className="mb-2 text-display-xl font-bold text-white">
                    {featureText[key].title}
                  </h4>
                  <p className="text-gray-400">{featureText[key].description}</p>
                </div>
              )
            })}
          </div>

          <div className="relative mt-24 overflow-hidden rounded-3xl border border-[#91262C]/30 bg-gradient-to-l from-[#91262C]/20 to-transparent p-card-padding-lg text-center md:p-12">
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-[#91262C] opacity-30 blur-3xl" />
            <h4 className="mb-3 text-display-xl font-extrabold text-white md:text-display-sm">
              שיטת לימוד ייחודית
            </h4>
            <p className="mx-auto mb-6 max-w-3xl text-body-lg font-medium leading-relaxed text-gray-300">
              שנוצרה משנים של ניסיון בשיעורים פרטיים, פיתוח תוכניות למידה ויצירת חומרי למידה.
            </p>
            <div className="mx-auto inline-flex max-w-2xl flex-col items-center gap-content-gap-xs rounded-2xl border border-white/10 bg-white/5 px-6 py-section-xs">
              <span className="text-body-md font-extrabold text-[#5D725B] md:text-body-lg">
                בסיס השיטה - הקניית יכולות למידה עצמיות
              </span>
              <span className="text-body-sm text-gray-400">
                למידה מתוך חקר וגילוי, תרגול מותאם אישית ושיטות בדיקה ייחודיות.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Simulation({
  activeTab,
  onTabChange,
}: {
  activeTab: SimTab
  onTabChange: (tab: SimTab) => void
}) {
  return (
    <section
      id="simulations-section"
      className="landing-simulation relative overflow-hidden border-b border-gray-100 bg-white py-section-xl"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 className="mb-6 text-display-sm font-extrabold text-gray-900 md:text-display-lg">
            למידה שעובדת.
            <br />
            לפי תוכנית משרד החינוך.
          </h2>
          <p className="mx-auto max-w-2xl text-body-lg text-gray-500">
            חוו את מערכת הלמידה במבט חטוף! לחצו על הטאבים למטה כדי להתרשם מאזור השיעורים, הצ'אט
            המלווה והמחברת הדיגיטלית האינטראקטיבית.
          </p>
        </div>

        <div className="mx-auto mb-8 flex max-w-3xl flex-wrap justify-center gap-3">
          <SimButton active={activeTab === 'dashboard'} onClick={() => onTabChange('dashboard')}>
            1. לוח שיעורים (כיתה ז׳)
          </SimButton>
          <SimButton active={activeTab === 'chat'} onClick={() => onTabChange('chat')}>
            2. צ'אט ותרגול מודרך
          </SimButton>
          <SimButton active={activeTab === 'notebook'} onClick={() => onTabChange('notebook')}>
            3. מחברת רישום חכמה
          </SimButton>
        </div>

        <div className="relative mx-auto w-full max-w-5xl">
          <div
            className="absolute -inset-4 bg-gradient-to-r from-[#F5E6E8] to-[#EAEFEA] opacity-40 blur-xl"
            style={{ borderRadius: '3rem' }}
          />
          <div className="landing-simulation-frame relative flex min-h-[580px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
            <div className="landing-browser-bar flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-section-xs">
              <div className="flex gap-content-gap-xs">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="landing-url-pill flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-mono text-[11px] text-gray-400 shadow-elevation-1">
                app.aguy.co.il/math/dashboard
              </div>
            </div>

            {activeTab === 'dashboard' && <DashboardPreview />}
            {activeTab === 'chat' && <ChatPreview />}
            {activeTab === 'notebook' && <NotebookPreview />}
          </div>
        </div>
      </div>
    </section>
  )
}

function BottomCta() {
  return (
    <section className="landing-cta bg-[#91262C] px-4 py-20 text-center text-white">
      <h2 className="mb-4 text-display-sm font-extrabold md:text-display-lg">
        כל אחד יכול ללמוד מתמטיקה לבד.
      </h2>
      <p className="mb-8 text-heading-xl text-white/80">זה הזמן להתחיל.</p>
      <div className="flex flex-col justify-center gap-content-gap sm:flex-row">
        <Link
          href="/start"
          className="landing-cta-primary rounded-xl bg-white px-8 py-section-xs text-body-lg font-bold text-[#91262C] shadow-card-hover transition-all hover:-translate-y-1 hover:shadow-2xl"
        >
          הצטרפו עכשיו
        </Link>
        <Link
          href="/start"
          className="landing-cta-secondary rounded-xl border border-white/30 bg-white/10 px-8 py-section-xs text-body-lg font-bold text-white transition-all hover:bg-white/20"
        >
          ניסיון חינם
        </Link>
      </div>
      <p className="mt-12 text-body-sm text-white/50">בקרוב: לא רק למתמטיקה</p>
    </section>
  )
}

function LogoMark() {
  return (
    <div className="mb-10 transition-transform duration-slower hover:scale-105">
      <svg
        aria-label="Aguy"
        className="h-[125px] w-[140px]"
        viewBox="0 0 224 204.055"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#91262C"
          d="M198.867,58.948h-30.566c-0.686,0-1.24-0.557-1.24-1.24v-30.57c0-0.686,0.558-1.24,1.24-1.24h30.566c0.688,0,1.24,0.558,1.24,1.24v30.567C200.107,58.392,199.553,58.948,198.867,58.948"
        />
        <path
          fill="#5D725B"
          d="M89.871,158.321l-6.215,22.424c9.441,1.965,19.189,2.074,28.654,0.266l-7.971-22.688H89.871V158.321z M96.25,135.3l-5.17,18.648h11.725L96.25,135.3z M147.166,88.743l-7.594,6.373c-0.486,0.407-1.217,0.346-1.627-0.145l-14.447-17.219c-0.408-0.488-0.348-1.216,0.143-1.627l7.596-6.373c0.486-0.408,1.216-0.348,1.627,0.143l14.449,17.22C147.719,87.603,147.656,88.332,147.166,88.743 M80.648,119.769l8.48,10.104c0.438,0.523,0.371,1.308-0.154,1.746l-22.109,18.555c-0.521,0.439-1.307,0.373-1.748-0.151l-8.479-10.104c-0.441-0.524-0.371-1.309,0.152-1.748l22.11-18.554C79.428,119.179,80.207,119.243,80.648,119.769 M150.08,57.945c-14.225-14.228-32.869-21.34-51.518-21.34c-18.646,0-37.293,7.112-51.521,21.34c-26.27,26.271-28.225,67.583-5.98,96.166l12.012-10.078c0.525-0.439,1.309-0.371,1.746,0.15l5.779,6.887c0.439,0.527,0.373,1.311-0.152,1.748l-11.664,9.787c8.953,8.389,19.496,14.078,30.627,17.104l14.145-51.029l-10.994-13.1c-0.439-0.527-0.371-1.311,0.152-1.748l37.562-31.521c0.524-0.438,1.307-0.37,1.746,0.154l11.035,13.146c0.438,0.525,0.37,1.311-0.152,1.747L97.82,126.796c0.025,0.035,0.053,0.066,0.074,0.104c0.051,0.086,0.086,0.182,0.125,0.27c0.016,0.037,0.039,0.068,0.053,0.107l0.008,0.027c0,0.002,0.002,0.004,0.006,0.008l18.502,52.668c12.268-3.121,23.896-9.4,33.498-19.004C178.533,132.526,178.533,86.397,150.08,57.945"
        />
      </svg>
    </div>
  )
}

function ComparisonCard({
  title,
  icon,
  highlighted = false,
  badge,
  children,
}: {
  title: string
  icon: ReactNode
  highlighted?: boolean
  badge?: string
  children: ReactNode
}) {
  return (
    <div
      className={
        highlighted
          ? 'relative z-10 flex flex-col justify-between rounded-3xl border-2 border-[#5D725B] bg-gradient-to-br from-[#EAEFEA]/60 to-white p-card-padding-lg shadow-card-hover'
          : 'flex flex-col justify-between rounded-3xl border border-gray-200 bg-white p-card-padding-lg opacity-90 shadow-elevation-1 transition-all duration-slow hover:shadow-elevation-3'
      }
    >
      {badge ? (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#91262C] px-6 py-1.5 text-body-sm font-bold text-white shadow-elevation-3">
          {badge}
        </div>
      ) : null}
      <div className="mb-8 flex items-center gap-content-gap">
        <div
          className={
            highlighted
              ? 'flex h-12 w-12 items-center justify-center rounded-full bg-[#5D725B] text-white shadow-elevation-3'
              : 'flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500'
          }
        >
          {icon}
        </div>
        <h3
          className={
            highlighted
              ? 'text-display-sm font-extrabold text-gray-900'
              : 'text-display-xl font-bold text-gray-500'
          }
        >
          {title}
        </h3>
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
  note,
  last = false,
}: {
  positive: boolean
  warning?: boolean
  label: string
  value: string
  note: string
  last?: boolean
}) {
  const Icon = positive ? Check : warning ? Sparkles : X

  return (
    <li className={`flex items-start gap-3 ${last ? '' : 'border-b border-gray-100 pb-3'}`}>
      <Icon
        className={
          positive
            ? 'mt-0.5 h-5 w-5 shrink-0 text-green-600'
            : warning
              ? 'mt-0.5 h-5 w-5 shrink-0 text-amber-500'
              : 'mt-0.5 h-5 w-5 shrink-0 text-red-500'
        }
        strokeWidth={positive ? 3 : 2.5}
        aria-hidden="true"
      />
      <div>
        <strong className="block text-body-md text-gray-900">{label}</strong>
        <span
          className={
            positive
              ? 'rounded bg-[#EAEFEA] px-2 py-0.5 text-body-sm font-extrabold text-green-700'
              : warning
                ? 'text-body-sm font-semibold text-amber-600'
                : 'text-body-sm font-semibold text-red-500'
          }
        >
          {value}
        </span>{' '}
        <span className="text-body-xs text-gray-600">{note}</span>
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
          ? 'min-w-[150px] flex-1 rounded-2xl border-2 border-[#91262C] bg-[#91262C] px-5 py-3 font-bold text-white shadow-elevation-3 transition-all duration-slow'
          : 'min-w-[150px] flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 transition-all duration-slow hover:bg-gray-50'
      }
    >
      {children}
    </button>
  )
}

function DashboardPreview() {
  return (
    <div className="landing-dashboard-preview flex-grow bg-gray-50/50 p-card-padding-sm md:p-card-padding-lg">
      <div className="mb-6 text-center">
        <h3 className="mb-1 text-display-xl font-extrabold text-gray-900 md:text-display-sm">
          כיתה ז׳
        </h3>
        <div className="landing-dashboard-progress relative mx-auto mt-2 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-[3%] rounded-full bg-blue-600" />
          <span className="landing-dashboard-progress-label absolute left-2 -top-1.5 text-[9px] font-bold text-gray-600">
            3% הושלמו
          </span>
        </div>
      </div>

      <div className="landing-dashboard-continue mb-8 flex flex-col items-center justify-between gap-content-gap rounded-3xl border border-red-100 bg-gradient-to-r from-red-50/40 to-white p-card-padding shadow-elevation-1 md:flex-row">
        <div className="flex items-center gap-content-gap">
          <div className="landing-dashboard-play flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[#91262C]">
            <Play className="h-6 w-6 fill-current" aria-hidden="true" />
          </div>
          <div>
            <p className="text-body-sm font-bold text-[#91262C]">המשך ללמוד</p>
            <h4 className="text-heading-xl font-extrabold text-gray-900">קטעים מיוחדים במשולש</h4>
            <p className="text-body-sm text-gray-500">50% הושלמו</p>
          </div>
        </div>
        <Link
          href="/start"
          className="self-stretch rounded-2xl bg-[#91262C] px-8 py-3 text-center font-bold text-white shadow-elevation-3 transition-all hover:bg-red-900 md:self-auto"
        >
          המשך שיעור
        </Link>
      </div>

      <div className="grid gap-content-gap-lg text-right md:grid-cols-3">
        {[
          ['שיעור 1', 'סדר פעולות חשבון'],
          ['שיעור 2', 'כפל שברים'],
          ['שיעור 3', 'חיבור וחיסור שברים'],
        ].map(([lesson, title]) => (
          <div
            key={title}
            className="landing-dashboard-card rounded-2xl border border-gray-100 bg-white p-5 shadow-elevation-1"
          >
            <div className="mb-4 flex items-start justify-between">
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-body-xs font-bold text-green-700">
                חדש
              </span>
              <span className="text-body-xs text-gray-400">{lesson}</span>
            </div>
            <h5 className="mb-2 text-body-lg font-bold text-gray-800">{title}</h5>
            <div className="mt-4 flex items-center gap-3 border-t border-gray-50 pt-4 text-body-xs text-gray-400">
              <div className="landing-card-progress flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-200 text-[10px] font-bold">
                0%
              </div>
              <span>עדיין לא התחלת</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatPreview() {
  return (
    <div className="grid min-h-[500px] flex-grow grid-cols-1 bg-gray-50 lg:grid-cols-12">
      <div className="flex flex-col justify-between border-l border-gray-200 bg-white p-card-padding-sm lg:col-span-5">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-card-padding-sm text-right">
            <div className="mb-3 flex items-center gap-content-gap-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#91262C] text-[10px] font-bold text-white">
                A
              </div>
              <span className="text-body-xs font-bold text-gray-500">Aguy - מורה דיגיטלי</span>
            </div>
            <p className="text-body-sm font-bold leading-relaxed text-gray-700">
              שלום! בוא נפתור ביחד את סעיף ב׳ של התרגיל. אנחנו צריכים למקם את הערכים החסרים על ציר
              המספרים בתמונה שמימין.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gradient-to-l from-[#EAEFEA]/40 to-white p-card-padding-sm text-right">
            <div className="mb-3 flex items-center gap-content-gap-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5D725B] text-[10px] font-bold text-white">
                ✓
              </div>
              <span className="text-body-xs font-bold text-gray-500">משוב למידה</span>
            </div>
            <p className="text-body-sm font-bold leading-relaxed text-gray-700">
              הצבה מעולה! הערכים שמיקמת מדויקים. מה לגבי הערך האחרון מימין?
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t border-gray-100 pt-3 text-right">
          <span className="mb-1 block text-[10px] font-bold text-gray-400">
            תגובות נפוצות בשיעור:
          </span>
          <Link
            href="/start"
            className="block w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-right text-body-xs text-gray-500"
          >
            אני רוצה לקבל רמז להמשך הפתרון.
          </Link>
          <Link
            href="/start"
            className="block w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-right text-body-xs text-gray-500"
          >
            מה קורה כאשר אנחנו עוברים את ה-0 ימינה?
          </Link>
        </div>
      </div>

      <div className="p-card-padding lg:col-span-7">
        <span className="mb-1 block text-body-xs font-bold uppercase tracking-wider text-gray-400">
          תרגול לדוגמה
        </span>
        <h3 className="mb-6 text-body-lg font-bold text-gray-800">
          סעיף ב׳: השלימו את המספרים החסרים בציר
        </h3>
        <div className="my-4 w-full rounded-3xl border border-gray-100 bg-white p-card-padding text-center shadow-elevation-1">
          <p className="mb-6 text-body-xs text-gray-400">מבט על הציר הפתור במערכת:</p>
          <NumberLine />
        </div>
        <Link
          href="/start"
          className="inline-block rounded-2xl bg-[#5D725B] px-6 py-3 font-bold text-white shadow-elevation-3"
        >
          תרגול הבא ←
        </Link>
      </div>
    </div>
  )
}

function NotebookPreview() {
  return (
    <div className="grid min-h-[500px] flex-grow grid-cols-1 bg-gray-50 lg:grid-cols-12">
      <div className="flex flex-col justify-between border-l border-gray-200 bg-white p-card-padding-sm lg:col-span-5">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-card-padding-sm text-right">
          <div className="mb-3 flex items-center gap-content-gap-xs">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#91262C] text-[10px] font-bold text-white">
              A
            </div>
            <span className="text-body-xs font-bold text-gray-500">Aguy - מורה דיגיטלי</span>
          </div>
          <p className="text-body-sm font-bold leading-relaxed text-gray-700">
            סרטטו את גרף הפונקציה: <span dir="ltr">y = -x² + 4</span>. לאחר מכן קבעו את שיעורי
            קודקוד הפרבולה.
          </p>
        </div>
      </div>
      <div className="p-card-padding lg:col-span-7">
        <div className="rounded-3xl border border-gray-100 bg-white p-card-padding shadow-elevation-1">
          <div className="mb-4 flex items-center gap-content-gap-xs text-gray-500">
            <NotebookTabs className="h-5 w-5 text-[#91262C]" />
            <span className="font-bold">מחברת רישום חכמה</span>
          </div>
          <div className="bg-math-grid grid h-72 place-items-center rounded-2xl border border-gray-200">
            <div className="relative h-44 w-56">
              <div className="absolute bottom-1/2 left-0 h-0.5 w-full bg-gray-400" />
              <div className="absolute left-1/2 top-0 h-full w-0.5 bg-gray-400" />
              <div className="absolute left-1/2 top-8 h-28 w-36 -translate-x-1/2 rounded-t-full border-4 border-[#91262C] border-b-0" />
              <span className="absolute right-4 top-8 rounded bg-white px-2 py-1 text-body-xs font-bold text-gray-600">
                y = -x² + 4
              </span>
            </div>
          </div>
          <p className="mt-4 rounded-2xl bg-[#EAEFEA]/60 p-card-padding-sm text-body-sm font-bold text-[#5D725B]">
            מצוין! כעת קבעו מה שיעורי קודקוד הפרבולה.
          </p>
        </div>
      </div>
    </div>
  )
}

function NumberLine() {
  const values = ['-5', '-4', '-3', '-2', '-1', '0', '1', '2']

  return (
    <div className="relative mx-auto flex max-w-xl items-center justify-between border-t-2 border-gray-300 pt-4">
      {values.map((value) => (
        <div key={value} className="relative flex flex-col items-center gap-content-gap-xs">
          <span className="absolute -top-[25px] h-3 w-0.5 bg-gray-300" />
          <span className="text-body-sm font-bold text-gray-500">{value}</span>
          {value === '-3' || value === '-1' || value === '2' ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#91262C] text-body-xs font-bold text-white shadow-elevation-3">
              {value === '-3' ? 'א׳' : value === '-1' ? 'ב׳' : 'ג׳'}
            </span>
          ) : (
            <span className="h-7 w-7" />
          )}
        </div>
      ))}
    </div>
  )
}

const comparisonText = {
  personal: {
    label: 'לימוד מותאם אישית',
    aguyValue: 'קיים ✔',
    aguyNote: '(איבחון, בקרה ומשוב - דינמי)',
    tutorValue: 'קיים ✔',
    tutorNote: '(מתקיים במהלך השעה הפרטית בלבד)',
    tutorPositive: true,
  },
  plan: {
    label: 'בניית תוכנית למידה',
    aguyValue: 'מובנה וממוקד ✔',
    aguyNote: '(מתמקד אך ורק במה שצריך לפי תוכנית משרד החינוך)',
    tutorValue: 'קיים ✔',
    tutorNote: '(תוכנית ידנית הנבנית מול המורה בשעה השבועית)',
    tutorPositive: true,
  },
  experience: {
    label: 'מקצועיות וניסיון',
    aguyValue: 'מקצועיות מובטחת ✔',
    aguyNote: '(מבוסס על 20+ שנות ניסיון הוראה וירטואלי משודרג)',
    tutorValue: 'לא תמיד',
    tutorNote: '(תלוי מאוד במציאת מורה איכותי, מנוסה ופנוי)',
    tutorPositive: false,
    warning: true,
  },
  emotional: {
    label: 'מענה ותמיכה רגשית',
    aguyValue: 'קיים במערכת ✔',
    aguyNote: '(המערכת יודעת לזהות תסכול ולעודד באופן אוטומטי)',
    tutorValue: 'יותר טוב (אך לא בכל מקרה) ✔',
    tutorNote: '(יכול להיות חם ומעולה - אך מוגבל לשעה השבועית)',
    tutorPositive: true,
  },
  cost: {
    label: 'עלות כספית',
    aguyValue: 'זול ומשתלם בהרבה',
    aguyNote: '(שבריר קטן מעלותו של שיעור פרטי בודד אחד)',
    tutorValue: 'יקרה מאוד',
    tutorNote: '(מאות שקלים לכל שעה בודדת, ללא גמישות)',
    tutorPositive: false,
  },
  availability: {
    label: 'זמינות למענה ושאילת שאלות',
    aguyValue: 'זמינות מלאה 24/7',
    aguyNote: '(פותרים בדיוק ברגע שנתקעים בשיעורי הבית, ללא הגבלה)',
    tutorValue: 'בקושי שעה בשבוע',
    tutorNote: '(רק בזמן שנקבע מראש, אין מענה כשנתקעים בבית)',
    tutorPositive: false,
  },
}

const storyText = {
  experience: { value: '20+', label: 'שנות ניסיון בלימוד פרסונלי' },
  hours: { value: '50K+', label: 'שיעורי לימוד פרסונלי וקבוצתי' },
  exercises: { value: '100K+', label: 'תרגילים' },
  lessons: { value: '1,000+', label: 'מערכי שיעור' },
  research: { value: 'אלפי שעות', label: 'מחקר של לימוד פרסונלי' },
}

const featureText = {
  lessons: {
    title: '1,000+ שיעורים',
    description: 'שיעורי תרגול ולימוד מעמיקים ומקיפים המסבירים את החומר ממש מאפס.',
  },
  exercises: {
    title: '100K+ תרגילים',
    description: 'מאגר עצום ומגוון המאפשר תרגול מקיף ומעמיק בכל נושא ובכל רמת קושי.',
  },
  exams: {
    title: '500+ בחינות',
    description: 'סימולציות ומבחנים מסכמים המדמים בחינות אמת כדי להגיע מוכנים ב-100%.',
  },
  teacher: {
    title: 'מורה מלווה צמוד',
    description: 'ליווי וירטואלי צמוד המדמה מורה אנושי שמסביר בפירוט היכן טעיתם וכיצד להשתפר.',
  },
  plan: {
    title: 'תוכנית למידה אישית',
    description: 'בניית לוח זמנים ממוקד ותפור אישית לפי תאריכי המבחנים והיעדים האישיים שלכם.',
  },
  emotional: {
    title: "פיצ'רים מיוחדים ומענה רגשי",
    description: 'אבחון חכם, משוב דינמי, מענה רגשי תומך ומעודד, ודוחות מעקב והתקדמות להורים.',
  },
}
