import { NextRequest, NextResponse } from 'next/server'

import {
  appendAuthCookieClearHeaders,
  revokeSession,
  tokenFromHeaders,
} from '@/infra/auth/web-auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // public endpoint: logout only revokes the caller's own session
  await revokeSession(tokenFromHeaders(request.headers))

  const res = NextResponse.json({ success: true })
  appendAuthCookieClearHeaders(res.headers)
  return res
}
