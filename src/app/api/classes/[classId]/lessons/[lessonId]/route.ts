import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isTeacherOrigin, setLessonHidden } from '../../../../../../server/aguy-api'
import { isDemoDataEnabled } from '../../../../../../server/demo-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ hidden: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; lessonId: string }> },
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const headers = { 'Cache-Control': 'no-store', 'X-Request-ID': requestId }

  if (!isTeacherOrigin(request.headers.get('origin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers })
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers })
  }

  const { classId, lessonId } = await params
  const { hidden } = body.data

  // Demo classes don't exist on Web, so the switch only lasts until the page reloads.
  if (isDemoDataEnabled()) return NextResponse.json({ lessonId, hidden }, { headers })

  try {
    const upstream = await setLessonHidden(
      request.headers.get('cookie'),
      classId,
      lessonId,
      hidden,
      { requestId },
    )
    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Saving lesson visibility failed' },
        { status: upstream.status, headers },
      )
    }
    return NextResponse.json(await upstream.json(), { headers })
  } catch (error) {
    console.error('Teacher lesson visibility proxy failed', { error, requestId })
    return NextResponse.json({ error: 'Saving lesson visibility failed' }, { status: 502, headers })
  }
}
