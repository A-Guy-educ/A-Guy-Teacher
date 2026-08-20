import 'server-only'

import { createAguyApiClient, createLoginUrl } from '@a-guy/api-client'
import { z } from 'zod'

import { resolveRuntimeOrigin } from '../config/runtime-origins'
import { courseManagementResponseSchema, type CourseManagementResponse } from '../types/courses'

const DEFAULT_WEB_ORIGIN = 'https://www.aguy.co.il'
const DEFAULT_API_ORIGIN = 'https://api.aguy.co.il'
const DEFAULT_TEACHER_ORIGIN = 'https://teacher.aguy.co.il'
const LOCAL_WEB_AND_API_ORIGIN = 'http://app.lvh.me:3000'
const LOCAL_TEACHER_ORIGIN = 'http://teacher.lvh.me:3001'

export function getWebOrigin(): URL {
  return resolveRuntimeOrigin({
    development: LOCAL_WEB_AND_API_ORIGIN,
    name: 'AGUY_WEB_URL',
    production: DEFAULT_WEB_ORIGIN,
  })
}

export function getApiOrigin(): URL {
  return resolveRuntimeOrigin({
    development: LOCAL_WEB_AND_API_ORIGIN,
    name: 'AGUY_API_URL',
    production: DEFAULT_API_ORIGIN,
  })
}

export function getTeacherOrigin(): URL {
  return resolveRuntimeOrigin({
    development: LOCAL_TEACHER_ORIGIN,
    name: 'TEACHER_PUBLIC_URL',
    production: DEFAULT_TEACHER_ORIGIN,
  })
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
