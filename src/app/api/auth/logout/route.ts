import { NextResponse } from 'next/server'

import { appendAuthCookieClearHeaders } from '@/infra/auth/web-auth'

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ success: true })
  appendAuthCookieClearHeaders(res.headers)
  return res
}
