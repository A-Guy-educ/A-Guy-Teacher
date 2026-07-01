// @vitest-environment jsdom

/**
 * Regression guard for the /prep7 landing page.
 *
 * @fileType unit-test
 * @domain routes/prep7
 * @ai-summary Ensures the prep7 route keeps its course-specific funnel instead of
 *   collapsing into the shared homepage landing component.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const i18n = vi.hoisted(() => {
  const translations: Record<string, string> = {
    'brand.taglinePrimary': 'מותאם אישי',
    'brand.taglineSecondary': 'מורה פרטי',
    'hero.titleStart': 'הפעם!',
    'hero.titleHighlight': 'להגיע מוכן',
    'hero.newLabel': 'חדש!',
    'hero.subtitle': "קורס הכנה לכיתה ז' - מותאם לתלמיד",
    'hero.purchaseCta': 'לרכישה',
    'hero.trialCta': 'לניסיון (ללא עלות)',
    'story.title': 'מי זה Aguy?',
    'story.videoTitle': 'סרטון רקע על Aguy',
    'story.descriptionPrefix': 'מתוך ניסיון של למעלה מ-',
    'story.experience': '20 שנים',
    'story.descriptionSuffix': ', עשרות אלפי מפגשים עם תלמידים.',
    'courseFeatures.title': 'מה כולל הקורס?',
    'courseFeatures.description': 'בנינו תהליך מדורג, מהבסיס ועד לתרגילי אתגר.',
    'courseFeatures.previewVideoTitle': 'תצוגת מערכת Aguy בקורס',
    'courseFeatures.items.lessons.title': '50 מערכי שיעור מדויקים',
    'courseFeatures.items.lessons.description': 'שיעורי למידה ממוקדים.',
    'courseFeatures.items.practice.title': '30 שיעורי תרגול',
    'courseFeatures.items.practice.description': 'תרגול מעשי ואינטנסיבי.',
    'courseFeatures.items.exams.title': '10 בחינות סימולציה',
    'courseFeatures.items.exams.description': 'מבחנים המדמים את מבחני האמת.',
    'courseFeatures.items.support.title': 'תמיכה מלאה בכל שיעור',
    'courseFeatures.items.support.description': 'מורה AI צמוד.',
    'offer.title': 'הטבות והנחות',
    'offer.description': 'הצטרפו עכשיו והבטיחו את מקומכם.',
    'offer.badge': 'מבצע רישום מוקדם',
    'offer.priceLabel': 'הנחה מיוחדת לנרשמים',
    'offer.priceAmount': '100',
    'offer.priceCurrency': '₪',
    'offer.priceSuffix': 'הנחה',
    'offer.deadline': 'בתוקף לרישום עד ה-20.7 בלבד.',
    'offer.purchaseCta': 'מעבר לרכישה',
    'offer.bonusesTitle': 'בונוסים חינם לנרשמים:',
    'offer.bonuses.whatsapp.title': 'קבוצת וואטסאפ זמינה לשאלות',
    'offer.bonuses.whatsapp.description': 'ליווי צמוד ותמיכה מלאה.',
    'offer.bonuses.sessions.title': 'שיעורים פתוחים עם מורה',
    'offer.bonuses.sessions.description': 'מפגשי תגבור חיים.',
    'footer.copyright': '© 2024 Aguy. כל הזכויות שמורות.',
  }

  return {
    t: (key: string) => translations[key] ?? key,
  }
})

vi.mock('@/ui/web/providers/I18n', () => ({
  useLocale: () => 'he',
  useTranslations: () => i18n.t,
}))

vi.mock('@/ui/web/LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}))

vi.mock('@/ui/web/providers/Theme/ThemeSelector', () => ({
  ThemeSelector: () => null,
}))

import Prep7Page from '@/app/(frontend)/prep7/page'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '../../..')
const prep7Path = path.join(projectRoot, 'src/app/(frontend)/prep7/page.tsx')

describe('/prep7 landing page', () => {
  afterEach(() => {
    cleanup()
    document.body.className = ''
  })

  it('keeps the route-owned course funnel instead of rendering the shared homepage landing page', () => {
    const source = fs.readFileSync(prep7Path, 'utf8')

    expect(source).not.toContain('DemoLandingPage')
    expect(source).toContain("useTranslations('prep7')")
  })

  it('renders the reference page structure with course-specific copy and safe routes', () => {
    render(<Prep7Page />)

    expect(screen.getByRole('heading', { name: 'הפעם! להגיע מוכן' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'מי זה Aguy?' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'מה כולל הקורס?' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'הטבות והנחות' })).toBeTruthy()

    expect(screen.getByRole('link', { name: 'לרכישה' }).getAttribute('href')).toBe('/products')
    expect(screen.getByRole('link', { name: 'לניסיון (ללא עלות)' }).getAttribute('href')).toBe(
      '/start',
    )
    expect(screen.getByRole('link', { name: 'מעבר לרכישה' }).getAttribute('href')).toBe('/products')
  })

  it('uses the supplied demo video references for the story and laptop preview', () => {
    const { container } = render(<Prep7Page />)
    const iframeSources = Array.from(container.querySelectorAll('iframe')).map(
      (iframe) => iframe.src,
    )

    expect(iframeSources.some((src) => src.includes('EDbWunPa46M'))).toBe(true)
    expect(iframeSources.some((src) => src.includes('4BpyIiLs3jI'))).toBe(true)
  })
})
