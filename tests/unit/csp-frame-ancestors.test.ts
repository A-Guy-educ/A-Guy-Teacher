import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { contentSecurityPolicy } from '@/infra/security/content-security-policy.js'

describe('CSP frame ancestors', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(__dirname, '../..')
  const nextConfigPath = path.join(projectRoot, 'next.config.js')

  function getNextConfigContent(): string {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')
    return configContent
  }

  it('does not restrict which preview hosts can embed pages', () => {
    expect(contentSecurityPolicy).not.toContain('frame-ancestors')
    expect(contentSecurityPolicy).not.toContain('kody-dashboard-aguy.vercel.app')
    expect(contentSecurityPolicy).not.toContain('kody-dashboard-sable.vercel.app')
  })

  it('keeps CSP out of next.config.js so middleware is the single source', () => {
    const configContent = getNextConfigContent()

    expect(configContent).not.toContain('Content-Security-Policy')
    expect(configContent).not.toContain('contentSecurityPolicy')
  })
})
