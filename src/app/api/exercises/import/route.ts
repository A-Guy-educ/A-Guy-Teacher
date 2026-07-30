import { NextRequest, NextResponse } from 'next/server'

import { countExercisesForLesson, lessonExists } from '@/server/services/exercises-import'

export async function POST(request: NextRequest) {
  // public endpoint: compatibility probe; this handler performs no import or mutation
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })

  if (!(await lessonExists(lessonId))) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    imported: 0,
    existingCount: await countExercisesForLesson(lessonId),
    message: 'Exercise conversion is not available in the web-only build.',
  })
}
