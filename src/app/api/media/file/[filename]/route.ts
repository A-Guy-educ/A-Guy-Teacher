import fs from 'fs/promises'

import { NextRequest, NextResponse } from 'next/server'

import { VercelBlobAdapter } from '@/infra/blob/vercel-blob-adapter'
import { resolveMediaFilePath } from '@/infra/config/storage'
import { getContentDb } from '@/infra/db/content-db'

type MediaFileRecord = {
  filename?: unknown
  mimeType?: unknown
  pathname?: unknown
  url?: unknown
}

function decodeFilename(filename: string): string {
  try {
    return decodeURIComponent(filename)
  } catch {
    return filename
  }
}

function hasPathSeparators(filename: string): boolean {
  return filename.includes('/') || filename.includes('\\')
}

function withoutGeneratedSuffix(filename: string): string {
  return filename.replace(/-[a-zA-Z0-9]{20,}(\.[^.]+)$/, '$1')
}

function resolveRedirectUrl(url: unknown, request: NextRequest): string | null {
  if (typeof url !== 'string' || !url.trim()) return null

  try {
    const target = new URL(url, request.url)
    const isHttp = target.protocol === 'http:' || target.protocol === 'https:'
    if (!isHttp) return null

    const targetPath = decodeFilename(target.pathname)
    const requestPath = decodeFilename(request.nextUrl.pathname)
    const pointsToSameFile = target.origin === request.nextUrl.origin && targetPath === requestPath

    return pointsToSameFile ? null : target.toString()
  } catch {
    return null
  }
}

function getBlobLookupPrefixes(filename: string, media: MediaFileRecord | null): string[] {
  const originalFilename = withoutGeneratedSuffix(filename)
  const prefixes = [
    typeof media?.pathname === 'string' ? media.pathname.replace(/^\/+/, '') : null,
    `media/${filename}`,
    `media/pdfs/${filename}`,
    filename,
    `media/${originalFilename}`,
    `media/pdfs/${originalFilename}`,
    originalFilename,
  ]

  return prefixes.filter((prefix, index): prefix is string => {
    return Boolean(prefix) && prefixes.indexOf(prefix) === index
  })
}

async function findBlobUrl(
  filename: string,
  media: MediaFileRecord | null,
): Promise<string | null> {
  try {
    const blob = new VercelBlobAdapter({ directory: '' })
    const prefixes = getBlobLookupPrefixes(filename, media)
    const originalFilename = withoutGeneratedSuffix(filename)
    const knownPathnames = new Set([
      filename,
      originalFilename,
      `media/${filename}`,
      `media/${originalFilename}`,
      `media/pdfs/${filename}`,
      `media/pdfs/${originalFilename}`,
    ])

    for (const prefix of prefixes) {
      const result = await blob.list(prefix, 5)
      const match =
        result.blobs.find((item) => item.pathname === prefix) ||
        result.blobs.find((item) => knownPathnames.has(item.pathname)) ||
        result.blobs.find((item) => item.pathname.startsWith(prefix))

      if (match?.url) return match.url
    }
  } catch {
    return null
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename: rawFilename } = await params
  const filename = decodeFilename(rawFilename)

  if (!filename || hasPathSeparators(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const db = await getContentDb()
  const media = (await db.collection('media').findOne({ filename })) as MediaFileRecord | null

  const redirectUrl = resolveRedirectUrl(media?.url, request)
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl)
  }

  const blobUrl = await findBlobUrl(filename, media)
  if (blobUrl) {
    return NextResponse.redirect(blobUrl)
  }

  try {
    const file = await fs.readFile(resolveMediaFilePath(filename))
    return new NextResponse(file, {
      headers: {
        'Content-Type': String(media?.mimeType || 'application/octet-stream'),
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
