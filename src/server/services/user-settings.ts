/**
 * User Settings Service
 *
 * @fileType service
 * @domain user-settings
 * @pattern repository
 * @ai-summary Reads and writes a user's settings and resolves their chosen teacher profile. All `user_settings` and `teacher_profiles` queries live here; the API route only translates HTTP.
 */

import { ObjectId } from 'mongodb'

import { getContentDb, relationId, serializeDoc } from '@/infra/db/content-db'
import { idCandidates } from '@/server/web-api/progress'

export type TeacherProfileSummary = {
  slug: string
  label: string
  description: string
}

export type UserSettingsRecord = {
  id: string | null
  teacherProfile: TeacherProfileSummary | null
}

/**
 * A profile is offered in the caller's language, or in no language at all.
 *
 * Profiles without a `locale` are shared across languages, so they must match
 * every request rather than none — hence the `$exists` branch.
 */
function enabledInLocale(slug: string, locale: string) {
  return {
    slug,
    isEnabled: true,
    $or: [{ locale }, { locale: { $exists: false } }],
  }
}

function toSummary(profile: Record<string, unknown> | null): TeacherProfileSummary | null {
  if (!profile) return null

  return {
    slug: String(profile.slug || ''),
    label: String(profile.label || profile.slug || ''),
    description: String(profile.description || ''),
  }
}

/** The enabled profile with this slug, in the given language, or `null`. */
export async function findTeacherProfileBySlug(slug: string, locale: string) {
  const db = await getContentDb()
  return db.collection('teacher_profiles').findOne(enabledInLocale(slug, locale))
}

/**
 * Resolve a stored profile reference — which may be an id or a slug — into the
 * version shown in the caller's language.
 *
 * Two steps on purpose: the stored reference identifies *which* profile, and
 * the second lookup finds the language variant of it. Returns `null` when the
 * profile has since been disabled.
 */
export async function resolveTeacherProfile(
  reference: unknown,
  locale: string,
): Promise<TeacherProfileSummary | null> {
  const id = relationId(reference)
  if (!id) return null

  const db = await getContentDb()
  const stored = ObjectId.isValid(id)
    ? await db.collection('teacher_profiles').findOne({ _id: new ObjectId(id) })
    : await db.collection('teacher_profiles').findOne({ slug: id })

  const slug = stored?.slug
  const localized = slug
    ? await db.collection('teacher_profiles').findOne(enabledInLocale(String(slug), locale))
    : stored

  return toSummary(localized ? serializeDoc<Record<string, unknown>>(localized) : null)
}

async function findSettingsDoc(userId: string) {
  const db = await getContentDb()
  return db.collection('user_settings').findOne({ user: { $in: idCandidates(userId) } })
}

/** A user's settings, with their teacher profile resolved for display. */
export async function getUserSettings(userId: string, locale: string): Promise<UserSettingsRecord> {
  const settings = await findSettingsDoc(userId)

  return {
    id: settings?._id?.toString() ?? null,
    teacherProfile: await resolveTeacherProfile(settings?.teacherProfile, locale),
  }
}

/**
 * Point the user at a teacher profile, creating their settings record if this
 * is the first thing they have ever chosen.
 */
export async function setTeacherProfile(
  userId: string,
  profileId: unknown,
): Promise<string | null> {
  const db = await getContentDb()
  const now = new Date()
  const userValue = ObjectId.isValid(userId) ? new ObjectId(userId) : userId

  await db.collection('user_settings').updateOne(
    { user: { $in: idCandidates(userId) } },
    {
      $set: { teacherProfile: profileId, updatedAt: now },
      $setOnInsert: { user: userValue, createdAt: now },
    },
    { upsert: true },
  )

  const settings = await findSettingsDoc(userId)
  return settings?._id?.toString() ?? null
}

/** Every enabled teacher profile offered in the given language. */
export async function listTeacherProfiles(locale: string) {
  const db = await getContentDb()

  return (
    db
      .collection('teacher_profiles')
      .find({
        isEnabled: true,
        $or: [{ locale }, { locale: { $exists: false } }],
      })
      // Language-specific rows sort ahead of language-neutral ones, so the
      // de-duplication by slug downstream keeps the localized variant.
      .sort({ locale: -1, createdAt: 1 })
      .toArray()
  )
}
