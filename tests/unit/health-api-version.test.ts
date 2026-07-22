import { describe, expect, it } from 'vitest'

import { GET } from '@/app/api/health/route'
import packageJson from '../../package.json'

describe('GET /api/health version', () => {
  it('uses package.json instead of an npm runtime environment variable', async () => {
    const response = await GET()
    const data = (await response.json()) as { version: string }

    expect(data.version).toBe(packageJson.version)
    expect(data.version).not.toBe('unknown')
  })
})
