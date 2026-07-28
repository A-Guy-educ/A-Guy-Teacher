import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/**
 * The shared-login policy comes from server-only environment variables. A
 * client component that reads it gets `undefined` in the browser and silently
 * decides it trusts nobody — which is exactly how the post-login redirect to a
 * sibling app broke. Client components must receive resolved values as props.
 */
describe('shared-login policy stays on the server', () => {
  const clientFiles = sourceFiles(SRC)
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => /^\s*['"]use client['"]/.test(source))

  it('finds client components to check', () => {
    expect(clientFiles.length).toBeGreaterThan(0)
  })

  it('no client component imports the environment-bound policy', () => {
    const offenders = clientFiles
      .filter(({ source }) => source.includes('shared-login/policy.env'))
      .map(({ path }) => path.replace(`${SRC}/`, ''))

    expect(offenders).toEqual([])
  })

  it('no client component reads a shared-login environment variable directly', () => {
    const offenders = clientFiles
      .filter(({ source }) =>
        /process\.env\.(ROOT_DOMAIN|AUTH_ALLOWED_RETURN_ORIGINS|API_ALLOWED_ORIGINS)/.test(source),
      )
      .map(({ path }) => path.replace(`${SRC}/`, ''))

    expect(offenders).toEqual([])
  })
})
