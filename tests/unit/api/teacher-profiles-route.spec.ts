/**
 * Characterization tests for GET /api/teacher-profiles.
 *
 * The route does three things beyond fetching: it picks the caller's language,
 * it keeps only one profile per slug, and it hides the fixtures used by the
 * settings tests. All three are easy to lose in a refactor.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

function profile(overrides: Doc = {}): Doc {
  return {
    _id: 'profile-1',
    slug: 'friendly',
    label: 'Friendly',
    description: 'A friendly teacher',
    isEnabled: true,
    ...overrides,
  }
}

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function list(locale?: string) {
  const { GET } = await import('@/app/api/teacher-profiles/route')
  const headers = new Headers()
  if (locale) headers.set('cookie', `NEXT_LOCALE=${locale}`)
  const response = await GET(
    new NextRequest('http://localhost/api/teacher-profiles', { headers } as never),
  )
  return { status: response.status, body: await response.json() }
}

describe('GET /api/teacher-profiles', () => {
  beforeEach(() => {
    seed({ teacher_profiles: [profile({ locale: 'he' })] })
  })

  it('is public — no session required', async () => {
    const { status, body } = await list()

    expect(status).toBe(200)
    expect(body.profiles).toHaveLength(1)
  })

  it('returns the fields the picker needs', async () => {
    const { body } = await list()

    expect(body.profiles[0]).toEqual({
      id: 'profile-1',
      slug: 'friendly',
      label: 'Friendly',
      description: 'A friendly teacher',
      isEnabled: true,
    })
  })

  it('hides disabled profiles', async () => {
    seed({ teacher_profiles: [profile({ isEnabled: false })] })

    expect((await list()).body.profiles).toEqual([])
  })

  it('offers profiles in the caller language', async () => {
    seed({
      teacher_profiles: [
        profile({ _id: 'he', locale: 'he', label: 'ידידותי' }),
        profile({ _id: 'en', locale: 'en', label: 'Friendly' }),
      ],
    })

    expect((await list('en')).body.profiles[0].label).toBe('Friendly')
  })

  it('includes profiles that belong to no particular language', async () => {
    seed({ teacher_profiles: [profile({ _id: 'any', slug: 'neutral' })] })

    expect((await list('en')).body.profiles).toHaveLength(1)
  })

  it('excludes a profile offered only in another language', async () => {
    seed({ teacher_profiles: [profile({ locale: 'he' })] })

    expect((await list('en')).body.profiles).toEqual([])
  })

  it('returns each slug once, even when several languages match', async () => {
    seed({
      teacher_profiles: [
        profile({ _id: 'a', slug: 'friendly' }),
        profile({ _id: 'b', slug: 'friendly' }),
        profile({ _id: 'c', slug: 'strict' }),
      ],
    })

    const { body } = await list()

    expect(body.profiles.map((p: { slug: string }) => p.slug)).toEqual(['friendly', 'strict'])
  })

  it('falls back to the slug when a profile has no label', async () => {
    seed({ teacher_profiles: [profile({ label: undefined, description: undefined })] })

    expect((await list()).body.profiles[0]).toMatchObject({ label: 'friendly', description: '' })
  })

  it.each([
    ['the test fixture slug', profile({ slug: 'settings-test-teacher' })],
    ['the test fixture label', profile({ label: 'Settings Test Teacher' })],
    ['a description mentioning settings tests', profile({ description: 'used by settings tests' })],
  ])('hides %s from real users', async (_label, doc) => {
    seed({ teacher_profiles: [doc] })

    expect((await list()).body.profiles).toEqual([])
  })

  it('returns an empty list rather than failing when there are none', async () => {
    seed({ teacher_profiles: [] })

    expect((await list()).body).toEqual({ profiles: [] })
  })
})
