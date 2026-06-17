/**
 * @fileType utility
 * @domain types
 * @pattern backend-types
 * @ai-summary Fallback type shims for Payload-generated types not yet available at build time. These are intentionally `any` — using them correctly requires knowing the runtime shape. Adding a new entry here is a signal that a Payload schema change needs a corresponding generated-type update.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Payload = any
export type PayloadRequest = any
export type User = any
export type Where = any
export type MongooseAdapter = any

export type DuplicationLevel = 'none' | 'light' | 'medium' | 'deep' | string
export type DuplicationSubject = 'algebra' | 'geometry' | 'calculus' | 'mixed' | 'other'

export const ContentSchema = {
  parse: (value: unknown): any => value,
  safeParse: (value: unknown): any => ({ success: true, data: value }),
}

export function parseSSEData(data: string): any[] {
  return data
    .split(/\n\n+/)
    .map((eventBlock) => eventBlock.trim())
    .filter(Boolean)
    .flatMap((eventBlock) => {
      const lines = eventBlock.split('\n')
      const event = lines
        .find((line) => line.startsWith('event:'))
        ?.slice('event:'.length)
        .trim()
      const dataLines = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
      if (!event || dataLines.length === 0) return []
      try {
        return [{ event, data: JSON.parse(dataLines.join('\n')) }]
      } catch {
        return [{ event, data: dataLines.join('\n') }]
      }
    })
}

export async function logActivity(..._args: any[]) {
  return null
}

export async function convertLatexBlockOnExercise(..._args: any[]): Promise<any> {
  return null
}

export async function getPayload(..._args: any[]): Promise<any> {
  return {
    auth: async (..._authArgs: any[]) => ({ user: null }),
    login: async (..._loginArgs: any[]) => null,
    db: { collections: { users: { findOne: async () => null, updateOne: async () => null } } },
    collections: {},
  }
}
