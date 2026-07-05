import { NextRequest, NextResponse } from 'next/server'

import { getContentDb, serializeDoc } from '@/infra/db/content-db'

function localeFromRequest(request: NextRequest) {
  return (
    request.cookies.get('NEXT_LOCALE')?.value || request.cookies.get('aguy-locale')?.value || 'he'
  )
}

export function isPublicTeacherProfile(profile: Record<string, unknown>) {
  const slug = String(profile.slug || '')
    .trim()
    .toLowerCase()
  const label = String(profile.label || '')
    .trim()
    .toLowerCase()
  const description = String(profile.description || '')
    .trim()
    .toLowerCase()

  return !(
    slug === 'settings-test-teacher' ||
    label === 'settings test teacher' ||
    description.includes('settings tests')
  )
}

export async function GET(request: NextRequest) {
  const db = await getContentDb()
  const locale = localeFromRequest(request)
  const docs = await db
    .collection('teacher_profiles')
    .find({
      isEnabled: true,
      $or: [{ locale }, { locale: { $exists: false } }],
    })
    .sort({ locale: -1, createdAt: 1 })
    .toArray()

  const seen = new Set<string>()
  const profiles = docs.flatMap((doc) => {
    const profile = serializeDoc<Record<string, unknown>>(doc)
    if (!isPublicTeacherProfile(profile)) return []

    const slug = String(profile.slug || '')
    if (!slug || seen.has(slug)) return []
    seen.add(slug)
    return [
      {
        id: String(profile.id),
        slug,
        label: String(profile.label || slug),
        description: String(profile.description || ''),
        isEnabled: profile.isEnabled !== false,
      },
    ]
  })

  return NextResponse.json({ profiles })
}
