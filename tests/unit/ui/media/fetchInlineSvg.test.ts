import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/ui/web/exerciserenderer/utils/svgSanitize', () => ({
  sanitizeSvg: (input: string) => input,
}))

import { __resetInlineSvgCache, fetchInlineSvg } from '@/ui/web/media/SVGMedia/fetchInlineSvg'

const RAW_SVG = '<svg width="200" height="100"><rect/></svg>'

beforeEach(() => {
  __resetInlineSvgCache()
})

describe('fetchInlineSvg', () => {
  it('caches successful responses so identical URLs are fetched at most once', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, text: async () => RAW_SVG }))
    vi.stubGlobal('fetch', fetchSpy)

    await fetchInlineSvg('/media/a.svg')
    await fetchInlineSvg('/media/a.svg')
    await fetchInlineSvg('/media/a.svg')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent in-flight requests for the same URL', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, text: async () => RAW_SVG }))
    vi.stubGlobal('fetch', fetchSpy)

    await Promise.all([
      fetchInlineSvg('/media/a.svg'),
      fetchInlineSvg('/media/a.svg'),
      fetchInlineSvg('/media/a.svg'),
    ])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('does not cache failures — subsequent callers get a fresh attempt', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => RAW_SVG })
    vi.stubGlobal('fetch', fetchSpy)

    await expect(fetchInlineSvg('/media/a.svg')).rejects.toThrow(/500/)
    const result = await fetchInlineSvg('/media/a.svg')

    expect(result).toContain('viewBox="0 0 200 100"')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('injects the viewBox as part of the normalisation pipeline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => RAW_SVG })),
    )

    const result = await fetchInlineSvg('/media/a.svg')

    expect(result).toContain('viewBox="0 0 200 100"')
  })
})
