import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getWebUser } from '@/infra/web-api/mongo-payload'
import {
  consumeAccessCodeUse,
  findAccessCode,
  grantCourseByCode,
  hasCourseGrant,
} from '@/server/services/entitlement-grants'

const BodySchema = z.object({
  code: z.string().trim().min(1),
})

export async function POST(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) {
    return NextResponse.json({ success: false, error: 'authentication_required' }, { status: 401 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'code_required' }, { status: 400 })
  }

  const accessCode = await findAccessCode(parsed.data.code.trim().toUpperCase())

  if (!accessCode) {
    return NextResponse.json({ success: false, error: 'invalid_code' }, { status: 404 })
  }
  if (!accessCode.isActive) {
    return NextResponse.json({ success: false, error: 'code_inactive' }, { status: 400 })
  }
  if (accessCode.expiresAt && new Date(accessCode.expiresAt) < new Date()) {
    return NextResponse.json({ success: false, error: 'code_expired' }, { status: 400 })
  }

  const courseId = String(accessCode.course)

  if (await hasCourseGrant(user.id, courseId)) {
    return NextResponse.json({ success: false, error: 'already_entitled' }, { status: 409 })
  }

  // Consume before granting: if the code turns out to be exhausted, nothing
  // has been given away.
  if (!(await consumeAccessCodeUse(accessCode))) {
    return NextResponse.json({ success: false, error: 'code_exhausted' }, { status: 409 })
  }

  await grantCourseByCode(user.id, courseId, accessCode)

  return NextResponse.json({ success: true, courseId })
}
