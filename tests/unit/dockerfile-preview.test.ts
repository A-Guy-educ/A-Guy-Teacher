import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dockerfile = readFileSync(resolve(process.cwd(), 'Dockerfile.preview'), 'utf8')

describe('Dockerfile.preview', () => {
  it('serves Fly previews through the Kody doorman gate', () => {
    expect(dockerfile).toContain('COPY doorman/ ./doorman/')
    expect(dockerfile).toContain('ENV PORT=8080')
    expect(dockerfile).toContain('ENV NEXT_INTERNAL_PORT=3000')
    expect(dockerfile).toContain('exec node --experimental-strip-types doorman/doorman.ts')
  })

  it('does not expose Next directly on the public preview port', () => {
    expect(dockerfile).toContain('-p ${NEXT_INTERNAL_PORT:-3000}')
    expect(dockerfile).not.toContain('next start -H 0.0.0.0 -p 8080')
  })
})
