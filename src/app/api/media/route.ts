import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { VercelBlobAdapter } from '@/infra/blob/vercel-blob-adapter'
import { getContentDb, serializeDoc } from '@/infra/db/content-db'
import { inferMediaType } from '@/infra/media/inferMediaType'
import { requireUser } from '@/server/auth/api-auth'

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'upload'
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const ownerId = auth.value.id
  const db = await getContentDb()
  const filename = `${Date.now()}-${safeName(file.name)}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const blob = await new VercelBlobAdapter({
    directory: 'media',
    cacheControlSeconds: 60 * 60 * 24,
  }).uploadBuffer(filename, buffer, file.type || 'application/octet-stream')

  const now = new Date()
  const result = await db.collection('media').insertOne({
    filename,
    type: inferMediaType(file.type, filename),
    mimeType: file.type || 'application/octet-stream',
    filesize: file.size,
    url: blob.url,
    pathname: blob.pathname,
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  })
  const doc = serializeDoc(await db.collection('media').findOne({ _id: result.insertedId }))
  return NextResponse.json({ doc, ...doc })
}

export async function GET(request: NextRequest) {
  // public endpoint: reads published media metadata; uploads require a session above
  const id = request.nextUrl.searchParams.get('id')
  const db = await getContentDb()
  if (id && ObjectId.isValid(id)) {
    const doc = await db.collection('media').findOne({ _id: new ObjectId(id) })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ doc: serializeDoc(doc) })
  }
  const docs = await db.collection('media').find({}).sort({ createdAt: -1 }).limit(50).toArray()
  return NextResponse.json({ docs: docs.map((doc) => serializeDoc(doc)), totalDocs: docs.length })
}
