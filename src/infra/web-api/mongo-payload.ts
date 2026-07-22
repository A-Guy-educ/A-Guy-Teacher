import { ObjectId, type Document, type Filter } from 'mongodb'
import { NextResponse } from 'next/server'

import { getSessionFromToken, tokenFromHeaders } from '@/infra/auth/web-auth'
import { getContentDb, objectIdFromString, relationId, serializeDoc } from '@/infra/db/content-db'

type Where = Record<string, unknown>
type Sort = string | Record<string, 1 | -1> | undefined

export const GUEST_SESSION_COOKIE = 'guest_session'

const COLLECTION_ALIASES: Record<string, string> = {
  'user-progress': 'user-progresses',
}

function collectionName(slug: string) {
  return COLLECTION_ALIASES[slug] ?? slug
}

function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && ObjectId.isValid(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  if (value instanceof Date) return false
  if (value instanceof ObjectId) return false
  return true
}

function escapeRegex(value: unknown): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function queryableValue(value: unknown) {
  if (isObjectIdString(value)) return { $in: [value, new ObjectId(value)] }
  return value
}

function isScalar(value: unknown): boolean {
  if (value === null || value === undefined) return true
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
    return true
  }
  if (type === 'object') {
    return value instanceof Date || value instanceof ObjectId
  }
  return false
}

function fieldQuery(field: string, condition: unknown): Filter<Document> {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    return { [field]: queryableValue(condition) }
  }

  const clauses: Filter<Document>[] = []
  for (const [operator, rawValue] of Object.entries(condition as Record<string, unknown>)) {
    // Reject operator injection: a plain object as an operator value (e.g.
    // { $where: '...' } or { $gt: 1 }) is never a legitimate input here.
    if (isPlainObject(rawValue)) continue

    if (operator === 'equals') clauses.push({ [field]: queryableValue(rawValue) })
    if (operator === 'not_equals') clauses.push({ [field]: { $ne: rawValue } })
    if (operator === 'in' && Array.isArray(rawValue)) {
      const values = rawValue
        .filter((value) => !isPlainObject(value))
        .flatMap((value) => (isObjectIdString(value) ? [value, new ObjectId(value)] : [value]))
      if (values.length > 0) clauses.push({ [field]: { $in: values } })
    }
    if (operator === 'exists' && isScalar(rawValue)) {
      clauses.push({ [field]: { $exists: Boolean(rawValue) } })
    }
    if ((operator === 'contains' || operator === 'like') && isScalar(rawValue)) {
      clauses.push({ [field]: { $regex: escapeRegex(rawValue), $options: 'i' } })
    }
    if (operator === 'greater_than' && isScalar(rawValue)) {
      clauses.push({ [field]: { $gt: rawValue } })
    }
    if (operator === 'greater_than_equal' && isScalar(rawValue)) {
      clauses.push({ [field]: { $gte: rawValue } })
    }
    if (operator === 'less_than' && isScalar(rawValue)) {
      clauses.push({ [field]: { $lt: rawValue } })
    }
    if (operator === 'less_than_equal' && isScalar(rawValue)) {
      clauses.push({ [field]: { $lte: rawValue } })
    }
  }

  if (clauses.length === 0) return { [field]: condition }
  if (clauses.length === 1) return clauses[0] ?? {}
  return { $and: clauses }
}

export function toMongoWhere(where?: Where): Filter<Document> {
  if (!where) return {}

  const clauses: Filter<Document>[] = []
  for (const [key, value] of Object.entries(where)) {
    if (key === 'and' && Array.isArray(value)) {
      clauses.push({ $and: value.map((entry) => toMongoWhere(entry as Where)) })
    } else if (key === 'or' && Array.isArray(value)) {
      clauses.push({ $or: value.map((entry) => toMongoWhere(entry as Where)) })
    } else {
      clauses.push(fieldQuery(key, value))
    }
  }

  if (clauses.length === 0) return {}
  if (clauses.length === 1) return clauses[0] ?? {}
  return { $and: clauses }
}

function toMongoSort(sort: Sort): Record<string, 1 | -1> {
  if (!sort) return {}
  if (typeof sort === 'object') return sort
  const direction = sort.startsWith('-') ? -1 : 1
  const field = sort.replace(/^-/, '')
  return { [field]: direction }
}

