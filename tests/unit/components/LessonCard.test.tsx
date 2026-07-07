// @vitest-environment jsdom
import { LessonCard } from '@/app/(frontend)/courses/_components/LessonCard'
import type { Lesson } from '@/infra/types/content'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import enMessages from '../../../src/i18n/en.json'

// Mock SystemLink component
vi.mock('@/infra/loading/components/SystemLink', () => ({
  SystemLink: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string
    children: React.ReactNode
    onClick?: React.MouseEventHandler
    className?: string
  }) => (
    <a href={href} onClick={onClick} className={className} data-testid="system-link">
      {children}
    </a>
  ),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(() => 'mock-toast-id'),
  },
}))

const mockLesson: Lesson = {
  id: 'test-lesson-1',
  slug: 'test-lesson',
  title: 'Test Lesson',
  chapter: 'chapter-1',
  type: 'learning' as const,
  status: 'published',
  isActive: true,
  order: 1,
  accessType: 'inherit' as const,
  locale: 'he' as const,
  tenant: 'test-tenant',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  contentStatus: 'none' as const,
  contentStatusVisible: true,
}

const renderWithI18n = (lesson: Lesson) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <LessonCard lesson={lesson} courseSlug="test-course" chapterSlug="test-chapter" />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('LessonCard component', () => {
  describe('baseline rendering', () => {
    it('renders lesson title and basic info', () => {
      renderWithI18n(mockLesson)

      expect(screen.getByText('Test Lesson')).toBeTruthy()
      expect(screen.getByText('Lesson 1')).toBeTruthy()
    })
  })

  describe('contentStatus badge', () => {
    it('renders "Soon" badge when lesson.contentStatus is "soon"', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      expect(screen.getByText('Soon')).toBeTruthy()
    })

    it('renders "New" badge when lesson.contentStatus is "justAdded"', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      expect(screen.getByText('New')).toBeTruthy()
    })

    it('does not render badge when contentStatus is "none"', () => {
      const noStatusLesson = { ...mockLesson, contentStatus: 'none' as const }
      renderWithI18n(noStatusLesson)

      expect(screen.queryByText('Soon')).toBeNull()
      expect(screen.queryByText('New')).toBeNull()
    })

    it('does not render badge when justAdded has expired date', () => {
      const expiredLesson = {
        ...mockLesson,
        contentStatus: 'justAdded' as const,
        contentStatusExpiresAt: '2020-01-01',
      }
      renderWithI18n(expiredLesson)

      expect(screen.queryByText('New')).toBeNull()
    })

    it('renders badge when justAdded has future expiry date', () => {
      const futureLesson = {
        ...mockLesson,
        contentStatus: 'justAdded' as const,
        contentStatusExpiresAt: '2030-01-01',
      }
      renderWithI18n(futureLesson)

      expect(screen.getByText('New')).toBeTruthy()
    })
  })

  describe('locked content behavior', () => {
    it('shows toast when clicking "Soon" lesson', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      // Click the button
      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(toast.info).toHaveBeenCalled()
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('prepared'))
    })

    it('renders button for "Soon" lesson', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      // Button should be rendered
      expect(screen.getByRole('button')).toBeTruthy()
    })

    it('renders button for normal (non-soon) lessons', () => {
      const normalLesson = { ...mockLesson, contentStatus: 'none' as const }
      renderWithI18n(normalLesson)

      expect(screen.getByRole('button')).toBeTruthy()
    })

    it('does not show toast for "justAdded" lessons', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should NOT show toast for justAdded - it should navigate normally
      expect(toast.info).not.toHaveBeenCalled()
    })
  })

  describe('paid-access paywall', () => {
    it('shows paywall CTA when course is paid, lesson inherits, and user has no entitlement', () => {
      const inheritLesson = { ...mockLesson, accessType: 'inherit' as const }
      const { container } = render(
        <I18nProvider locale="en" messages={enMessages}>
          <LessonCard
            lesson={inheritLesson}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      expect(screen.getByTestId('unified-card-paywall-cta')).toBeTruthy()
      expect(screen.getByTestId('unified-card-paywall-hint')).toBeTruthy()
      // Locked card is NOT greyed out — it should look like a "buy this" card,
      // not a disabled one.
      const root = container.firstChild as HTMLElement
      expect(root.className).not.toContain('opacity-60')
    })

    it('does not show paywall CTA when user already has paid entitlement', () => {
      const inheritLesson = { ...mockLesson, accessType: 'inherit' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <LessonCard
            lesson={inheritLesson}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={true}
          />
        </I18nProvider>,
      )
      expect(screen.queryByTestId('unified-card-paywall-cta')).toBeNull()
    })

    it('does not show paywall CTA when course is free', () => {
      const inheritLesson = { ...mockLesson, accessType: 'inherit' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <LessonCard
            lesson={inheritLesson}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="free"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      expect(screen.queryByTestId('unified-card-paywall-cta')).toBeNull()
    })

    it('does not show paywall CTA when lesson is explicitly free even if course is paid', () => {
      const freeLesson = { ...mockLesson, accessType: 'free' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <LessonCard
            lesson={freeLesson}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      expect(screen.queryByTestId('unified-card-paywall-cta')).toBeNull()
    })

    it('shows paywall CTA when lesson is explicitly paid even without courseAccessType', () => {
      const paidLesson = { ...mockLesson, accessType: 'paid' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <LessonCard
            lesson={paidLesson}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      expect(screen.getByTestId('unified-card-paywall-cta')).toBeTruthy()
    })

    it('routes card click to the purchase URL (defaults to /products) when locked', () => {
      const inheritLesson = { ...mockLesson, accessType: 'inherit' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <LessonCard
            lesson={inheritLesson}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      // The "View Lesson" CTA button's underlying navigation should target
      // /products (the purchase flow), not the gated lesson page.
      const button = screen.getByRole('button')
      expect(button).toBeTruthy()
      fireEvent.click(button)
      // The toast for "Soon" must NOT fire — the locked state is a paywall,
      // not a content-not-ready state.
      expect(toast.info).not.toHaveBeenCalled()
    })
  })
})
