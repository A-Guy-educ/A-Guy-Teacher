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
 * the same way in unit tests as they do in production.
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

const retiredPayloadRuntimeTests = [
  'tests/unit/access/**',
  'tests/unit/admin/**',
  'tests/unit/blocks/**',
  'tests/unit/collections/**',
  'tests/unit/fields/**',
  'tests/unit/hooks/**',
  'tests/unit/payload/**',
  'tests/unit/queries/**',
  'tests/unit/server/endpoints/**',
  'tests/unit/server/payload/**',
  'tests/unit/server/repos/mcp/**',
  'tests/unit/ui/admin/**',
  'tests/unit/exercise-schema-idempotency.test.ts',
  'tests/unit/api/chat-asset-finalize.spec.ts',
  'tests/unit/api/extract-course-id.test.ts',
  'tests/unit/config/system-params-guard.spec.ts',
  'tests/unit/exercises-pager-back-url.test.ts',
  'tests/unit/interactive-lesson/eviction-reason.spec.ts',
  'tests/unit/lesson-navigation-back-url.test.ts',
  'tests/unit/lib/config/runtime/runtime-config.test.ts',
  'tests/unit/lib/config/system-params.test.ts',
  'tests/unit/lib/errors.spec.ts',
  'tests/unit/lib/repos/get-default-tenant.test.ts',
  'tests/unit/lib/services/check-paid-access.spec.ts',
  'tests/unit/mongodb-pool-config.test.ts',
  'tests/unit/payload-plugins-blob-enforcement.test.ts',
  'tests/unit/server/services/api-service.test.ts',
  'tests/unit/server/services/guest-session-types.test.ts',
  'tests/unit/server/services/guest-session-upgrade.test.ts',
  'tests/unit/server/services/guest-session.test.ts',
  'tests/unit/server/services/lesson-context-conversion/context-extractions.test.ts',
  'tests/unit/services/v3-diagram-richtext.test.ts',
  'tests/unit/services/v3-transform.test.ts',
]

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.vitest.json'] }), react(), rawMarkdownPlugin()],
  ssr: {
    noExternal: ['zod'],
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.spec.tsx',
      'tests/unit/**/*.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.int.spec.ts',
      '**/*.e2e.spec.ts',
      ...retiredPayloadRuntimeTests,
    ],
    // Suppress console output during tests for cleaner output
    onConsoleLog(_log, type) {
      if (type === 'stdout') {
        return false
      }
    },
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
       * Thresholds are set just below the current unit-test coverage baseline
       * so the gate catches regressions without blocking every PR.
       *
       * Current baseline (measured locally): ~23.8% statements, ~20.2% branches,
       * ~27.2% functions. The previous aspirational targets (50/45) were above
       * reality. Raise these numbers incrementally as real coverage grows.
       *
       * CI runs `pnpm test:unit:coverage` (the dedicated script that passes
       * `--coverage` directly to vitest), so these thresholds gate CI too.
       */
      thresholds: {
        statements: 22,
        branches: 18,
        functions: 25,
        autoUpdate: false,
      },
    },
  },
})
