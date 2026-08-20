import 'server-only'

import { createAguyApiClient, createLoginUrl } from '@a-guy/api-client'
import { z } from 'zod'

import { courseManagementResponseSchema, type CourseManagementResponse } from '../types/courses'

const DEFAULT_WEB_ORIGIN = 'https://www.aguy.co.il'
const DEFAULT_API_ORIGIN = 'https://api.aguy.co.il'
const DEFAULT_TEACHER_ORIGIN = 'https://teacher.aguy.co.il'

function configuredOrigin(value: string | undefined, fallback: string): URL {
  const url = new URL(value || fallback)
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(`Production origin must use HTTPS: ${url.origin}`)
  }
  return url
}

export function getWebOrigin(): URL {
  return configuredOrigin(process.env.AGUY_WEB_URL, DEFAULT_WEB_ORIGIN)
}

export function getApiOrigin(): URL {
  return configuredOrigin(process.env.AGUY_API_URL, DEFAULT_API_ORIGIN)
}

export function getTeacherOrigin(): URL {
  return configuredOrigin(process.env.TEACHER_PUBLIC_URL, DEFAULT_TEACHER_ORIGIN)
}

export function getTeacherLoginUrl(): string {
  return createLoginUrl(`${getTeacherOrigin().origin}/`, getWebOrigin().origin)
}

export function isTeacherOrigin(origin: string | null): boolean {
  if (!origin || !z.string().url().safeParse(origin).success) return false
  return new URL(origin).origin === getTeacherOrigin().origin
}

function client(cookieHeader: string | null, fetcher?: typeof fetch) {
  return createAguyApiClient({
    baseUrl: getApiOrigin().origin,
    cookie: cookieHeader,
    fetch: fetcher,
  })
}

export function requestManagedCourses(
  cookieHeader: string | null,
  options: { fetcher?: typeof fetch; requestId?: string } = {},
): Promise<Response> {
  return client(cookieHeader, options.fetcher).requestRaw('/api/teacher/courses', {
    headers: options.requestId ? { 'x-request-id': options.requestId } : undefined,
  })
}

export async function parseManagedCourses(response: Response): Promise<CourseManagementResponse> {
  return courseManagementResponseSchema.parse(await response.json())
}

export function requestLogout(
  cookieHeader: string | null,
  options: { fetcher?: typeof fetch; requestId?: string } = {},
): Promise<Response> {
  return client(cookieHeader, options.fetcher).requestRaw('/api/auth/logout', {
    method: 'POST',
    headers: options.requestId ? { 'x-request-id': options.requestId } : undefined,
  })
}
