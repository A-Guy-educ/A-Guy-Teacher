/**
 * Characterization tests for GET /api/account/transactions/[id].
 *
 * A transaction is a payment record, so the rule that matters is that someone
 * else's is indistinguishable from one that does not exist — the route answers
 * 404 either way rather than 403, which would confirm it is real.
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
const OTHER_USER = '507f1f77bcf86cd799439099'
const TRANSACTION_ID = '507f191e810c19729de860ea'

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function get(id: string) {
  const { GET } = await import('@/app/api/account/transactions/[id]/route')
  const response = await GET(new NextRequest(`http://localhost/api/account/transactions/${id}`), {
    params: Promise.resolve({ id }),
  })
  return { status: response.status, body: await response.json() }
}

describe('GET /api/account/transactions/[id]', () => {
  beforeEach(() => {
    seed({ transactions: [{ _id: TRANSACTION_ID, user: USER_ID, amount: 1200 }] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    expect(await get(TRANSACTION_ID)).toMatchObject({
      status: 401,
      body: { error: 'Unauthorized' },
    })
  })

  it('returns the caller own transaction', async () => {
    const { status, body } = await get(TRANSACTION_ID)

    expect(status).toBe(200)
    expect(body.transaction).toMatchObject({ id: TRANSACTION_ID, amount: 1200 })
  })

  it('reports a transaction that does not exist as not found', async () => {
    seed({ transactions: [] })

    expect(await get(TRANSACTION_ID)).toMatchObject({
      status: 404,
      body: { error: 'Transaction not found' },
    })
  })

  it('gives the same answer for someone else transaction, revealing nothing', async () => {
    seed({ transactions: [{ _id: TRANSACTION_ID, user: OTHER_USER, amount: 9900 }] })

    const { status, body } = await get(TRANSACTION_ID)

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Transaction not found' })
  })

  it('rejects an identifier that is not a real one', async () => {
    expect(await get('not-an-object-id')).toMatchObject({
      status: 404,
      body: { error: 'Transaction not found' },
    })
  })
})
