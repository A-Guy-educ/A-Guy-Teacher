import { z } from 'zod'

export const managedCourseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  courseLabel: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
  accessType: z.string().nullable().optional(),
  locale: z.enum(['en', 'he']).nullable().optional(),
  order: z.number().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})

export const courseManagementResponseSchema = z.object({
  docs: z.array(managedCourseSchema),
})

export type ManagedCourse = z.infer<typeof managedCourseSchema>
export type CourseManagementResponse = z.infer<typeof courseManagementResponseSchema>
