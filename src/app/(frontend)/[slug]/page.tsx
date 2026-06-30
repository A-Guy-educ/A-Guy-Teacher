import type { Metadata } from 'next'

import { Redirects } from '@/ui/web/Redirects'

import { generateMeta } from '@/infra/utils/generateMeta'
import { queryAllPageSlugs, queryPageBySlug } from '@/server/repos/queries/pages'
import { RenderHero } from '@/ui/web/heros/RenderHero'
import { RenderLayout } from '@/ui/web/layout-blocks/RenderLayout'
import PageClient from './page.client'

export async function generateStaticParams() {
  try {
    const pages = await queryAllPageSlugs()
    return pages
  } catch {
    // Gracefully handle MongoDB connection failures during build
    // Return empty array to allow build to continue
    return []
  }
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/' + decodedSlug

  let page
  try {
    page = await queryPageBySlug({
      slug: decodedSlug,
    })
  } catch (error) {
    // Gracefully handle MongoDB connection failures during build
    console.warn('Failed to fetch page:', error)
    return (
      <article className="pt-section-md pb-section-lg">
        <PageClient />
        <Redirects disableNotFound url={url} />
        <div className="container">
          <p>Page content is temporarily unavailable.</p>
        </div>
      </article>
    )
  }

  if (!page) {
    return <Redirects url={url} />
  }

  const { hero, layout } = page

  return (
    <article className="pt-section-md pb-section-lg">
      <PageClient />
      <Redirects disableNotFound url={url} />
      {hero ? <RenderHero {...hero} /> : null}
      {layout && layout.length > 0 ? <RenderLayout blocks={layout} /> : null}
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const page = await queryPageBySlug({
    slug: decodedSlug,
  })

  return generateMeta({ doc: page })
}
