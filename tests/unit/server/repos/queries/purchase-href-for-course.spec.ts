/**
 * Unit tests for queryPurchaseHrefForCourse — the reverse-lookup that powers
 * the locked-lesson paywall CTA in issue #770. We mock getContentDb because
 * the query goes directly through the Mongo driver (no Payload runtime), then
 * inspect both the filter shape passed to .findOne() and the slug returned.
 *
 * @fileType unit-test
 * @domain billing
 * @ai-summary Tests the cheapest-active-product reverse-lookup for the locked
 * lesson paywall — single match, no match, multi-match (cheapest wins), error
 * fallback, invalid ObjectId, missing slug.
 */
import { ObjectId } from 'mongodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findOneMock } = vi.hoisted(() => ({
  findOneMock: vi.fn(),
}))

vi.mock('@/infra/db/content-db', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/db/content-db')>('@/infra/db/content-db')
  return {
    ...actual,
    getContentDb: vi.fn(async () => ({
      collection: () => ({
        findOne: findOneMock,
      }),
    })),
  }
})

const { queryPurchaseHrefForCourse } = await import('@/server/repos/queries/products')

const COURSE_ID = '507f191e810c19729de860ea'

describe('queryPurchaseHrefForCourse (#770)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findOneMock.mockResolvedValue(null)
  })

  it('returns the slug when exactly one active product matches the course', async () => {
    findOneMock.mockResolvedValueOnce({ slug: 'grade-7-standalone', price: 199 })

    const slug = await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    expect(slug).toBe('grade-7-standalone')
  })

  it('passes the documented filter shape — reuse activeProductFilter, match both ObjectId and string course ref', async () => {
    findOneMock.mockResolvedValueOnce({ slug: 's', price: 1 })

    await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    expect(findOneMock).toHaveBeenCalledTimes(1)
    const [filter, options] = findOneMock.mock.calls[0]

    // Must reuse the file-level activeProductFilter constant — NOT hand-roll a
    // stricter `isActive: true` that drops pre-#718 products where isActive is
    // missing/null.
    expect(filter.isActive).toEqual({ $ne: false })
    expect(filter.status).toEqual({ $in: ['active', null] })
    // Must restrict to courseBlock entries that grant THIS course — not any
    // featureBlock or unrelated courseBlock. Course ref can be stored as either
    // ObjectId or plain string depending on how the product was created, so we
    // match both (same reason populateContents above uses relationId()).
    const elemMatch = (filter.contents as { $elemMatch: { blockType: string; course: unknown } })
      .$elemMatch
    expect(elemMatch.blockType).toBe('courseBlock')
    expect(elemMatch.course).toEqual({
      $in: expect.arrayContaining([expect.any(ObjectId), COURSE_ID]),
    })
    const inList = (elemMatch.course as { $in: unknown[] }).$in
    const objectIdEntry = inList.find((v): v is ObjectId => v instanceof ObjectId)
    expect(objectIdEntry?.equals(new ObjectId(COURSE_ID))).toBe(true)

    // Cheapest active product wins (multi-product tiebreaker per issue spec).
    expect(options).toEqual({
      projection: { slug: 1, price: 1 },
      sort: { price: 1 },
    })
  })

  it('returns null when no active product unlocks the course', async () => {
    findOneMock.mockResolvedValueOnce(null)

    const slug = await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    expect(slug).toBeNull()
  })

  it('returns null when the query throws — never blocks the click', async () => {
    findOneMock.mockRejectedValueOnce(new Error('connection refused'))

    const slug = await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    expect(slug).toBeNull()
  })

  it('returns null for an empty / falsy courseId', async () => {
    expect(await queryPurchaseHrefForCourse({ courseId: '' })).toBeNull()
    expect(findOneMock).not.toHaveBeenCalled()
  })

  it('returns null for a non-ObjectId courseId (avoids throwing inside the driver)', async () => {
    const slug = await queryPurchaseHrefForCourse({ courseId: 'not-a-valid-objectid' })
    expect(slug).toBeNull()
    expect(findOneMock).not.toHaveBeenCalled()
  })

  it('returns null when the matched product has no slug field', async () => {
    findOneMock.mockResolvedValueOnce({ price: 199 })

    const slug = await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    expect(slug).toBeNull()
  })

  it('returns null when the matched product has an empty slug', async () => {
    findOneMock.mockResolvedValueOnce({ slug: '', price: 199 })

    const slug = await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    expect(slug).toBeNull()
  })

  it('returns null when the matched product has a non-string slug (defensive)', async () => {
    findOneMock.mockResolvedValueOnce({ slug: 12345, price: 199 })

    const slug = await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    expect(slug).toBeNull()
  })

  // Tiebreaker — when MongoDB returns the cheapest product (sort: { price: 1 }
  // + limit 1 via findOne), we just surface its slug. This test pins that the
  // options we pass tell Mongo to do exactly that. The integration test of the
  // real cheapest-wins behavior lives in the index test that runs against a
  // live DB; here we pin the option contract.
  it('relies on the driver for the cheapest-wins tiebreaker (sort: price asc + findOne limit)', async () => {
    findOneMock.mockResolvedValueOnce({ slug: 'bundle-cheaper', price: 99 })

    const slug = await queryPurchaseHrefForCourse({ courseId: COURSE_ID })

    const [, options] = findOneMock.mock.calls[0]
    expect((options as { sort?: unknown }).sort).toEqual({ price: 1 })
    // findOne is itself the "limit 1" — confirming the call shape here means
    // there's no risk of accidentally swapping to .find() + .toArray().
    expect(slug).toBe('bundle-cheaper')
  })
})
