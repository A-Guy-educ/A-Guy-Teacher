import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { PATCH as patchLesson } from '../src/app/api/classes/[classId]/lessons/[lessonId]/route'
import { POST as logout } from '../src/app/api/logout/route'
import {
  getApiOrigin,
  getDashboardOrigin,
  getTeacherLoginUrl,
  isTeacherOrigin,
  parseTeacherClasses,
  requestClassProgress,
  setLessonHidden,
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

  it('sends class reads to api.aguy.co.il with the shared session', async () => {
    fetcher.mockResolvedValue(Response.json({ classes: [] }))

    await requestClassProgress('payload-token=opaque', 'class/1', {
      fetcher,
      requestId: 'teacher-request',
    })

    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.aguy.co.il/api/teacher/classes/class%2F1/progress')
    expect(new Headers(init.headers).get('cookie')).toBe('payload-token=opaque')
    expect(new Headers(init.headers).get('x-request-id')).toBe('teacher-request')
  })

  it('saves lesson visibility with a PATCH to Web', async () => {
    fetcher.mockResolvedValue(Response.json({ lessonId: 'lesson 2', hidden: true }))

    await setLessonHidden('payload-token=opaque', 'class/1', 'lesson 2', true, {
      fetcher,
      requestId: 'teacher-request',
    })

    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.aguy.co.il/api/teacher/classes/class%2F1/lessons/lesson%202')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ hidden: true })
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
    expect(new Headers(init.headers).get('cookie')).toBe('payload-token=opaque')
    expect(new Headers(init.headers).get('x-request-id')).toBe('teacher-request')
  })

  const lessonRequest = (body: unknown, origin = 'https://teacher.aguy.co.il') =>
    patchLesson(
      new NextRequest('https://teacher.aguy.co.il/api/classes/c1/lessons/l1', {
        method: 'PATCH',
        headers: { origin, cookie: 'payload-token=opaque' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ classId: 'c1', lessonId: 'l1' }) },
    )

  it('forwards same-origin lesson visibility changes with the shared session', async () => {
    fetcher.mockResolvedValue(Response.json({ lessonId: 'l1', hidden: false }))
    vi.stubGlobal('fetch', fetcher)

    const response = await lessonRequest({ hidden: false })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ lessonId: 'l1', hidden: false })
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.aguy.co.il/api/teacher/classes/c1/lessons/l1')
    expect(new Headers(init.headers).get('cookie')).toBe('payload-token=opaque')
  })

  it('passes Web errors through when saving lesson visibility', async () => {
    fetcher.mockResolvedValue(Response.json({ error: 'Not found' }, { status: 404 }))
    vi.stubGlobal('fetch', fetcher)

    expect((await lessonRequest({ hidden: true })).status).toBe(404)
  })

  it('rejects cross-origin or malformed lesson visibility changes', async () => {
    vi.stubGlobal('fetch', fetcher)

    expect((await lessonRequest({ hidden: true }, 'https://evil.example')).status).toBe(403)
    expect((await lessonRequest({ hidden: 'yes' })).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
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

  it('validates class responses', async () => {
    await expect(
      parseTeacherClasses(Response.json({ classes: [{ name: 'Missing id' }] })),
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
