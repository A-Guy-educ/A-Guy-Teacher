/**
 * Seeding helper for browser tests.
 *
 * 37 of the 79 collections carry a MongoDB schema validator, and the fields
 * they most often require are the ones Payload used to fill in for you —
 * `tenant` on 16 of them, `locale` on 8. `getWebPayload().create()` inserts
 * exactly what it is handed, so every test that seeded content started failing
 * with "Document failed validation" once Payload was removed.
 *
 * Rather than adding the same two fields to dozens of call sites, seed through
 * `seedDoc` and it supplies them when the collection asks for them and the test
 * has not.
 *
 * Deliberately test-only: the application should keep inserting exactly what it
 * means to, and a service that quietly invents a tenant would hide real bugs.
 */

import { getContentDb } from '@/infra/db/content-db'
import { getWebPayload } from '@/infra/web-api/mongo-payload'
import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'

/** Cached per run: the validator list does not change mid-suite. */
const requiredFieldsByCollection = new Map<string, Set<string>>()
let defaultTenantId: string | undefined

/**
 * The fields a collection's validator insists on, or an empty set when it has
 * no validator.
 */
async function requiredFields(collection: string): Promise<Set<string>> {
  const cached = requiredFieldsByCollection.get(collection)
  if (cached) return cached

  const db = await getContentDb()
  const [info] = await db.listCollections({ name: collection }).toArray()
  const required = new Set<string>(
    (info?.options?.validator?.$jsonSchema?.required as string[] | undefined) ?? [],
  )

  requiredFieldsByCollection.set(collection, required)
  return required
}

/** The default tenant, created on first use so a fresh database works. */
export async function ensureDefaultTenant(): Promise<string> {
  if (defaultTenantId) return defaultTenantId

  const db = await getContentDb()
  const slug = getDefaultTenantSlug()
  const existing = await db.collection('tenants').findOne({ slug })

  if (existing) {
    defaultTenantId = String(existing._id)
    return defaultTenantId
  }

  const now = new Date()
  const created = await db
    .collection('tenants')
    .insertOne({ name: slug, slug, status: 'active', createdAt: now, updatedAt: now })

  defaultTenantId = String(created.insertedId)
  return defaultTenantId
}

/**
 * Create a document, filling in the required fields a test should not have to
 * care about.
 *
 * Only ever adds a field the validator requires and the caller omitted, so a
 * test that sets its own tenant or locale keeps it.
 */
export async function seedDoc<T extends Record<string, unknown>>(
  collection: string,
  data: T,
): Promise<Record<string, unknown>> {
  const required = await requiredFields(collection)
  const filled: Record<string, unknown> = { ...data }

  if (required.has('tenant') && filled.tenant === undefined) {
    filled.tenant = await ensureDefaultTenant()
  }
  if (required.has('locale') && filled.locale === undefined) {
    filled.locale = 'he'
  }

  const payload = await getWebPayload()
  return payload.create({ collection, data: filled })
}

/**
 * A seeding client shaped exactly like `getWebPayload()`, whose `create` fills
 * in the required fields tests should not have to care about.
 *
 * Swapping `getWebPayload()` for this is a one-line change per file, rather
 * than editing every `create` call — and it keeps working as tests add more.
 */
export async function getSeedPayload() {
  const payload = await getWebPayload()

  return {
    ...payload,
    create: async (args: { collection: string; data: Record<string, unknown> }) =>
      seedDoc(args.collection, args.data),
  }
}

export type SeedPayload = Awaited<ReturnType<typeof getSeedPayload>>

/**
 * Report which required fields are still missing, for a clearer failure than
 * "Document failed validation".
 */
export async function missingRequiredFields(
  collection: string,
  data: Record<string, unknown>,
): Promise<string[]> {
  const required = await requiredFields(collection)
  return [...required].filter((field) => data[field] === undefined)
}
