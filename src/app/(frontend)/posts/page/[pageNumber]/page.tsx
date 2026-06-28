import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/ui/web/CollectionArchive'
import { PageRange } from '@/ui/web/PageRange'
import { Pagination } from '@/ui/web/Pagination'
import React from 'react'
import PageClient from './page.client'
import { notFound } from 'next/navigation'
import { queryPublishedPosts } from '@/server/repos/queries/posts'

export const revalidate = 600

type Args = {
  params: Promise<{
    pageNumber: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber } = await paramsPromise

  const sanitizedPageNumber = Number(pageNumber)

  if (!Number.isInteger(sanitizedPageNumber) || sanitizedPageNumber < 1) return notFound()

  const posts = await queryPublishedPosts({ limit: 12, page: sanitizedPageNumber })

  return (
    <div className="pt-24 pb-24">
      <PageClient />
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none">
          <h1>Posts</h1>
        </div>
      </div>

      <div className="container mb-8">
        <PageRange
          collection="posts"
          currentPage={posts.page}
          limit={12}
          totalDocs={posts.totalDocs}
        />
      </div>

      <CollectionArchive posts={posts.docs} />

      <div className="container">
        {posts?.page && posts?.totalPages > 1 && (
          <Pagination page={posts.page} totalPages={posts.totalPages} />
        )}
      </div>
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: `A-Guy Posts Page ${pageNumber || ''}`,
  }
}

export async function generateStaticParams() {
  return []
}
