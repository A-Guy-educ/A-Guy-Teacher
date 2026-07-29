#!/usr/bin/env tsx
/**
 * Environment variable validation script.
 *
 * Run: pnpm validate:env
 *
 * Validates that all required environment variables are set before build or
 * deploy. Loads `.env` into `process.env` (so local development works) and
 * then delegates to the shared Zod schema in `src/infra/config/env-validation`.
 * That same schema is invoked at server startup via `instrumentation.ts`,
 * so this script is the CLI mirror of the same fail-fast gate.
 *
 * Exits 0 on success, 1 on missing required vars.
 */

import { config as loadDotenv } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

import { runEnvValidation } from '../src/infra/config/env-validation'

const PROJECT_ROOT = path.resolve(process.cwd())
const ENV_FILE = path.join(PROJECT_ROOT, '.env')

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`)
}

function loadEnvIntoProcess(): { loaded: boolean; path: string } {
  if (!fs.existsSync(ENV_FILE)) {
    return { loaded: false, path: ENV_FILE }
  }

  const result = loadDotenv({ path: ENV_FILE, override: false })
  if (result.error) {
    log(`❌ Failed to read .env file: ${result.error.message}`, colors.red)
    process.exit(1)
  }

  return { loaded: true, path: ENV_FILE }
}

function main(): void {
  log(`\n${colors.bright}${colors.cyan}🔍 Environment Variable Validation${colors.reset}\n`)

  const { loaded, path: envPath } = loadEnvIntoProcess()

  if (!loaded) {
    log(`ℹ️  No .env file found at ${envPath}; relying on process.env only.`, colors.yellow)
  } else {
    log(`✅ Loaded .env from ${envPath}`, colors.green)
  }

  const result = runEnvValidation(process.env)

  log('\n━━━ Required Variables ━━━\n', colors.cyan + colors.bright)
  if (result.missingRequired.length === 0) {
    log('All required environment variables are set.', colors.green)
  } else {
    for (const name of result.missingRequired) {
      log(`❌ ${name}`, colors.red)
      log('   Missing or empty', colors.red)
    }
  }

  log('\n━━━ Optional Variables ━━━\n', colors.cyan + colors.bright)
  if (result.missingOptional.length === 0) {
    log('All optional environment variables are set.', colors.green)
  } else {
    for (const name of result.missingOptional) {
      log(`➖ ${name}`, colors.reset)
      log('   Not set (optional)', colors.reset)
    }
  }

  log('\n━━━ Public Variables ━━━\n', colors.cyan + colors.bright)
  if (result.missingPublic.length === 0) {
    log('All public environment variables are set.', colors.green)
  } else {
    for (const name of result.missingPublic) {
      log(`➖ ${name}`, colors.reset)
      log('   Not set (public, optional)', colors.reset)
    }
  }

  log('\n━━━ Summary ━━━\n', colors.cyan + colors.bright)
  if (result.valid) {
    log('✅ All required environment variables are configured correctly\n', colors.green)
    process.exit(0)
  } else {
    log(
      `❌ ${result.missingRequired.length} required variable${result.missingRequired.length > 1 ? 's' : ''} missing or invalid\n`,
      colors.red,
    )
    log('Run one of the following to fix:', colors.yellow)
    log('  1. pnpm setup            (automated setup)', colors.reset)
    log('  2. Copy .env.example to .env and replace placeholder values', colors.reset)
    log('  3. openssl rand -hex 32  (generate secrets)\n', colors.reset)
    process.exit(1)
  }
}

main()
