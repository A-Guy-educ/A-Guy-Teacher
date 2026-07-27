import { NextResponse } from 'next/server'

import { appendAuthCookieClearHeaders } from '@/infra/auth/web-auth'

export async function POST(): Promise<NextResponse> {
  // public endpoint: logout only clears the caller's own authentication cookies
  const res = NextResponse.json({ success: true })
  appendAuthCookieClearHeaders(res.headers)
  return res
}
