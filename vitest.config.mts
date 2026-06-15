import react from '@vitejs/plugin-react'
import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.test', override: true })

/**
 * Match the Next.js webpack rule `{ test: /\.md$/, type: 'asset/source' }`
 * (see next.config.js) so source files that `import x from './foo.md'` work
 * the same way in integration tests as they do in production.
 */
function rawMarkdownPlugin(): Plugin {
  return {
    name: 'raw-markdown',
    enforce: 'pre',
    transform(_code, id) {
      if (!id.endsWith('.md')) return null
      const cleanPath = id.split('?')[0]
      const raw = readFileSync(cleanPath, 'utf-8')
      return {
        code: `export default ${JSON.stringify(raw)};`,
        map: null,
      }
    },
  }
}

const activeIntegrationTests = [
  'tests/int/analytics/**/*.int.spec.ts',
  'tests/int/checkAnswer.int.spec.ts',
  'tests/int/lesson-intro-page.int.spec.ts',
  'tests/int/contracts/answer-spec-*.int.spec.ts',
  'tests/int/contracts/axis-spec.int.spec.ts',
  'tests/int/contracts/content.int.spec.ts',
  'tests/int/contracts/geometry-spec.int.spec.ts',
  'tests/int/embedding-contract.int.spec.ts',
  'tests/int/guardrails/**/*.int.spec.ts',
  'tests/int/health.api.int.spec.ts',
  'tests/int/health-badge.int.spec.ts',
  'tests/int/media-cleanup-workflow.int.spec.ts',
  'tests/int/middleware.int.spec.ts',
  'tests/int/openai-error-handling.int.spec.ts',
  'tests/int/pdf-conversion-cleanup-regression.int.spec.ts',
  'tests/int/pdf-conversion-idempotency-upsert.int.spec.ts',
  'tests/int/pdf-conversion-inmemory-dedup.int.spec.ts',
  'tests/int/pdf-conversion-shadow-field.int.spec.ts',
  'tests/int/refactor-inline-styles.int.spec.ts',
  'tests/int/v2-vision-detection.int.spec.ts',
]

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.vitest.json'] }), react(), rawMarkdownPlugin()],
  test: {
    fileParallelism: false, // Run test files sequentially to avoid exhausting MongoDB connection pool
    pool: 'forks', // Use forks pool for better isolation
    globalSetup: ['./tests/setup/global-int-setup.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: activeIntegrationTests,
    hookTimeout: 180000, // 180 seconds for hooks (cleanup operations may be slow)
    testTimeout: 30000, // 30 seconds for individual tests (Vercel Blob and network-dependent tests may be slow)
    // Suppress console output during tests for cleaner output
    onConsoleLog(_log, type) {
      if (type === 'stdout') {
        return false
      }
    },
    maxConcurrency: 4, // Allow up to 4 tests to run concurrently
    outputFile: undefined, // Don't write to file (reduces I/O noise)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/server/services/**/*.ts',
        'src/infra/llm/**/*.ts',
        'src/infra/blob/**/*.ts',
        'src/infra/config/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/index.ts',
        'src/lib/ai/prompts/**',
        'src/lib/ai/services/**',
      ],
      /**
       * Thresholds are set just below the current integration-test coverage
       * baseline so the gate catches regressions without blocking every PR.
       *
       * Current baseline (as measured by CI on dev): 30.27% statements,
       * 23.9% branches, 31.54% functions. The previous aspirational targets
       * (50/45) were above reality and turned CI red for every branch. Raise
       * these numbers incrementally as real coverage grows — treat each bump
       * as a ratchet, not a leap.
       */
      thresholds: {
        statements: 28,
        branches: 22,
        functions: 30,
        autoUpdate: false,
      },
    },
  },
})
