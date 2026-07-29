/**
 * A tiny in-memory stand-in for `getContentDb()`.
 *
 * These are characterization tests: they exist to pin what a route does today
 * so the query can later be moved into the service layer without anyone
 * wondering whether behaviour changed. That means the fake only needs to be
 * faithful about the operations the routes actually perform — it is not a
 * MongoDB implementation, and should not grow into one.
 *
 * It supports exactly the operators the migrated routes use — `$in`, `$ne`,
 * `$gt`, `$lt`, `$exists`, top-level `$or`, and `$set` / `$setOnInsert` /
 * `$inc` / `$push`
 * updates. That list is deliberately closed: anything richer is a sign the
 * query belongs in an integration test against a real database, not that this
 * file should grow toward being MongoDB.
 */

import { vi } from 'vitest'

export type Doc = Record<string, unknown>

function sameId(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (left == null || right == null) return false
  return String(left) === String(right)
}

function asTime(value: unknown): number {
  return value instanceof Date ? value.getTime() : new Date(String(value)).getTime()
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (condition instanceof Date) return asTime(value) === condition.getTime()

  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    const operators = condition as Record<string, unknown>

    if ('$in' in operators) {
      return (operators.$in as unknown[]).some((candidate) => sameId(value, candidate))
    }
    if ('$ne' in operators) return !sameId(value, operators.$ne)
    if ('$exists' in operators) return (value !== undefined) === Boolean(operators.$exists)
    if ('$gt' in operators) return value != null && asTime(value) > asTime(operators.$gt)
    if ('$lt' in operators) return value != null && Number(value) < Number(operators.$lt)
  }

  return sameId(value, condition)
}

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') {
      return (condition as Doc[]).some((branch) => matches(doc, branch))
    }
    return matchesCondition(doc[key], condition)
  })
}

function applyUpdate(doc: Doc, update: Doc): void {
  const set = update.$set as Doc | undefined
  if (set) Object.assign(doc, set)

  const increment = update.$inc as Record<string, number> | undefined
  if (increment) {
    for (const [key, delta] of Object.entries(increment)) {
      doc[key] = Number(doc[key] ?? 0) + delta
    }
  }

  const push = update.$push as Record<string, unknown> | undefined
  if (push) {
    for (const [key, spec] of Object.entries(push)) {
      const list = Array.isArray(doc[key]) ? [...(doc[key] as unknown[])] : []
      const isEachSpec = spec && typeof spec === 'object' && '$each' in spec
      const items = isEachSpec ? ((spec as { $each: unknown[] }).$each ?? []) : [spec]
      const position = isEachSpec ? (spec as { $position?: number }).$position : undefined
      const slice = isEachSpec ? (spec as { $slice?: number }).$slice : undefined

      list.splice(position ?? list.length, 0, ...items)
      doc[key] = typeof slice === 'number' ? list.slice(0, slice) : list
    }
  }
}

/**
 * Build a fake database seeded with documents per collection.
 *
 * The returned object exposes `collections` so a test can assert on the state
 * a route left behind, and `calls` so it can assert which collections were
 * touched — useful when the point of a test is that a write happened at all.
 */
export function fakeContentDb(seed: Record<string, Doc[]> = {}) {
  const collections: Record<string, Doc[]> = {}
  for (const [name, docs] of Object.entries(seed)) {
    collections[name] = docs.map((doc) => ({ ...doc }))
  }

  const calls: { collection: string; operation: string }[] = []
  let nextId = 1

  function docsOf(name: string): Doc[] {
    collections[name] ??= []
    return collections[name]
  }

  function collection(name: string) {
    const record = (operation: string) => calls.push({ collection: name, operation })

    return {
      async findOne(filter: Doc = {}) {
        record('findOne')
        return docsOf(name).find((doc) => matches(doc, filter)) ?? null
      },

      find(filter: Doc = {}) {
        record('find')
        let results = docsOf(name).filter((doc) => matches(doc, filter))

        const cursor = {
          sort(spec: Record<string, 1 | -1>) {
            const [[key, direction] = []] = Object.entries(spec)
            if (key) {
              results = [...results].sort((a, b) => {
                const left = String(a[key] ?? '')
                const right = String(b[key] ?? '')
                return left < right ? -direction : left > right ? direction : 0
              })
            }
            return cursor
          },
          limit(count: number) {
            results = results.slice(0, count)
            return cursor
          },
          async toArray() {
            return results
          },
        }

        return cursor
      },

      async countDocuments(filter: Doc = {}) {
        record('countDocuments')
        return docsOf(name).filter((doc) => matches(doc, filter)).length
      },

      async insertOne(doc: Doc) {
        record('insertOne')
        const insertedId = doc._id ?? `generated-${nextId++}`
        docsOf(name).push({ ...doc, _id: insertedId })
        return { insertedId, acknowledged: true }
      },

      async updateOne(filter: Doc, update: Doc, options: { upsert?: boolean } = {}) {
        record('updateOne')
        const existing = docsOf(name).find((doc) => matches(doc, filter))

        if (existing) {
          applyUpdate(existing, update)
          return { matchedCount: 1, modifiedCount: 1, upsertedId: null, acknowledged: true }
        }

        if (options.upsert) {
          const created: Doc = { ...filter, _id: `generated-${nextId++}` }
          Object.assign(created, (update.$setOnInsert as Doc) ?? {})
          applyUpdate(created, update)
          docsOf(name).push(created)
          return { matchedCount: 0, modifiedCount: 0, upsertedId: created._id, acknowledged: true }
        }

        return { matchedCount: 0, modifiedCount: 0, upsertedId: null, acknowledged: true }
      },

      async deleteOne(filter: Doc) {
        record('deleteOne')
        const index = docsOf(name).findIndex((doc) => matches(doc, filter))
        if (index === -1) return { deletedCount: 0, acknowledged: true }
        docsOf(name).splice(index, 1)
        return { deletedCount: 1, acknowledged: true }
      },
    }
  }

  return {
    db: { collection },
    collections,
    calls,
    touched: (collectionName: string, operation: string) =>
      calls.some((call) => call.collection === collectionName && call.operation === operation),
  }
}

/** A `getContentDb` mock backed by {@link fakeContentDb}. */
export function mockContentDb(seed: Record<string, Doc[]> = {}) {
  const fake = fakeContentDb(seed)
  return { ...fake, getContentDb: vi.fn(async () => fake.db) }
}
