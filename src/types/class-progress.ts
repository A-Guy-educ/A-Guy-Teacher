import { z } from 'zod'

// Mirrors A-Guy-Web's GET /api/teacher/classes and GET /api/teacher/classes/:id/progress.
// Web owns the data and the authorization; Teacher only computes scores for display.

export const teacherClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  studentCount: z.number().int().nonnegative(),
})

export const teacherClassesResponseSchema = z.object({
  classes: z.array(teacherClassSchema),
})

export const questionProgressSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['unseen', 'solved', 'unsolved']),
  mistakes: z.number().int().nonnegative(),
  hints: z.number().int().nonnegative(),
  explanations: z.number().int().nonnegative(),
})

export const lessonProgressSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']),
  minutes: z.number().nonnegative(),
  questions: z.array(questionProgressSchema),
})

export const classProgressResponseSchema = z.object({
  class: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  lessons: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string(),
      questionCount: z.number().int().nonnegative(),
    }),
  ),
  students: z.array(
    z.object({
      id: z.string().min(1),
      // Web sends '' for users without a name.
      name: z.string(),
      // Lessons the student never opened may be omitted.
      lessons: z.record(z.string(), lessonProgressSchema),
    }),
  ),
})

export type TeacherClass = z.infer<typeof teacherClassSchema>
export type TeacherClassesResponse = z.infer<typeof teacherClassesResponseSchema>
export type QuestionProgress = z.infer<typeof questionProgressSchema>
export type LessonProgress = z.infer<typeof lessonProgressSchema>
export type ClassProgressResponse = z.infer<typeof classProgressResponseSchema>
export type ClassLesson = ClassProgressResponse['lessons'][number]
export type ClassStudent = ClassProgressResponse['students'][number]
