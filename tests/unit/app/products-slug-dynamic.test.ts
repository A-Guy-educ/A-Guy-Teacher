import { describe, expect, it, vi } from 'vitest'

// The page imports several modules that pull in server-only / Next.js APIs
// at module-init time. Stub them so importing the route module from a unit
// test doesn't try to talk to Mongo or read cookies/headers.
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: () => undefined })),
  headers: vi.fn(() => ({ get: () => null })),
}))
vi.mock('@/server/repos/queries/products', () => ({
  queryProductBySlug: vi.fn(),
  queryAllProductSlugs: vi.fn(),
}))
vi.mock('@/i18n/server-locale', () => ({
  getSystemLocale: vi.fn(async () => 'en'),
}))
vi.mock('@/infra/seo/pageMetadata', () => ({
  pageMetadata: vi.fn((value) => value),
}))
vi.mock('./ProductDetailContent', () => ({ ProductDetailContent: () => null }))

/**
 * Regression guard: /products/[slug] must render dynamically.
 *
 * If `generateStaticParams` returns slugs and the page is allowed to
 * pre-render at build time, Next.js hits `headers()`/`cookies()` inside
 * `getSystemLocale()` and throws `DYNAMIC_SERVER_USAGE`. The build then
 * bakes a static /500 HTML for every product path and Vercel serves that
 * frozen 500 forever — the function never runs at request time.
 *
 * The two exports below are the lock-in: `dynamic = 'force-dynamic'` keeps
 * Next.js from pre-rendering, and removing `generateStaticParams` keeps it
 * from trying.
 */
describe('/products/[slug] route segment config', () => {
  it('forces dynamic rendering', async () => {
    const mod = await import('@/app/(frontend)/products/[slug]/page')
    expect(mod.dynamic).toBe('force-dynamic')
  })

  it('does not export generateStaticParams', async () => {
    const mod = await import('@/app/(frontend)/products/[slug]/page')
    expect((mod as Record<string, unknown>).generateStaticParams).toBeUndefined()
  })
})
