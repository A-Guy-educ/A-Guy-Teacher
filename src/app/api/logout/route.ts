import { NextRequest, NextResponse } from 'next/server'

import { getWebOrigin, isTeacherOrigin, requestLogout } from '../../../server/aguy-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID()

  if (!isTeacherOrigin(request.headers.get('origin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const upstream = await requestLogout(request.headers.get('cookie'), { requestId })
    const response = NextResponse.json(
      upstream.ok
        ? { success: true, redirectTo: getWebOrigin().origin }
        : { error: 'Logout failed' },
      {
        status: upstream.ok ? 200 : upstream.status,
        headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId },
      },
    )

    for (const cookie of upstream.headers.getSetCookie()) {
      response.headers.append('Set-Cookie', cookie)
    }

    return response
  } catch (error) {
    console.error('Teacher shared logout proxy failed', { error, requestId })
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } },
    )
  }
}
