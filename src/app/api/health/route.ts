import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // public endpoint: service health probe
  return NextResponse.json(
    {
      ok: true,
      checks: {},
      version: process.env.npm_package_version || 'unknown',
      gitSha: process.env.GIT_SHA || 'unknown',
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Health-Check': 'ok' } },
  )
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
