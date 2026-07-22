import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { getContentDb } from '@/infra/db/content-db'

function idCandidates(id: string) {
  return ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id]
}

export async function POST(request: NextRequest) {
  // public endpoint: compatibility probe; this handler performs no import or mutation
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })

  const db = await getContentDb()
  const lesson = await db.collection('lessons').findOne({
    _id: ObjectId.isValid(lessonId) ? new ObjectId(lessonId) : lessonId,
  } as never)
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  const existingCount = await db
    .collection('exercises')
    .countDocuments({ lesson: { $in: idCandidates(lessonId) } })

  return NextResponse.json({
    success: true,
    imported: 0,
    existingCount,
    message: 'Exercise conversion is not available in the web-only build.',
  })
}
