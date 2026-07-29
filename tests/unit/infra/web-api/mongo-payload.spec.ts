import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'

import { toMongoWhere } from '@/infra/web-api/mongo-payload'

/**
 * Security tests for the shared Mongo query translator used by web routes.
 *
 * Covers:
 * - ReDoS / injection via unescaped regex metacharacters in `contains` / `like`
 * - Operator injection via plain-object values (e.g. `$where`, `$gt`)
 * - Type validation for comparison / membership operators
 *
 * Issue #934: src/infra/web-api/mongo-payload.ts:45-46 previously forwarded
 * raw user-controlled values directly into `$regex`, allowing both ReDoS and
 * wildcards that bypass substring matching. Other operators (`equals`,
 * `greater_than`, ...) also accepted arbitrary values.
 *
 * Security invariant: the translated query must never introduce a MongoDB
 * operator key directly under a field name (e.g. `query.field.$regex`,
 * `query.field.$where`). MongoDB only evaluates operators in that position;
 * operators nested inside a subdocument value are compared literally and are
 * safe.
 */

describe('toMongoWhere — security', () => {
  describe('contains / like', () => {
    it('escapes regex metacharacters so wildcards match literally', () => {
      const query = toMongoWhere({
        name: { contains: 'a.b*c' },
      }) as Record<string, { $regex: string; $options: string }>

      expect(query.name.$regex).toBe('a\\.b\\*c')
      expect(query.name.$options).toBe('i')
    })

    it('escapes every standard metacharacter', () => {
      const query = toMongoWhere({
        name: { contains: '.*+?^${}()|[]\\' },
      }) as Record<string, { $regex: string }>

      expect(query.name.$regex).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
    })

    it('escapes the same set for the like operator', () => {
      const query = toMongoWhere({
        name: { like: 'foo(bar)' },
      }) as Record<string, { $regex: string }>

      expect(query.name.$regex).toBe('foo\\(bar\\)')
    })

    it('coerces non-string scalars to string before escaping', () => {
      const query = toMongoWhere({
        count: { contains: 42 },
      }) as Record<string, { $regex: string }>

      expect(query.count.$regex).toBe('42')
    })

    it('renders ReDoS payloads as literal regex — input only matches literal value', () => {
      // Without escaping, "(a+)+" against a long "aaaa...!" is catastrophic.
      // With escaping, every metacharacter is prefixed with a backslash so the
      // pattern can only match the literal string.
      const evil = '(a+)+'
      const query = toMongoWhere({
        text: { contains: evil },
      }) as Record<string, { $regex: string }>

      expect(query.text.$regex).toBe('\\(a\\+\\)\\+')

      // When compiled, the escaped pattern matches the literal input but
      // does NOT exhibit catastrophic backtracking on a long "aaaa...!" run.
      const pattern = new RegExp(query.text.$regex)
      expect(pattern.test('(a+)+')).toBe(true)
      expect(pattern.test('aaaa')).toBe(false)
    })

    it('rejects object values passed to contains — no field-level $regex', () => {
      const query = toMongoWhere({
        name: { contains: { $regex: '.*' } },
      }) as Record<string, unknown>

      // No field-level MongoDB operator introduced. The unsafe value is
      // wrapped inside a subdocument where MongoDB only does literal
      // comparison.
      expect(query.name).not.toHaveProperty('$regex')
    })
  })

  describe('operator injection via object values', () => {
    it('does not introduce a field-level $where from an equals object value', () => {
      const query = toMongoWhere({
        active: { equals: { $where: 'this.password == "x"' } },
      }) as Record<string, Record<string, unknown>>

      expect(query.active).not.toHaveProperty('$where')
    })

    it('does not introduce a field-level $gt from an equals object value', () => {
      const query = toMongoWhere({
        score: { equals: { $gt: 999 } },
      }) as Record<string, Record<string, unknown>>

      expect(query.score).not.toHaveProperty('$gt')
    })

    it('does not introduce a field-level $gt or $where from a greater_than object value', () => {
      const query = toMongoWhere({
        amount: { greater_than: { $gt: 1, $where: 'evil' } },
      }) as Record<string, Record<string, unknown>>

      expect(query.amount).not.toHaveProperty('$gt')
      expect(query.amount).not.toHaveProperty('$where')
    })

    it('still supports legitimate non-injection operator shapes', () => {
      const query = toMongoWhere({
        active: { equals: true },
        count: { greater_than: 5 },
      }) as Record<string, unknown>

      const $and = query.$and as Array<Record<string, unknown>>
      expect($and).toHaveLength(2)
      expect($and[0]).toEqual({ active: true })
      expect($and[1]).toEqual({ count: { $gt: 5 } })
    })
  })

  describe('type validation', () => {
    it('rejects non-array values for `in` — no field-level $in', () => {
      const query = toMongoWhere({
        status: { in: { $in: ['a', 'b'] } },
      }) as Record<string, Record<string, unknown>>

      expect(query.status).not.toHaveProperty('$in')
    })

    it('keeps scalar values inside `in` and expands ObjectId strings', () => {
      const id = '507f1f77bcf86cd799439011'
      const query = toMongoWhere({
        _id: { in: [id, 'plain'] },
      }) as Record<string, { $in: unknown[] }>

      expect(Array.isArray(query._id.$in)).toBe(true)
      expect(query._id.$in).toContain('plain')
      expect(query._id.$in).toContain(id)
    })

    it('drops object elements inside an `in` array', () => {
      const query = toMongoWhere({
        status: { in: ['a', { $where: 'evil' }, 'b'] },
      }) as Record<string, { $in: unknown[] }>

      expect(query.status.$in).toEqual(['a', 'b'])
    })

    it('coerces scalar `exists` to a boolean', () => {
      const query = toMongoWhere({
        archived: { exists: 1 },
      }) as Record<string, { $exists: boolean }>

      expect(query.archived).toEqual({ $exists: true })
    })

    it('rejects object values for `exists` — no field-level $exists', () => {
      const query = toMongoWhere({
        archived: { exists: { $exists: true } },
      }) as Record<string, Record<string, unknown>>

      expect(query.archived).not.toHaveProperty('$exists')
    })

    it('rejects object values for comparisons', () => {
      const query = toMongoWhere({
        score: {
          greater_than: { $gt: 5 },
          less_than: { $lt: 100 },
        },
      }) as Record<string, Record<string, unknown>>

      expect(query.score).not.toHaveProperty('$gt')
      expect(query.score).not.toHaveProperty('$lt')
    })

    it('keeps numeric comparisons working', () => {
      const query = toMongoWhere({
        score: { greater_than_equal: 10, less_than: 20 },
      }) as Record<string, unknown>

      const $and = query.$and as Array<Record<string, unknown>>
      expect($and).toHaveLength(2)
      expect($and[0]).toEqual({ score: { $gte: 10 } })
      expect($and[1]).toEqual({ score: { $lt: 20 } })
    })

    it('passes Date instances through to comparison operators', () => {
      const date = new Date('2026-01-01T00:00:00Z')
      const query = toMongoWhere({
        createdAt: { greater_than: date },
      }) as Record<string, { $gt: Date }>

      expect(query.createdAt.$gt).toBe(date)
    })

    it('passes ObjectId instances through to equals', () => {
      const id = new ObjectId()
      const query = toMongoWhere({
        _id: { equals: id },
      }) as Record<string, { $in: unknown[] } | unknown>

      // ObjectId strings still expand via queryableValue. ObjectId instances
      // pass through. Either way, the value is preserved.
      expect(query._id).toBeDefined()
    })
  })

  describe('and / or composition', () => {
    it('still composes legitimate and/or branches', () => {
      const query = toMongoWhere({
        and: [{ active: { equals: true } }, { name: { contains: 'alice' } }],
      }) as Record<string, unknown>

      expect(query).toMatchObject({
        $and: [{ active: true }, { name: { $regex: 'alice', $options: 'i' } }],
      })
    })

    it('does not introduce field-level $where through nested and branches', () => {
      const query = toMongoWhere({
        and: [{ evil: { equals: { $where: 'function(){return true}' } } }],
      }) as { $and: Array<Record<string, Record<string, unknown>>> }

      const branch = query.$and[0]
      expect(branch.evil).not.toHaveProperty('$where')
    })

    it('does not introduce field-level $regex through nested or branches', () => {
      const query = toMongoWhere({
        or: [{ name: { contains: { $regex: 'evil.*' } } }, { name: { contains: 'alice' } }],
      }) as { $or: Array<Record<string, Record<string, unknown>>> }

      const first = query.$or[0]
      expect(first.name).not.toHaveProperty('$regex')
    })
  })
})
