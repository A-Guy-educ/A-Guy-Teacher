import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { VercelBlobAdapter } from '@/infra/blob/vercel-blob-adapter'
import { serializeDoc } from '@/infra/db/content-db'
import { inferMediaType } from '@/infra/media/inferMediaType'
import { requireUser } from '@/server/auth/api-auth'
import { createMedia, findMediaById, listRecentMedia } from '@/server/services/media'

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'upload'
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const filename = `${Date.now()}-${safeName(file.name)}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const blob = await new VercelBlobAdapter({
    directory: 'media',
    cacheControlSeconds: 60 * 60 * 24,
  }).uploadBuffer(filename, buffer, file.type || 'application/octet-stream')

  const stored = await createMedia({
    filename,
    type: inferMediaType(file.type, filename),
    mimeType: file.type || 'application/octet-stream',
    filesize: file.size,
    url: blob.url,
    pathname: blob.pathname,
    createdBy: auth.value.id,
  })

  const doc = serializeDoc(stored)
  return NextResponse.json({ doc, ...doc })
}

export async function GET(request: NextRequest) {
  // public endpoint: reads published media metadata; uploads require a session above
  const id = request.nextUrl.searchParams.get('id')

  if (id && ObjectId.isValid(id)) {
    const doc = await findMediaById(id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ doc: serializeDoc(doc) })
  }

  const docs = await listRecentMedia()
  return NextResponse.json({ docs: docs.map((doc) => serializeDoc(doc)), totalDocs: docs.length })
}
