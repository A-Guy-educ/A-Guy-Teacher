import { MongoClient, ObjectId, type Db, type Document, type Sort } from 'mongodb'

type JsonObject = Record<string, unknown>

declare global {
  var __aguyMongoClientPromise: Promise<MongoClient> | undefined
}

let defaultTenantFilterPromise: Promise<Document> | null = null

function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required to read web content')
  }
  return url
}

export async function getContentDb(): Promise<Db> {
  if (!globalThis.__aguyMongoClientPromise) {
    globalThis.__aguyMongoClientPromise = new MongoClient(getConnectionString()).connect()
  }

  const client = await globalThis.__aguyMongoClientPromise
  return client.db()
}

export async function defaultTenantFilter(): Promise<Document> {
  if (!defaultTenantFilterPromise) {
    defaultTenantFilterPromise = (async () => {
      const slug = process.env.DEFAULT_TENANT_SLUG
      if (!slug) return {}

      const db = await getContentDb()
      const tenant = await db.collection('tenants').findOne({ slug }, { projection: { _id: 1 } })
      return tenant?._id ? { tenant: tenant._id } : {}
    })()
  }

  return defaultTenantFilterPromise
}

export function objectIdFromString(id: string): ObjectId | string {
  return ObjectId.isValid(id) ? new ObjectId(id) : id
}

export function relationId(value: unknown): string | null {
  if (!value) return null
  if (value instanceof ObjectId) return value.toString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const record = value as { id?: unknown; _id?: unknown }
    return relationId(record.id ?? record._id)
  }
  return null
}

export function serializeDoc<T = JsonObject>(doc: unknown): T {
  if (doc instanceof ObjectId) return doc.toString() as T
  if (doc instanceof Date) return doc.toISOString() as T
  if (Array.isArray(doc)) return doc.map((item) => serializeDoc(item)) as T
  if (!doc || typeof doc !== 'object') return doc as T

  const source = doc as Record<string, unknown>
  const output: JsonObject = {}

  for (const [key, value] of Object.entries(source)) {
    if (key === '_id') {
      output.id = relationId(value)
    } else {
      output[key] = serializeDoc(value)
    }
  }

  return output as T
}

export async function findOneSerialized<T = JsonObject>(
  collection: string,
  filter: Document,
  options: { sort?: Sort; projection?: Document } = {},
): Promise<T | null> {
  const db = await getContentDb()
  const doc = await db.collection(collection).findOne(filter, options)
  return doc ? serializeDoc<T>(doc) : null
}

export async function findByIdSerialized<T = JsonObject>(
  collection: string,
  id: string,
): Promise<T | null> {
  return findOneSerialized<T>(collection, { _id: objectIdFromString(id) })
}

export async function findManySerialized<T = JsonObject>(
  collection: string,
  filter: Document,
  options: { sort?: Sort; limit?: number; skip?: number; projection?: Document } = {},
): Promise<T[]> {
  const db = await getContentDb()
  const cursor = db.collection(collection).find(filter, options)
  if (options.sort) cursor.sort(options.sort)
  if (options.skip) cursor.skip(options.skip)
  if (options.limit) cursor.limit(options.limit)
  const docs = await cursor.toArray()
  return docs.map((doc) => serializeDoc<T>(doc))
}

export async function countDocs(collection: string, filter: Document): Promise<number> {
  const db = await getContentDb()
  return db.collection(collection).countDocuments(filter)
}

/**
 * Run an aggregation pipeline and serialize the resulting docs (e.g. exercises
 * with their child sections populated). Mirrors `findManySerialized` so callers
 * get the same shape: `_id` → `id`, ObjectId/Date normalized.
 *
 * The pipeline is responsible for `$match` (if any) and `$limit` (if any); this
 * helper handles sorting, skipping, and serialization only when those inputs
 * are provided. Sorting in a `$sort` stage is fine — the helper just forwards.
 */
export async function aggregateManySerialized<T = JsonObject>(
  collection: string,
  pipeline: Document[],
  options: { sort?: Sort; limit?: number; skip?: number } = {},
): Promise<T[]> {
  const db = await getContentDb()
  const stages: Document[] = [...pipeline]
  if (options.sort) stages.push({ $sort: options.sort })
  if (options.skip) stages.push({ $skip: options.skip })
  if (options.limit) stages.push({ $limit: options.limit })
  const docs = await db.collection(collection).aggregate(stages).toArray()
  return docs.map((doc) => serializeDoc<T>(doc))
}

/**
 * Single-doc variant of `aggregateManySerialized` — adds a `$limit: 1` and
 * returns `null` when the pipeline yields nothing.
 */
export async function aggregateOneSerialized<T = JsonObject>(
  collection: string,
  pipeline: Document[],
): Promise<T | null> {
  const docs = await aggregateManySerialized<T>(collection, pipeline, { limit: 1 })
  return docs[0] ?? null
}

export function publishedActiveFilter(extra: Document = {}): Document {
  return {
    ...extra,
    status: 'published',
    isActive: true,
  }
}

export function visibleContentFilter(extra: Document = {}): Document {
  return {
    ...publishedActiveFilter(extra),
    $or: [{ contentStatus: { $ne: 'soon' } }, { contentStatusVisible: true }],
  }
}

export function localeFilter(locale?: string): Document {
  if (!locale) return {}
  return { $or: [{ locale }, { locale: { $exists: false } }] }
}

export function andFilter(...filters: Document[]): Document {
  const compact = filters.filter((filter) => Object.keys(filter).length > 0)
  if (compact.length === 0) return {}
  if (compact.length === 1) return compact[0]
  return { $and: compact }
}
