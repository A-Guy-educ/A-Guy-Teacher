import { NextRequest, NextResponse } from 'next/server'

import { getUserChatQuotaStatus, requireUser } from '@/server/auth/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const status = await getUserChatQuotaStatus(auth.value.id)
  return NextResponse.json(status)
}
