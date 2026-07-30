import { NextRequest } from 'next/server'
import { z } from 'zod'

import { getWebUser } from '@/infra/web-api/mongo-payload'
import {
  findTeacherProfileBySlug,
  getUserSettings,
  setTeacherProfile,
} from '@/server/services/user-settings'

const PatchSchema = z.object({
  teacherProfileSlug: z.string().min(1),
})

function localeFromRequest(request: NextRequest) {
  return (
    request.cookies.get('NEXT_LOCALE')?.value || request.cookies.get('aguy-locale')?.value || 'he'
  )
}

export async function GET(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getUserSettings(user.id, localeFromRequest(request))
  return Response.json({ settings })
}

export async function PATCH(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const profile = await findTeacherProfileBySlug(
    parsed.data.teacherProfileSlug,
    localeFromRequest(request),
  )
  if (!profile) {
    return Response.json({ error: 'Teacher profile not found or disabled' }, { status: 404 })
  }

  const id = await setTeacherProfile(user.id, profile._id)

  return Response.json({
    success: true,
    settings: { id, teacherProfileSlug: parsed.data.teacherProfileSlug },
  })
}
