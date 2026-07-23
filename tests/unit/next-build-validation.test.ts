import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const nextConfigPath = path.join(projectRoot, 'next.config.js')

function getNextConfigContent(): string {
  return fs.readFileSync(nextConfigPath, 'utf8')
}

describe('Next.js build validation', () => {
  it('fails the production build on TypeScript errors', () => {
    expect(getNextConfigContent()).not.toMatch(/ignoreBuildErrors\s*:\s*true/)
  })

  it('fails the production build on ESLint errors', () => {
    expect(getNextConfigContent()).not.toMatch(/ignoreDuringBuilds\s*:\s*true/)
  })
})
