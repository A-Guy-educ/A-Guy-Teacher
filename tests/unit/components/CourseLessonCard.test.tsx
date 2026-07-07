// @vitest-environment jsdom
import { CourseLessonCard } from '@/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard'
import type { Lesson } from '@/infra/types/content'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import enMessages from '../../../src/i18n/en.json'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(() => 'mock-toast-id'),
  },
}))

// Mock loadingManager
vi.mock('@/infra/loading/LoadingManager', () => ({
  loadingManager: { register: vi.fn() },
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
      <CourseLessonCard
        lesson={lesson}
        index={1}
        courseSlug="test-course"
        chapterSlug="test-chapter"
      />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('CourseLessonCard component', () => {
  describe('baseline rendering', () => {
    it('renders the lesson title as the heading and a separate "Lesson N" badge', () => {
      renderWithI18n(mockLesson)

      // Title comes from lesson.title; badge is "Lesson <index>". They must not collide.
      expect(screen.getByText('Test Lesson')).toBeTruthy()
      expect(screen.getByText('Lesson 1')).toBeTruthy()
    })
  })

  describe('contentStatus badge', () => {
    it('renders "Soon" badge for soon status', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      expect(screen.getByText('Soon')).toBeTruthy()
    })

    it('renders "New" badge for justAdded status', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      expect(screen.getByText('New')).toBeTruthy()
    })

    it('does not render badge when contentStatus is none/undefined', () => {
      // Use 'none' which is the default - this tests that the badge doesn't render
      const noStatusLesson = { ...mockLesson, contentStatus: 'none' as const }
      renderWithI18n(noStatusLesson)

      expect(screen.queryByText('Soon')).toBeNull()
      expect(screen.queryByText('New')).toBeNull()
    })
  })

  describe('locked content behavior', () => {
    it('prevents navigation on click when lesson is "Soon"', async () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      const link = screen.getByRole('link')
      fireEvent.click(link)

      expect(toast.info).toHaveBeenCalled()
      // Verify toast was called with the locked message
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('prepared'))
    })

    it('allows navigation for "Just Added" lesson', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      const link = screen.getByRole('link')
      fireEvent.click(link)

      // Should NOT show toast for justAdded - it should navigate normally
      expect(toast.info).not.toHaveBeenCalled()
    })
  })

  describe('exam label', () => {
    it('shows "Exam 1" badge when lessonType is "exam"', () => {
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={mockLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            lessonType="exam"
          />
        </I18nProvider>,
      )
      expect(screen.getByText('Exam 1')).toBeTruthy()
      expect(screen.getByText('Test Lesson')).toBeTruthy()
    })

    it('shows "Lesson 1" badge when lessonType is "learning"', () => {
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={mockLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            lessonType="learning"
          />
        </I18nProvider>,
      )
      expect(screen.getByText('Lesson 1')).toBeTruthy()
      expect(screen.getByText('Test Lesson')).toBeTruthy()
    })

    it('shows "Lesson 1" badge when lessonType is omitted (backward compat)', () => {
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={mockLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
          />
        </I18nProvider>,
      )
      expect(screen.getByText('Lesson 1')).toBeTruthy()
      expect(screen.getByText('Test Lesson')).toBeTruthy()
    })
  })

  describe('paid-access paywall', () => {
    it('shows paywall CTA when course is paid, lesson inherits, and user has no entitlement', () => {
      const inheritLesson = { ...mockLesson, accessType: 'inherit' as const }
      const { container } = render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={inheritLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      expect(screen.getByTestId('unified-card-paywall-cta')).toBeTruthy()
      expect(screen.getByTestId('unified-card-paywall-hint')).toBeTruthy()
      expect(screen.getByTestId('unified-card-paywall-cart')).toBeTruthy()
      // Locked card is NOT greyed out — it should look like a "buy this" card,
      // not a disabled one.
      const root = container.firstChild as HTMLElement
      expect(root.className).not.toContain('opacity-60')
    })

    it('does not show paywall CTA when user already has paid entitlement', () => {
      const inheritLesson = { ...mockLesson, accessType: 'inherit' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={inheritLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={true}
          />
        </I18nProvider>,
      )
      expect(screen.queryByTestId('unified-card-paywall-cta')).toBeNull()
      expect(screen.queryByTestId('unified-card-paywall-hint')).toBeNull()
      expect(screen.queryByTestId('unified-card-paywall-cart')).toBeNull()
    })

    it('does not show paywall CTA when course is free', () => {
      const inheritLesson = { ...mockLesson, accessType: 'inherit' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={inheritLesson}
            index={1}
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
          <CourseLessonCard
            lesson={freeLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      expect(screen.queryByTestId('unified-card-paywall-cta')).toBeNull()
    })

    it('does not show paywall CTA when lesson is explicitly gated even if course is paid', () => {
      const gatedLesson = { ...mockLesson, accessType: 'gated' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={gatedLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      expect(screen.queryByTestId('unified-card-paywall-cta')).toBeNull()
    })

    it('does not show paywall CTA when lesson is explicitly mandatory even if course is paid', () => {
      const mandatoryLesson = { ...mockLesson, accessType: 'mandatory' as const }
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={mandatoryLesson}
            index={1}
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
          <CourseLessonCard
            lesson={paidLesson}
            index={1}
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
          <CourseLessonCard
            lesson={inheritLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            courseAccessType="paid"
            hasPaidAccess={false}
          />
        </I18nProvider>,
      )
      // The whole card is wrapped in a transparent link overlay; its href
      // should point to the purchase flow, not the (gated) lesson page.
      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/products')
      expect(toast.info).not.toHaveBeenCalled()
    })
  })
})
