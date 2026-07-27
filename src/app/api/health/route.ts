import { NextResponse } from 'next/server'
import packageJson from '../../../../package.json'

export const dynamic = 'force-dynamic'

export async function GET() {
  // public endpoint: service health probe
  return NextResponse.json(
    {
      ok: true,
      checks: {},
      version: packageJson.version,
      gitSha: process.env.GIT_SHA || 'unknown',
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Health-Check': 'ok' } },
  )
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
