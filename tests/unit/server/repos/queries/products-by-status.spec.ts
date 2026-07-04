/**
 * Unit tests for the active vs soon split introduced in #718.
 *
 * queryActiveProducts and querySoonProducts both go through findManySerialized,
 * so the only thing under test is the FILTER shape and normalization. We
 * capture the filter argument on each call so a regression in the filter
 * (e.g. accidentally removing the $or branch for soon) fails loudly here
 * instead of silently surfacing in production as a missing product.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { findManySerializedMock } = vi.hoisted(() => ({
  findManySerializedMock: vi.fn(),
}))

vi.mock('@/server/repos/mongo', () => ({
  findManySerialized: findManySerializedMock,
  findOneSerialized: vi.fn(),
}))

import { queryActiveProducts, querySoonProducts } from '@/server/repos/queries/products'

describe('queryActiveProducts — active storefront filter (#718)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes a filter that matches status=active OR (missing status AND isActive!=false)', async () => {
    findManySerializedMock.mockResolvedValueOnce([])
    await queryActiveProducts()

    expect(findManySerializedMock).toHaveBeenCalledTimes(1)
    const [collection, filter] = findManySerializedMock.mock.calls[0]
    expect(collection).toBe('products')
    // isActive must not be false — anything else (true, null/missing) is fine.
    expect(filter.isActive).toEqual({ $ne: false })
    // status must be 'active' or null/missing — not 'soon' / 'free'.
    expect(filter.status).toEqual({ $in: ['active', null] })
  })

  it('normalizes products by filling `title` from `name`', async () => {
    findManySerializedMock.mockResolvedValueOnce([
      { id: '1', name: 'Course Bundle', status: 'active' },
    ])
    const result = await queryActiveProducts()
    expect(result[0].title).toBe('Course Bundle')
  })
})

describe('querySoonProducts — soon/free/inactive filter (#718)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes a filter that catches status=soon, status=free, OR isActive=false', async () => {
    findManySerializedMock.mockResolvedValueOnce([])
    await querySoonProducts()

    expect(findManySerializedMock).toHaveBeenCalledTimes(1)
    const [collection, filter] = findManySerializedMock.mock.calls[0]
    expect(collection).toBe('products')
    // $or branch must include both explicit soon statuses AND the legacy
    // isActive=false path so pre-#718 inactive products still show up here.
    expect(filter).toHaveProperty('$or')
    const orClauses = filter.$or as Array<Record<string, unknown>>
    expect(orClauses).toEqual(
      expect.arrayContaining([{ status: { $in: ['soon', 'free'] } }, { isActive: false }]),
    )
  })

  it('returns normalized products', async () => {
    findManySerializedMock.mockResolvedValueOnce([
      { id: '1', name: 'Soon Product', status: 'soon' },
    ])
    const result = await querySoonProducts()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Soon Product')
  })
})
