import { MongoClient, ObjectId, type Db } from 'mongodb'

type JsonObject = Record<string, unknown>

declare global {
  var __aguyMongoClientPromise: Promise<MongoClient> | undefined
  var __aguyPaymentIndexesPromise: Promise<void> | undefined
}

function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required')
  }
  return url
}

async function ensurePaymentIndexes(db: Db): Promise<void> {
  if (!globalThis.__aguyPaymentIndexesPromise) {
    globalThis.__aguyPaymentIndexesPromise = Promise.all([
      db
        .collection('user-entitlements')
        .createIndex(
          { user: 1, course: 1 },
          { name: 'user_entitlements_user_course_unique', unique: true },
        ),
      db
        .collection('enrollments')
        .createIndex(
          { user: 1, course: 1 },
          { name: 'enrollments_user_course_unique', unique: true },
        ),
    ]).then(() => undefined)
  }

  await globalThis.__aguyPaymentIndexesPromise
}

export async function getContentDb(): Promise<Db> {
  if (!globalThis.__aguyMongoClientPromise) {
    globalThis.__aguyMongoClientPromise = new MongoClient(getConnectionString()).connect()
  }

  const client = await globalThis.__aguyMongoClientPromise
  const db = client.db()
  await ensurePaymentIndexes(db)
  return db
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

  const output: JsonObject = {}
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    output[key === '_id' ? 'id' : key] = serializeDoc(value)
  }
  return output as T
}
