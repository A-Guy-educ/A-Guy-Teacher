/**
 * /courses page — auth gate (issue #673)
 *
 * Anonymous visitors opening /courses must be redirected to /start (the wizard).
 * Authenticated visitors must see the catalog unchanged.
 *
 * Mirrors the auth pattern from src/app/(frontend)/page.tsx:7-15 and the
 * mock-cookie pattern from tests/int/auth-login.int.spec.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}))

const mockHeadersList = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
  headers: () => mockHeadersList,
}))

const mockGetSessionFromToken = vi.hoisted(() => vi.fn())
const mockQueryPublishedCourses = vi.hoisted(() => vi.fn())

vi.mock('@/infra/auth/web-auth', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/auth/web-auth')>('@/infra/auth/web-auth')
  return {
    ...actual,
    getSessionFromToken: mockGetSessionFromToken,
  }
})

vi.mock('@/server/repos/queries/courses', () => ({
  queryPublishedCourses: mockQueryPublishedCourses,
}))

import CoursesPage, { dynamic } from '@/app/(frontend)/courses/page'

const AUTH_COOKIE = 'payload-token'

function isRedirectToStartError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const digest = (err as Error & { digest?: string }).digest
  if (typeof digest !== 'string') return false
  return digest.startsWith('NEXT_REDIRECT') && digest.includes('/start')
}

describe('/courses page — auth gate (issue #673)', () => {
  beforeEach(() => {
    mockCookieStore.get.mockReset()
    mockHeadersList.get.mockReset()
    mockGetSessionFromToken.mockReset()
    mockQueryPublishedCourses.mockReset()
    mockHeadersList.get.mockReturnValue(null)
    mockQueryPublishedCourses.mockResolvedValue([])
  })

  it('renders per request so authenticated catalog output is never shared with anonymous visitors', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('redirects anonymous visitors to /start', async () => {
    mockCookieStore.get.mockImplementation((name: string) =>
      name === AUTH_COOKIE ? undefined : undefined,
    )
    mockGetSessionFromToken.mockResolvedValue(null)

    const result = CoursesPage()
    await expect(result).rejects.toThrow()
    await expect(result).rejects.toSatisfy(isRedirectToStartError)
  })

  it('does not call queryPublishedCourses for anonymous visitors', async () => {
    mockCookieStore.get.mockReturnValue(undefined)
    mockGetSessionFromToken.mockResolvedValue(null)

    await expect(CoursesPage()).rejects.toSatisfy(isRedirectToStartError)
    expect(mockQueryPublishedCourses).not.toHaveBeenCalled()
  })

  it('lets authenticated visitors through to the catalog render', async () => {
    mockCookieStore.get.mockImplementation((name: string) =>
      name === AUTH_COOKIE ? { value: 'valid-token' } : undefined,
    )
    mockGetSessionFromToken.mockResolvedValue({
      token: 'valid-token',
      user: {
        id: 'u1',
        email: 'student@example.com',
        role: 'student',
      },
    })

    let caught: unknown = null
    let result: unknown
    try {
      result = await CoursesPage()
    } catch (e) {
      caught = e
    }

    expect(isRedirectToStartError(caught)).toBe(false)
    expect(mockQueryPublishedCourses).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
