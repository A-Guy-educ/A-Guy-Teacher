/**
 * @fileType test
 * @domain ci | pipeline
 * @pattern workflow-contract | test-contract
 * @ai-summary Regression spec for issue #931: ensures CI wires the unit-test coverage
 * flag so thresholds actually gate the job. Prior to the fix, `ci.yml` invoked
 * `pnpm test:unit -- --coverage`, which vitest parses as a file filter and
 * silently ignores.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CI_WORKFLOW_PATH = resolve(process.cwd(), '.github/workflows/ci.yml')
const PACKAGE_JSON_PATH = resolve(process.cwd(), 'package.json')

const ciWorkflow = readFileSync(CI_WORKFLOW_PATH, 'utf8')
const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
  scripts: Record<string, string>
}

function findUnitTestStep(workflow: string): string | undefined {
  const steps = workflow.split('\n')
  let inUnitStep = false
  let current: string[] = []

  for (const line of steps) {
    if (/Run unit tests/i.test(line)) {
      inUnitStep = true
      current = [line]
      continue
    }
    if (inUnitStep) {
      if (/^\s*-\s*name:/.test(line)) break
      current.push(line)
    }
  }

  return inUnitStep ? current.join('\n') : undefined
}

const unitTestStep = findUnitTestStep(ciWorkflow)

describe('ci.yml — unit-test coverage wiring (issue #931)', () => {
  it('has a "Run unit tests" step', () => {
    expect(unitTestStep).toBeDefined()
  })

  it('does not invoke the broken `pnpm test:unit -- --coverage` pattern', () => {
    expect(ciWorkflow).not.toMatch(/pnpm\s+test:unit\s+--\s+--coverage/)
    expect(ciWorkflow).not.toMatch(/pnpm\s+test:unit\s+--\s+--\s*coverage/)
  })

  it('invokes a script that includes the coverage flag', () => {
    expect(unitTestStep).toBeDefined()
    // The step must run a script whose command line actually turns coverage on,
    // e.g. `pnpm test:unit:coverage` or `pnpm test:unit --coverage`.
    const matches = unitTestStep!.match(/run:\s*(.+)/)
    expect(matches, 'unit-test step must define a `run:` command').not.toBeNull()
    const runCommand = matches![1].trim()
    expect(runCommand).toMatch(/pnpm\s+test:unit(?::\S+)?(?:\s+--coverage)?\s*$/)
    expect(runCommand).toMatch(/coverage/)
  })
})

describe('package.json — coverage scripts (issue #931)', () => {
  it('exposes a `test:unit:coverage` script', () => {
    expect(packageJson.scripts['test:unit:coverage']).toBeDefined()
  })

  it('`test:unit:coverage` passes --coverage directly to vitest', () => {
    const script = packageJson.scripts['test:unit:coverage'] ?? ''
    expect(script).toMatch(/vitest\b/)
    expect(script).toMatch(/--coverage/)
  })

  it('`test:unit` itself does not pass --coverage (the bug relied on this)', () => {
    const script = packageJson.scripts['test:unit'] ?? ''
    expect(script).toMatch(/vitest\b/)
    expect(script).not.toMatch(/--coverage/)
  })
})
