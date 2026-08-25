import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { POST as logout } from '../src/app/api/logout/route'
import {
  getApiOrigin,
  getDashboardOrigin,
  getTeacherLoginUrl,
  isTeacherOrigin,
  parseManagedCourses,
  requestManagedCourses,
} from '../src/server/aguy-api'

describe('Teacher API boundary', () => {
  const fetcher = vi.fn()

  beforeEach(() => {
    fetcher.mockReset()
    vi.stubEnv('AGUY_API_URL', 'https://api.aguy.co.il')
    vi.stubEnv('AGUY_WEB_URL', 'https://www.aguy.co.il')
    vi.stubEnv('TEACHER_PUBLIC_URL', 'https://teacher.aguy.co.il')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends course reads to api.aguy.co.il with the shared session', async () => {
    fetcher.mockResolvedValue(Response.json({ docs: [] }))

    await requestManagedCourses('payload-token=opaque', {
      fetcher,
      requestId: 'teacher-request',
    })

    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.aguy.co.il/api/teacher/courses')
    expect(new Headers(init.headers).get('cookie')).toBe('payload-token=opaque')
    expect(new Headers(init.headers).get('x-request-id')).toBe('teacher-request')
  })

  it('uses the API configured for the current environment', () => {
    vi.stubEnv('AGUY_API_URL', 'https://api.qa.aguy.co.il')

    expect(getApiOrigin().origin).toBe('https://api.qa.aguy.co.il')
  })

  it('does not send a custom dev environment to the production dashboard', () => {
    vi.stubEnv('AGUY_DASH_URL', '')
    vi.stubEnv('VERCEL_TARGET_ENV', 'dev')

    expect(getDashboardOrigin()).toBeUndefined()
  })

  it('uses the configured dashboard for the current environment', () => {
    vi.stubEnv('AGUY_DASH_URL', 'https://dash.dev.aguy.co.il')
    vi.stubEnv('VERCEL_TARGET_ENV', 'dev')

    expect(getDashboardOrigin()?.origin).toBe('https://dash.dev.aguy.co.il')
  })

  it('creates a safe shared-login return URL', () => {
    expect(getTeacherLoginUrl()).toBe(
      'https://www.aguy.co.il/login?returnTo=https%3A%2F%2Fteacher.aguy.co.il%2F',
    )
  })

  it('keeps the configured Teacher URL for preview deployments', () => {
    vi.stubEnv('TEACHER_PUBLIC_URL', 'https://a-guy-teacher-git-dev-aguy.vercel.app')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_TARGET_ENV', 'preview')
    vi.stubEnv('VERCEL_URL', 'a-guy-teacher-5kkb04n5i-aguy.vercel.app')

    expect(getTeacherLoginUrl()).toBe(
      'https://www.aguy.co.il/login?returnTo=https%3A%2F%2Fa-guy-teacher-git-dev-aguy.vercel.app%2F',
    )
  })

  it('keeps the stable Teacher URL in the custom dev environment', () => {
    vi.stubEnv('AGUY_WEB_URL', 'https://www.dev.aguy.co.il')
    vi.stubEnv('TEACHER_PUBLIC_URL', 'https://teacher.dev.aguy.co.il')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_TARGET_ENV', 'dev')
    vi.stubEnv('VERCEL_URL', 'a-guy-teacher-5kkb04n5i-aguy.vercel.app')

    expect(getTeacherLoginUrl()).toBe(
      'https://www.dev.aguy.co.il/login?returnTo=https%3A%2F%2Fteacher.dev.aguy.co.il%2F',
    )
  })

  it('validates course responses', async () => {
    await expect(
      parseManagedCourses(Response.json({ docs: [{ title: 'Missing id' }] })),
    ).rejects.toThrow()
  })

  it('rejects cross-origin logout requests', async () => {
    vi.stubGlobal('fetch', fetcher)

    const response = await logout(
      new NextRequest('https://teacher.aguy.co.il/api/logout', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      }),
    )

    expect(response.status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
    expect(isTeacherOrigin('https://teacher.aguy.co.il')).toBe(true)
  })

  it('forwards same-origin logout and shared cookie clearing', async () => {
    const headers = new Headers()
    headers.append('Set-Cookie', 'payload-token=; Domain=.aguy.co.il; Max-Age=0; Path=/')
    fetcher.mockResolvedValue(Response.json({ success: true }, { headers }))
    vi.stubGlobal('fetch', fetcher)

    const response = await logout(
      new NextRequest('https://teacher.aguy.co.il/api/logout', {
        method: 'POST',
        headers: {
          origin: 'https://teacher.aguy.co.il',
          cookie: 'payload-token=opaque',
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('Domain=.aguy.co.il')
  })
})
