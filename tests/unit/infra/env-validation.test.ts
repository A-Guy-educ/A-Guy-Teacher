/**
 * Unit Tests for env validation.
 *
 * Exercises the shared Zod-based schema used by `instrumentation.ts`
 * (server startup) and `scripts/validate-env.ts` (CLI). The contract is the
 * same in both: a missing required var must fail-fast at the boundary,
 * not on the first user request.
 */

import { runEnvValidation, validateEnv } from '@/infra/config/env-validation'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const REQUIRED_BASE: NodeJS.ProcessEnv = {
  DATABASE_URL: 'mongodb://127.0.0.1/test',
  PAYLOAD_SECRET: 'a-secret-of-sufficient-length',
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_xxxx',
  CRON_SECRET: 'cron-secret',
  PREVIEW_SECRET: 'preview-secret',
}

describe('runEnvValidation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('happy path', () => {
    it('returns valid:true when all required vars are set', () => {
      const result = runEnvValidation({ ...REQUIRED_BASE })
      expect(result.valid).toBe(true)
      expect(result.missingRequired).toEqual([])
    })

    it('treats optional missing vars as a warning, not a failure', () => {
      const result = runEnvValidation({ ...REQUIRED_BASE })
      expect(result.valid).toBe(true)
      expect(result.missingOptional).toContain('GEMINI_API_KEY')
      expect(result.missingOptional).toContain('OPENAI_API_KEY')
    })

    it('treats public missing vars as a warning, not a failure', () => {
      const result = runEnvValidation({ ...REQUIRED_BASE })
      expect(result.valid).toBe(true)
      expect(result.missingPublic).toContain('NEXT_PUBLIC_SENTRY_DSN')
    })

    it('drops an optional var from missingOptional once it is set', () => {
      const result = runEnvValidation({ ...REQUIRED_BASE, GEMINI_API_KEY: 'gem-key' })
      expect(result.missingOptional).not.toContain('GEMINI_API_KEY')
    })
  })

  describe('failure paths', () => {
    it('reports a missing required var by name', () => {
      const env = { ...REQUIRED_BASE }
      delete env.DATABASE_URL

      const result = runEnvValidation(env)
      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain('DATABASE_URL')
    })

    it('reports an empty required var as missing', () => {
      const env = { ...REQUIRED_BASE, PAYLOAD_SECRET: '' }
      const result = runEnvValidation(env)
      expect(result.valid).toBe(false)
      expect(result.missingRequired).toContain('PAYLOAD_SECRET')
    })

    it('reports every missing required var, not just the first', () => {
      const env = { ...REQUIRED_BASE }
      delete env.DATABASE_URL
      delete env.CRON_SECRET
      delete env.PREVIEW_SECRET

      const result = runEnvValidation(env)
      expect(result.valid).toBe(false)
      expect(result.missingRequired).toEqual(
        expect.arrayContaining(['DATABASE_URL', 'CRON_SECRET', 'PREVIEW_SECRET']),
      )
    })

    it('returns valid:false with no required keys at all', () => {
      const result = runEnvValidation({})
      expect(result.valid).toBe(false)
      expect(result.missingRequired.length).toBeGreaterThan(0)
    })

    it('deduplicates a required var that fails multiple checks', () => {
      const env = { ...REQUIRED_BASE, DATABASE_URL: '' }
      const result = runEnvValidation(env)
      const occurrences = result.missingRequired.filter((n) => n === 'DATABASE_URL').length
      expect(occurrences).toBe(1)
    })
  })

  describe('default source', () => {
    it('reads from process.env when no env argument is passed', () => {
      process.env = { ...REQUIRED_BASE }
      const result = runEnvValidation()
      expect(result.valid).toBe(true)
    })
  })
})

describe('validateEnv (throwing variant)', () => {
  const originalEnv = process.env
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    process.env = { ...originalEnv }
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    warnSpy.mockRestore()
  })

  it('returns silently when all required vars are set', () => {
    process.env = { ...REQUIRED_BASE }
    expect(() => validateEnv()).not.toThrow()
  })

  it('throws with the missing var names when a required var is absent', () => {
    process.env = { ...REQUIRED_BASE }
    delete process.env.NEXT_PUBLIC_SERVER_URL

    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SERVER_URL/)
  })

  it('does not throw when only optional/public vars are missing', () => {
    process.env = { ...REQUIRED_BASE }
    expect(() => validateEnv()).not.toThrow()
  })
})
