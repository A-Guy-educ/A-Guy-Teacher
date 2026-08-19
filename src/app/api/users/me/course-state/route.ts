import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/server/auth/api-auth'

export const runtime = 'nodejs'

/**
 * Web-side proxy for Admin's `PATCH /api/users/me/course-state`.
 *
 * Web users authenticate against Web, not Admin — their browser has no Admin
 * cookie to send cross-origin, so a direct client-to-Admin PATCH always 401s.
 * This route bridges the gap: Web verifies its own session (knows who is
 * calling), then vouches for the user id to Admin using the shared
 * `ADMIN_SERVICE_TOKEN`. Admin trusts the token, never the client.
 *
 * Same-origin from the browser, so no CORS or cross-site cookie concerns.
 * Called from the three client triggers in `currentCourseSync.ts`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL
  const serviceToken = process.env.ADMIN_SERVICE_TOKEN
  if (!adminUrl || !serviceToken) {
    // Misconfiguration — fail closed but do not leak which piece is missing.
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 })
  }

  let clientBody: { currentCourse?: unknown } = {}
  try {
    clientBody = (await request.json()) as { currentCourse?: unknown }
  } catch {
    // Empty body is valid (refresh lastLoginAt only) — carry on with defaults.
  }

  const forwardBody: Record<string, string> = { userId: auth.value.id }
  if (typeof clientBody.currentCourse === 'string' && clientBody.currentCourse.length > 0) {
    forwardBody.currentCourse = clientBody.currentCourse
  }

  try {
    const adminResponse = await fetch(`${adminUrl}/api/users/me/course-state`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': serviceToken,
      },
      body: JSON.stringify(forwardBody),
    })

    // Mirror Admin's response verbatim so client-side handling stays uniform
    // regardless of whether the call went via proxy or directly.
    const text = await adminResponse.text()
    return new NextResponse(text, {
      status: adminResponse.status,
      headers: { 'content-type': adminResponse.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Upstream unreachable' }, { status: 502 })
  }
}
