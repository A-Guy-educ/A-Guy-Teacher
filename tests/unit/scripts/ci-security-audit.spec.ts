/**
 * @fileType test
 * @domain ci | pipeline
 * @pattern workflow-contract | test-contract
 * @ai-summary Regression spec for issue #932: ensures high-severity dependency audit failures fail CI.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CI_WORKFLOW_PATH = resolve(process.cwd(), '.github/workflows/ci.yml')
const ciWorkflow = readFileSync(CI_WORKFLOW_PATH, 'utf8')

function findStep(workflow: string, stepName: string): string | undefined {
  const lines = workflow.split('\n')
  let inStep = false
  const current: string[] = []

  for (const line of lines) {
    if (new RegExp(`^\\s*-\\s*name: ${stepName}$`, 'i').test(line)) {
      inStep = true
      current.push(line)
      continue
    }

    if (inStep) {
      if (/^\s*-\s*name:/.test(line)) break
      current.push(line)
    }
  }

  return inStep ? current.join('\n') : undefined
}

const securityAuditStep = findStep(ciWorkflow, 'Security audit')

describe('ci.yml — dependency security audit (issue #932)', () => {
  it('runs pnpm audit with a high-severity gate', () => {
    expect(securityAuditStep).toBeDefined()
    expect(securityAuditStep).toMatch(/run:\s*pnpm\s+audit\s+--audit-level=high\s*$/m)
  })

  it('does not swallow audit failures', () => {
    expect(securityAuditStep).toBeDefined()
    expect(securityAuditStep).not.toMatch(/\|\|\s*true/)
    expect(securityAuditStep).not.toMatch(/continue-on-error:\s*true/)
  })
})