function cleanData(data: Record<string, unknown>) {
  const out = { ...data }
  delete out.id
  delete out._id
  return out
}

export async function getWebPayload() {
  const db = await getContentDb()

  return {
    db,
    async auth({ headers }: { headers: Headers }) {
      const session = await getSessionFromToken(tokenFromHeaders(headers))
      return { user: session?.user ?? null }
    },
    async find(args: {
      collection: string
      where?: Where
      limit?: number
      page?: number
      sort?: Sort
      depth?: number
      pagination?: boolean
    }) {
      const limit = args.limit ?? 10
      const page = Math.max(args.page ?? 1, 1)
      const skip = args.pagination === false ? 0 : (page - 1) * limit
      const collection = db.collection(collectionName(args.collection))
      const query = toMongoWhere(args.where)
      const cursor = collection.find(query).sort(toMongoSort(args.sort))
      if (args.pagination !== false) cursor.skip(skip)
      if (limit > 0) cursor.limit(limit)
      const [docs, totalDocs] = await Promise.all([
        cursor.toArray(),
        collection.countDocuments(query),
      ])

      return {
        docs: docs.map((doc) => serializeDoc(doc)),
        totalDocs,
        limit,
        page,
        totalPages: limit > 0 ? Math.ceil(totalDocs / limit) || 1 : 1,
        hasNextPage: page * limit < totalDocs,
        hasPrevPage: page > 1,
      }
    },
    async findByID(args: { collection: string; id: string }) {
      const doc = await db
        .collection(collectionName(args.collection))
        .findOne({ _id: objectIdFromString(args.id) } as Document)
      return doc ? serializeDoc(doc) : null
    },
    async create(args: { collection: string; data: Record<string, unknown> }) {
      const now = new Date()
      const data = { ...cleanData(args.data), createdAt: now, updatedAt: now }
      const collection = db.collection(collectionName(args.collection))
      const result = await collection.insertOne(data)
      const doc = await collection.findOne({ _id: result.insertedId })
      return serializeDoc(doc)
    },
    async update(args: {
      collection: string
      id?: string
      where?: Where
      data: Record<string, unknown>
    }) {
      const update = { $set: { ...cleanData(args.data), updatedAt: new Date() } }
      const collection = db.collection(collectionName(args.collection))
      if (args.id) {
        const idFilter = { _id: objectIdFromString(args.id) } as Document
        await collection.updateOne(idFilter, update)
        const doc = await collection.findOne(idFilter)
        return serializeDoc(doc)
      }
      const query = toMongoWhere(args.where)
      await collection.updateMany(query, update)
      const docs = await collection.find(query).toArray()
      return { docs: docs.map((doc) => serializeDoc(doc)) }
    },
    async delete(args: { collection: string; id?: string; where?: Where }) {
      const collection = db.collection(collectionName(args.collection))
      if (args.id) {
        const idFilter = { _id: objectIdFromString(args.id) } as Document
        const doc = await collection.findOne(idFilter)
        await collection.deleteOne(idFilter)
        return serializeDoc(doc)
      }
      const query = toMongoWhere(args.where)
      const docs = await collection.find(query).toArray()
      await collection.deleteMany(query)
      return { docs: docs.map((doc) => serializeDoc(doc)) }
    },
  }
}

export type WebPayload = Awaited<ReturnType<typeof getWebPayload>>

export async function getWebUser(headers: Headers) {
  const session = await getSessionFromToken(tokenFromHeaders(headers))
  return session?.user ?? null
}

export function getOrCreateGuestId(request: Request) {
  const existing = request.headers
    .get('cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${GUEST_SESSION_COOKIE}=`))
    ?.slice(GUEST_SESSION_COOKIE.length + 1)

  return existing || crypto.randomUUID()
}

export function withGuestCookie<T extends NextResponse>(response: T, guestId: string) {
  response.cookies.set(GUEST_SESSION_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

export function publicUserId(user: { id?: unknown } | null, guestId: string) {
  return user?.id ? relationId(user.id) || String(user.id) : `guest:${guestId}`
}
