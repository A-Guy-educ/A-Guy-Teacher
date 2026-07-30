/**
 * Characterization tests for /api/user-settings.
 *
 * Written before the queries move into the service layer. The route's only
 * existing tests are Payload-era integration files that no longer run, so this
 * is the first coverage that actually executes.
 *
 * Two behaviours are easy to lose in a refactor and are pinned deliberately:
 * the teacher profile is resolved in the caller's language, and saving a
 * setting for the first time creates the record rather than failing.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockGetWebUser = vi.hoisted(() => vi.fn())

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

vi.mock('@/infra/web-api/mongo-payload', () => ({ getWebUser: mockGetWebUser }))

const USER_ID = '507f1f77bcf86cd799439011'
const PROFILE_ID = '507f191e810c19729de860ea'

function hebrewProfile(overrides: Doc = {}): Doc {
  return {
    _id: PROFILE_ID,
    slug: 'friendly',
    label: 'מורה ידידותי',
    description: 'תיאור',
    locale: 'he',
    isEnabled: true,
    ...overrides,
  }
}

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

function request(path: string, init: RequestInit = {}, locale?: string) {
  const headers = new Headers(init.headers)
  if (locale) headers.set('cookie', `NEXT_LOCALE=${locale}`)
  return new NextRequest(`http://localhost${path}`, { ...init, headers } as never)
}

async function get(locale?: string) {
  const { GET } = await import('@/app/api/user-settings/route')
  const response = await GET(request('/api/user-settings', {}, locale))
  return { status: response.status, body: await response.json() }
}

async function patch(body: unknown, locale?: string) {
  const { PATCH } = await import('@/app/api/user-settings/route')
  const response = await PATCH(
    request(
      '/api/user-settings',
      {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      },
      locale,
    ),
  )
  return { status: response.status, body: await response.json() }
}

describe('GET /api/user-settings', () => {
  beforeEach(() => {
    seed({ teacher_profiles: [hebrewProfile()] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    expect(await get()).toMatchObject({ status: 401, body: { error: 'Unauthorized' } })
  })

  it('reports no teacher profile for a user who has not chosen one', async () => {
    const { status, body } = await get()

    expect(status).toBe(200)
    expect(body).toEqual({ settings: { id: null, teacherProfile: null } })
  })

  it('returns the chosen teacher profile', async () => {
    seed({
      teacher_profiles: [hebrewProfile()],
      user_settings: [{ _id: 'settings-1', user: USER_ID, teacherProfile: PROFILE_ID }],
    })

    const { body } = await get()

    expect(body.settings).toMatchObject({
      id: 'settings-1',
      teacherProfile: { slug: 'friendly', label: 'מורה ידידותי', description: 'תיאור' },
    })
  })

  it('resolves the profile in the caller language', async () => {
    seed({
      teacher_profiles: [
        hebrewProfile(),
        {
          _id: 'profile-en',
          slug: 'friendly',
          label: 'Friendly teacher',
          locale: 'en',
          isEnabled: true,
        },
      ],
      user_settings: [{ _id: 'settings-1', user: USER_ID, teacherProfile: PROFILE_ID }],
    })

    const { body } = await get('en')

    expect(body.settings.teacherProfile.label).toBe('Friendly teacher')
  })

  it('accepts a profile that is not tied to any language', async () => {
    seed({
      teacher_profiles: [{ _id: PROFILE_ID, slug: 'neutral', label: 'Neutral', isEnabled: true }],
      user_settings: [{ _id: 'settings-1', user: USER_ID, teacherProfile: PROFILE_ID }],
    })

    const { body } = await get('en')

    expect(body.settings.teacherProfile.slug).toBe('neutral')
  })

  it('reports no profile when the stored one has been disabled', async () => {
    seed({
      teacher_profiles: [hebrewProfile({ isEnabled: false })],
      user_settings: [{ _id: 'settings-1', user: USER_ID, teacherProfile: PROFILE_ID }],
    })

    const { body } = await get()

    expect(body.settings.teacherProfile).toBeNull()
  })

  it('falls back to the slug when a profile has no label', async () => {
    seed({
      teacher_profiles: [{ _id: PROFILE_ID, slug: 'friendly', isEnabled: true }],
      user_settings: [{ _id: 'settings-1', user: USER_ID, teacherProfile: PROFILE_ID }],
    })

    const { body } = await get()

    expect(body.settings.teacherProfile).toEqual({
      slug: 'friendly',
      label: 'friendly',
      description: '',
    })
  })
})

describe('PATCH /api/user-settings', () => {
  beforeEach(() => {
    seed({ teacher_profiles: [hebrewProfile()] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    expect(await patch({ teacherProfileSlug: 'friendly' })).toMatchObject({ status: 401 })
  })

  it.each([
    ['an empty body', {}],
    ['an empty slug', { teacherProfileSlug: '' }],
    ['a non-string slug', { teacherProfileSlug: 42 }],
  ])('rejects %s', async (_label, body) => {
    const result = await patch(body)

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid request')
  })

  it('rejects an unknown profile', async () => {
    expect(await patch({ teacherProfileSlug: 'nope' })).toMatchObject({
      status: 404,
      body: { error: 'Teacher profile not found or disabled' },
    })
  })

  it('rejects a disabled profile', async () => {
    seed({ teacher_profiles: [hebrewProfile({ isEnabled: false })] })

    expect(await patch({ teacherProfileSlug: 'friendly' })).toMatchObject({ status: 404 })
  })

  it('creates the settings record on first save', async () => {
    const fake = seed({ teacher_profiles: [hebrewProfile()] })

    const { status, body } = await patch({ teacherProfileSlug: 'friendly' })

    expect(status).toBe(200)
    expect(body).toMatchObject({ success: true, settings: { teacherProfileSlug: 'friendly' } })
    expect(fake.collections.user_settings).toHaveLength(1)
    expect(fake.collections.user_settings[0]).toMatchObject({ teacherProfile: PROFILE_ID })
  })

  it('updates the existing record rather than creating a second one', async () => {
    const fake = seed({
      teacher_profiles: [hebrewProfile(), { _id: 'other', slug: 'strict', isEnabled: true }],
      user_settings: [{ _id: 'settings-1', user: USER_ID, teacherProfile: 'other' }],
    })

    await patch({ teacherProfileSlug: 'friendly' })

    expect(fake.collections.user_settings).toHaveLength(1)
    expect(fake.collections.user_settings[0]).toMatchObject({
      _id: 'settings-1',
      teacherProfile: PROFILE_ID,
    })
  })

  it('matches the profile in the caller language', async () => {
    const fake = seed({
      teacher_profiles: [
        hebrewProfile(),
        { _id: 'profile-en', slug: 'friendly', locale: 'en', isEnabled: true },
      ],
    })

    await patch({ teacherProfileSlug: 'friendly' }, 'en')

    expect(fake.collections.user_settings[0]).toMatchObject({ teacherProfile: 'profile-en' })
  })

  it('stamps an updated timestamp', async () => {
    const fake = seed({ teacher_profiles: [hebrewProfile()] })

    await patch({ teacherProfileSlug: 'friendly' })

    expect(fake.collections.user_settings[0].updatedAt).toBeInstanceOf(Date)
  })
})
