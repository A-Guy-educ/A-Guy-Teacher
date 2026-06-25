import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dockerfile = readFileSync(resolve(process.cwd(), 'Dockerfile.preview'), 'utf8')
const dockerignore = readFileSync(resolve(process.cwd(), '.dockerignore'), 'utf8')

describe('Dockerfile.preview', () => {
  it('serves Fly previews through the Kody doorman gate', () => {
    expect(existsSync(resolve(process.cwd(), 'doorman/doorman.ts'))).toBe(true)
    expect(dockerfile).toContain('COPY . ./')
    expect(dockerfile).toContain('ENV PORT=8080')
    expect(dockerfile).toContain('ENV NEXT_INTERNAL_PORT=3000')
    expect(dockerfile).toContain('ENV NODE_ENV=production')
    expect(dockerfile).toContain('exec node --experimental-strip-types doorman/doorman.ts')
  })

  it('does not expose Next directly on the public preview port', () => {
    expect(dockerfile).toContain('next start')
    expect(dockerfile).toContain('-p ${NEXT_INTERNAL_PORT:-3000}')
    expect(dockerfile).not.toContain('next start -H 0.0.0.0 -p 8080')
  })

  it('does not let runtime-only secrets affect the production build', () => {
    expect(dockerfile).toContain('DATABASE_URL=')
    expect(dockerfile).toContain('OPENAI_API_KEY=')
    expect(dockerfile).toContain('VERCEL_TOKEN=')
    expect(dockerfile).toContain('pnpm build')
  })

  it('keeps preview Docker contexts small without dropping generated build env', () => {
    expect(dockerignore).toContain('.next')
    expect(dockerignore).toContain('node_modules')
    expect(dockerignore).toContain('.kody/sandboxes')
    expect(dockerignore).toContain('.tasks')
    expect(dockerignore).toContain('.opencode')
    expect(dockerignore).toContain('.pnpm-store')
    expect(dockerignore).toContain('!.env.production.local')
  })
})
