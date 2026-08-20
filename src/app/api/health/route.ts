import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json(
    { service: 'A-Guy Teacher', mode: 'web-pass-through', status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
