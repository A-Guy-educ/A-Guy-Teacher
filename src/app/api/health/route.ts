import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json(
    { service: 'A-Guy Teacher', mode: 'course-management', status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
