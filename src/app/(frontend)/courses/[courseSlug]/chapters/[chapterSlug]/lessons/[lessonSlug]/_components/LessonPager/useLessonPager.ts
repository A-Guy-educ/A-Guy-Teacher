'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { ResolvedLessonBlock } from '@/server/repos/queries/lesson-blocks'
import type { Exercise, ContentPage, Media as MediaType } from '@/infra/types/content'

type PageType = 'intro' | 'block' | 'pdf' | 'outro'

interface PageState {
  type: PageType
  pageNumber: number
  blockIndex?: number
  currentPdfFileIndex?: number
}

interface UseLessonPagerProps {
  blocks: ResolvedLessonBlock[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  validFiles?: MediaType[]
}

function getExerciseSlug(exercise: Exercise): string {
  return exercise.slug || exercise.id
}

function getContentPageSlug(page: ContentPage): string {
  return page.slug || page.id
}

export function useLessonPager({
  blocks,
  courseSlug,
  chapterSlug,
  lessonSlug,
  validFiles,
}: UseLessonPagerProps) {
  const pdfCount = validFiles?.length ?? 0
  // Pages: intro(0) → blocks(1..n) → pdf files(n+1 .. n+pdfCount) → outro
  const totalPages = 1 + blocks.length + pdfCount + 1

  const [pageState, setPageState] = useState<PageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
  const introUrl = basePath
  const pdfUrl = basePath
  const completeUrl = `${basePath}/complete`

  const getBlockUrl = useCallback(
    (index: number) => {
      const block = blocks[index]
      if (!block) return introUrl
      if (block.type === 'exercise') {
        return `${basePath}/exercises/${getExerciseSlug(block.data)}`
      }
      return `${basePath}/content/${getContentPageSlug(block.data)}`
    },
    [basePath, blocks, introUrl],
  )

  const pdfStartPage = blocks.length + 1
  const pdfEndPage = blocks.length + pdfCount // inclusive

  // Deep-link detection on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname
    const searchParams = new URLSearchParams(window.location.search)
    const fileParam = searchParams.get('file')

    if (pathname === completeUrl) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
    } else if (pdfCount > 0 && pathname === pdfUrl) {
      // If ?file=N is present, jump to that file (1-indexed)
      if (fileParam !== null) {
        const fileIndex = parseInt(fileParam, 10) - 1
        if (!isNaN(fileIndex) && fileIndex >= 0 && fileIndex < pdfCount) {
          setPageState({
            type: 'pdf',
            pageNumber: pdfStartPage + fileIndex,
            currentPdfFileIndex: fileIndex,
          })
          return
        }
      }
      // Default: first PDF file
      setPageState({ type: 'pdf', pageNumber: pdfStartPage, currentPdfFileIndex: 0 })
    } else if (pathname.startsWith(`${basePath}/exercises/`)) {
      const slug = pathname.split('/exercises/')[1]
      const index = blocks.findIndex(
        (b) => b.type === 'exercise' && getExerciseSlug(b.data) === slug,
      )
      if (index >= 0) {
        setPageState({ type: 'block', pageNumber: index + 1, blockIndex: index })
      }
    } else if (pathname.startsWith(`${basePath}/content/`)) {
      const slug = pathname.split('/content/')[1]
      const index = blocks.findIndex(
        (b) => b.type === 'contentPage' && getContentPageSlug(b.data) === slug,
      )
      if (index >= 0) {
        setPageState({ type: 'block', pageNumber: index + 1, blockIndex: index })
      }
    }
  }, [basePath, completeUrl, pdfUrl, blocks, pdfCount, totalPages, pdfStartPage])

  const syncUrl = useCallback(
    (state: PageState) => {
      if (typeof window === 'undefined') return

      let newUrl: string
      if (state.type === 'intro') {
        newUrl = introUrl
      } else if (state.type === 'block' && state.blockIndex !== undefined) {
        newUrl = getBlockUrl(state.blockIndex)
      } else if (state.type === 'pdf') {
        newUrl = pdfUrl
        if (state.currentPdfFileIndex !== undefined && state.currentPdfFileIndex > 0) {
          newUrl = `${pdfUrl}?file=${state.currentPdfFileIndex + 1}`
        }
      } else if (state.type === 'outro') {
        newUrl = completeUrl
      } else {
        return
      }

      const currentPath = window.location.pathname
      const currentSearch = window.location.search
      const normalizedCurrent = currentPath + currentSearch
      if (normalizedCurrent !== newUrl) {
        window.history.replaceState(null, '', newUrl)
      }
    },
    [introUrl, pdfUrl, completeUrl, getBlockUrl],
  )

  const pageToState = useCallback(
    (page: number): PageState => {
      if (page === 0) return { type: 'intro', pageNumber: 0 }
      if (page === totalPages - 1) return { type: 'outro', pageNumber: page }
      // PDF pages: each file gets its own page
      if (page >= pdfStartPage && page <= pdfEndPage) {
        return {
          type: 'pdf',
          pageNumber: page,
          currentPdfFileIndex: page - pdfStartPage,
        }
      }
      const blockIndex = page - 1
      return { type: 'block', pageNumber: page, blockIndex }
    },
    [totalPages, pdfStartPage, pdfEndPage],
  )

  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isPending) {
      timerRef.current = setTimeout(() => setIsNavigating(true), 300)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      setIsNavigating(false)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPending])

  const handleNext = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const nextPage = prev.pageNumber + 1
        if (nextPage >= totalPages) return prev
        return pageToState(nextPage)
      })
    })
  }, [totalPages, pageToState, startTransition])

  const handlePrev = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const prevPage = prev.pageNumber - 1
        if (prevPage < 0) return prev
        return pageToState(prevPage)
      })
    })
  }, [pageToState, startTransition])

  const handleStart = useCallback(() => {
    if (blocks.length === 0 && pdfCount > 0) {
      setPageState({ type: 'pdf', pageNumber: pdfStartPage, currentPdfFileIndex: 0 })
      return
    }
    if (blocks.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    setPageState({ type: 'block', pageNumber: 1, blockIndex: 0 })
  }, [blocks.length, totalPages, pdfCount, pdfStartPage])

  useEffect(() => {
    syncUrl(pageState)
  }, [pageState, syncUrl])

  const progressPercent = (() => {
    if (pageState.type === 'intro') return 0
    if (pageState.type === 'outro') return 100
    if (pageState.type === 'pdf' && pageState.currentPdfFileIndex !== undefined) {
      const contentSteps = blocks.length + pdfCount
      if (contentSteps === 0) return 0
      const pdfIndex = pageState.currentPdfFileIndex
      return ((blocks.length + pdfIndex + 1) / contentSteps) * 100
    }
    if (pageState.type === 'block' && pageState.blockIndex !== undefined) {
      const contentSteps = blocks.length + pdfCount
      if (contentSteps === 0) return 0
      return ((pageState.blockIndex + 1) / contentSteps) * 100
    }
    return 0
  })()

  const getCurrentBlockOrdinal = useCallback(() => {
    if (pageState.type !== 'block' || pageState.blockIndex === undefined) return null
    return pageState.blockIndex + 1
  }, [pageState])

  return {
    pageState,
    totalPages,
    progressPercent,
    isNavigating,
    canGoNext: pageState.pageNumber < totalPages - 1,
    canGoPrev: pageState.pageNumber > 0,
    handleNext,
    handlePrev,
    handleStart,
    getCurrentBlockOrdinal,
    totalBlocks: blocks.length,
  }
}
