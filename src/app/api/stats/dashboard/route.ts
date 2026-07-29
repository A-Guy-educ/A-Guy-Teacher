import { NextRequest, NextResponse } from 'next/server'

import { getWebUser } from '@/infra/web-api/mongo-payload'
import { findActiveConversations, findLessonTitles } from '@/server/services/dashboard-stats'
import {
  findUserProgress,
  getOrCreateUserStats,
  type ProgressRecord,
} from '@/server/web-api/progress'

function emptyDashboard() {
  return {
    summary: { timeSpent: 0, dailyStreak: 0 },
    categoryProgress: {
      learn: { count: 0, total: 0 },
      practice: { attempted: 0, completed: 0, successRate: 0 },
      exams: { averageScore: 0, practiced: 0 },
      ask: { questionsAsked: 0, conversations: 0 },
    },
    practicedLessons: [],
    practicedExams: [],
  }
}

export async function GET(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return NextResponse.json(emptyDashboard())

  const stats = await getOrCreateUserStats(user.id)
  const progress = await findUserProgress(user.id, 'default')
  const records = progress?.progressRecords ?? []
  const lessonRecords = records.filter((record) => record.recordType === 'lesson')
  const exerciseRecords = records.filter((record) => record.recordType === 'exercise')
  const completedExercises = exerciseRecords.filter((record) => record.status === 'completed')
  const successRate = completedExercises.length
    ? Math.round(
        completedExercises.reduce((sum, record) => sum + Number(record.score || 0), 0) /
          completedExercises.length,
      )
    : 0

  const conversations = await findActiveConversations(user.id)
  const questionsAsked = conversations.reduce((sum, conversation) => {
    const messages = Array.isArray(conversation.messages) ? conversation.messages : []
    return sum + messages.filter((message) => message?.role === 'user' && !message.hidden).length
  }, 0)

  const titleMap = await findLessonTitles(lessonRecords.map((record) => record.recordId))
  const practicedLessons = lessonRecords
    .filter((record) => (record.timeSpentSeconds || 0) > 0 || record.status === 'completed')
    .sort((a, b) => String(b.lastAccessedAt || '').localeCompare(String(a.lastAccessedAt || '')))
    .slice(0, 10)
    .map((record: ProgressRecord) => ({
      lessonId: record.recordId,
      title: titleMap.get(record.recordId) || 'Lesson',
      timeSpentSeconds: Number(record.timeSpentSeconds || 0),
      chatQuestions: 0,
    }))

  return NextResponse.json({
    summary: {
      timeSpent: Number(stats?.totalTimeSpentSeconds || 0),
      dailyStreak: Number(stats?.currentStreak || 0),
    },
    categoryProgress: {
      learn: {
        count: lessonRecords.filter((record) => record.status === 'completed').length,
        total: lessonRecords.length,
      },
      practice: {
        attempted: exerciseRecords.length,
        completed: completedExercises.length,
        successRate,
      },
      exams: { averageScore: 0, practiced: 0 },
      ask: { questionsAsked, conversations: conversations.length },
    },
    practicedLessons,
    practicedExams: [],
  })
}
