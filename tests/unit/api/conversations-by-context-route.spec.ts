/**
 * Characterization tests for /api/conversations/by-context.
 *
 * The behaviour worth protecting here is ownership: a conversation is a
 * private chat, and every read and delete is scoped to the caller. Deletion is
 * also archival rather than removal, which a refactor could easily turn into a
 * real delete.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockRequireUser = vi.hoisted(() => vi.fn())

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

vi.mock('@/server/auth/api-auth', () => ({ requireUser: mockRequireUser }))

const USER_ID = '507f1f77bcf86cd799439011'
const OTHER_USER = '507f1f77bcf86cd799439099'
const CONVERSATION_ID = '507f191e810c19729de860ea'

function conversation(overrides: Doc = {}): Doc {
  return {
    _id: CONVERSATION_ID,
    user: USER_ID,
    contextKey: 'ask:course-1:100',
    messages: [],
    ...overrides,
  }
}

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

function signedOut() {
  mockRequireUser.mockResolvedValue({
    ok: false,
    response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
  })
}

async function get(query: string) {
  const { GET } = await import('@/app/api/conversations/by-context/route')
  const response = await GET(
    new NextRequest(`http://localhost/api/conversations/by-context${query}`),
  )
  return { status: response.status, body: await response.json() }
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/conversations/by-context/route')
  const response = await POST(
    new NextRequest('http://localhost/api/conversations/by-context', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
  return { status: response.status, body: await response.json() }
}

async function remove(query: string) {
  const { DELETE } = await import('@/app/api/conversations/by-context/route')
  const response = await DELETE(
    new NextRequest(`http://localhost/api/conversations/by-context${query}`, { method: 'DELETE' }),
  )
  return { status: response.status, body: await response.json() }
}

describe('GET /api/conversations/by-context', () => {
  beforeEach(() => {
    seed({ conversations: [conversation()] })
    mockRequireUser.mockReset().mockResolvedValue({ ok: true, value: { id: USER_ID } })
  })

  it('refuses an anonymous caller', async () => {
    signedOut()

    expect(await get('?contextKey=ask:course-1:100')).toMatchObject({ status: 401 })
  })

  it('requires something to search by', async () => {
    expect(await get('')).toMatchObject({
      status: 400,
      body: { error: 'contextKey or contextKeyPrefix is required' },
    })
  })

  it('returns the caller conversation for an exact context', async () => {
    const { status, body } = await get('?contextKey=ask:course-1:100')

    expect(status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.conversations[0]).toMatchObject({
      id: CONVERSATION_ID,
      contextKey: 'ask:course-1:100',
    })
  })

  it('finds conversations by context prefix', async () => {
    seed({
      conversations: [
        conversation({ _id: 'a', contextKey: 'ask:course-1:100' }),
        conversation({ _id: 'b', contextKey: 'ask:course-1:200' }),
        conversation({ _id: 'c', contextKey: 'ask:course-2:300' }),
      ],
    })

    const { body } = await get('?contextKeyPrefix=ask:course-1:')

    expect(body.conversations).toHaveLength(2)
    expect(body.total).toBe(2)
  })

  it('treats a prefix as literal text, not a pattern', async () => {
    seed({ conversations: [conversation({ contextKey: 'ask:course-1:100' })] })

    // Regex metacharacters in the prefix must not match anything they please.
    const { body } = await get('?contextKeyPrefix=' + encodeURIComponent('ask:course.1:'))

    expect(body.conversations).toEqual([])
  })

  it('never returns another user conversation', async () => {
    seed({ conversations: [conversation({ user: OTHER_USER })] })

    const { body } = await get('?contextKey=ask:course-1:100')

    expect(body.conversations).toEqual([])
    expect(body.total).toBe(0)
  })

  it('hides archived conversations', async () => {
    seed({ conversations: [conversation({ archivedAt: new Date() })] })

    expect((await get('?contextKey=ask:course-1:100')).body.conversations).toEqual([])
  })

  it('titles a conversation from the first visible thing the user said', async () => {
    seed({
      conversations: [
        conversation({
          messages: [
            { role: 'assistant', content: 'hello' },
            { role: 'user', content: 'secret', hidden: true },
            { role: 'user', content: 'How do fractions work?' },
          ],
        }),
      ],
    })

    expect((await get('?contextKey=ask:course-1:100')).body.conversations[0].title).toBe(
      'How do fractions work?',
    )
  })

  it('prefers a stored title over the generated preview', async () => {
    seed({
      conversations: [
        conversation({ title: 'Fractions', messages: [{ role: 'user', content: 'x' }] }),
      ],
    })

    expect((await get('?contextKey=ask:course-1:100')).body.conversations[0].title).toBe(
      'Fractions',
    )
  })

  it('truncates a long opening message', async () => {
    seed({
      conversations: [conversation({ messages: [{ role: 'user', content: 'a'.repeat(80) }] })],
    })

    const { title } = (await get('?contextKey=ask:course-1:100')).body.conversations[0]

    expect(title).toHaveLength(53)
    expect(title.endsWith('...')).toBe(true)
  })

  it('counts only the messages a user can see', async () => {
    seed({
      conversations: [
        conversation({
          messages: [{ role: 'user' }, { role: 'assistant' }, { role: 'user', hidden: true }],
        }),
      ],
    })

    expect((await get('?contextKey=ask:course-1:100')).body.conversations[0].messageCount).toBe(2)
  })
})

describe('POST /api/conversations/by-context', () => {
  beforeEach(() => {
    seed({ conversations: [] })
    mockRequireUser.mockReset().mockResolvedValue({ ok: true, value: { id: USER_ID } })
  })

  it('rejects a request with no course', async () => {
    expect(await post({})).toMatchObject({ status: 400, body: { error: 'Invalid request body' } })
  })

  it('rejects a language it does not support', async () => {
    expect(await post({ courseId: 'course-1', locale: 'fr' })).toMatchObject({ status: 400 })
  })

  it('refuses an anonymous caller', async () => {
    signedOut()

    expect(await post({ courseId: 'course-1' })).toMatchObject({ status: 401 })
  })

  it('creates a conversation owned by the caller', async () => {
    const fake = seed({ conversations: [] })

    const { status, body } = await post({ courseId: 'course-1' })

    expect(status).toBe(200)
    expect(body.contextKey).toMatch(/^ask:course-1:\d+$/)
    expect(fake.collections.conversations).toHaveLength(1)
    expect(fake.collections.conversations[0]).toMatchObject({
      preferredLocale: 'he',
      messages: [],
      contextPolicyVersion: 'web-v1',
    })
  })

  it('honours a requested language', async () => {
    const fake = seed({ conversations: [] })

    await post({ courseId: 'course-1', locale: 'en' })

    expect(fake.collections.conversations[0]).toMatchObject({ preferredLocale: 'en' })
  })
})

describe('DELETE /api/conversations/by-context', () => {
  beforeEach(() => {
    seed({ conversations: [conversation()] })
    mockRequireUser.mockReset().mockResolvedValue({ ok: true, value: { id: USER_ID } })
  })

  it('requires a real identifier', async () => {
    expect(await remove('')).toMatchObject({ status: 400, body: { error: 'id is required' } })
    expect(await remove('?id=not-an-id')).toMatchObject({ status: 400 })
  })

  it('refuses an anonymous caller', async () => {
    signedOut()

    expect(await remove(`?id=${CONVERSATION_ID}`)).toMatchObject({ status: 401 })
  })

  it('archives rather than deletes', async () => {
    const fake = seed({ conversations: [conversation()] })

    const { status, body } = await remove(`?id=${CONVERSATION_ID}`)

    expect(status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(fake.collections.conversations).toHaveLength(1)
    expect(fake.collections.conversations[0].archivedAt).toBeInstanceOf(Date)
  })

  it('will not archive someone else conversation', async () => {
    const fake = seed({ conversations: [conversation({ user: OTHER_USER })] })

    const { status, body } = await remove(`?id=${CONVERSATION_ID}`)

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Not found' })
    expect(fake.collections.conversations[0].archivedAt).toBeUndefined()
  })
})
