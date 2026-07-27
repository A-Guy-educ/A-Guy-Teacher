import { z } from 'zod'

/**
 * Environment variable validation schema.
 *
 * Required vars throw on missing at server startup and at the `pnpm validate:env`
 * CLI. Optional/public vars warn but don't throw — their absence is non-fatal.
 *
 * Keep this list aligned with what the server actually consumes at startup;
 * surfacing a missing var here is the difference between a fail-fast deploy
 * and a runtime crash on the first user request.
 */
const envSchema = z.object({
  // Required — fail-fast if missing
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PAYLOAD_SECRET: z.string().min(1, 'PAYLOAD_SECRET is required'),
  NEXT_PUBLIC_SERVER_URL: z.string().min(1, 'NEXT_PUBLIC_SERVER_URL is required'),
  BLOB_READ_WRITE_TOKEN: z.string().min(1, 'BLOB_READ_WRITE_TOKEN is required'),
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
  PREVIEW_SECRET: z.string().min(1, 'PREVIEW_SECRET is required'),

  // Optional — warn if missing, don't throw
  SENTRY_DSN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_BASE_URL: z.string().optional(),

  // Public — warn if missing
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_ADMIN_URL: z.string().optional(),
})

export type EnvValidationResult = {
  valid: boolean
  missingRequired: string[]
  missingOptional: string[]
  missingPublic: string[]
}

const OPTIONAL_VARS = [
  'SENTRY_DSN',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GITHUB_TOKEN',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_COMPATIBLE_BASE_URL',
] as const

const PUBLIC_VARS = ['NEXT_PUBLIC_SENTRY_DSN', 'NEXT_PUBLIC_ADMIN_URL'] as const

/**
 * Non-throwing variant. Returns a structured result describing what is missing.
 * Used by the `pnpm validate:env` CLI and by tests.
 */
export function runEnvValidation(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const result = envSchema.safeParse(env)

  if (!result.success) {
    const missingRequired = result.error.issues
      .map((issue) => issue.path.join('.') || issue.message)
      .filter((name): name is string => Boolean(name))

    return {
      valid: false,
      missingRequired: Array.from(new Set(missingRequired)),
      missingOptional: OPTIONAL_VARS.filter((v) => !env[v]),
      missingPublic: PUBLIC_VARS.filter((v) => !env[v]),
    }
  }

  return {
    valid: true,
    missingRequired: [],
    missingOptional: OPTIONAL_VARS.filter((v) => !env[v]),
    missingPublic: PUBLIC_VARS.filter((v) => !env[v]),
  }
}

/**
 * Validates required environment variables and warns about missing optional ones.
 * Throws if any required variables are missing.
 *
 * Wired into Next.js startup via `instrumentation.ts` so a missing var fails
 * the deploy rather than the first user request.
 */
export function validateEnv(): void {
  const result = runEnvValidation()

  for (const varName of result.missingOptional) {
    console.warn(`[Env] Optional variable ${varName} is not set. Some features may be limited.`)
  }

  for (const varName of result.missingPublic) {
    console.warn(`[Env] Public variable ${varName} is not set. Some features may be limited.`)
  }

  if (!result.valid) {
    throw new Error(
      `Missing required environment variables: ${result.missingRequired.join(', ')}. ` +
        `Set them in your .env file or environment.`,
    )
  }
}
