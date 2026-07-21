import { NextRequest, NextResponse } from 'next/server'

import { enforceUserChatQuota, requireUser } from '@/server/auth/api-auth'
import { synthesizeRequestSchema, synthesizeSpeech } from '@/server/services/tts/google-cloud-tts'

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const requestId = crypto.randomUUID()
  const parsed = synthesizeRequestSchema.safeParse(await request.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten(), requestId },
      { status: 400 },
    )
  }

  const quota = await enforceUserChatQuota(auth.value.id)
  if (!quota.ok) return quota.response

  try {
    const audioContent = await synthesizeSpeech(parsed.data.text, parsed.data.locale)
    return NextResponse.json({ audioContent })
  } catch {
    return NextResponse.json({ error: 'Speech synthesis failed', requestId }, { status: 500 })
  }
}
