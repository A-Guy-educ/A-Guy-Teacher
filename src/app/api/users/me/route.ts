import { NextRequest, NextResponse } from 'next/server'

import {
  appendAuthCookieClearHeaders,
  getSessionFromToken,
  tokenFromHeaders,
} from '@/infra/auth/web-auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = tokenFromHeaders(request.headers)
  const session = await getSessionFromToken(token)
  if (!session) {
    // Stale/invalid token: clear every cookie variant so the next request hits
    // the middleware login redirect instead of looping through 401s while the
    // UI thinks the user is signed in.
    const res = NextResponse.json({ user: null }, { status: 401 })
    if (token) appendAuthCookieClearHeaders(res.headers)
    return res
  }
  return NextResponse.json({ user: session.user })
}
