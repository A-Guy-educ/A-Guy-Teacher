import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import type { Exercise } from '@/infra/types/content'
import type { ResolvedLessonBlock } from '@/server/repos/queries/lesson-blocks'

import { getExerciseUrlParam } from './getExerciseUrlParam'

type PageType = 'contentPage' | 'exercise' | 'outro'

interface PageState {
  type: PageType
  pageNumber: number
  blockIndex?: number
}

interface UseExercisesPagerProps {
  exercises: Exercise[]
  blocks?: ResolvedLessonBlock[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  /** Grade bucket to store progress under — must be the lesson's course label, not user's onboarding grade. */
  gradeLevel: string
  initialExerciseIndex?: number
}

/** Fire and forget progress save (silently ignores errors / unauthenticated users) */
function saveProgress(
  gradeLevel: string,
  params: {
    recordType: 'lesson' | 'exercise' | 'chapter'
    recordId: string
    completionPercentage: number
    status: 'not_started' | 'in_progress' | 'completed'
    score?: number
  },
) {
  if (!gradeLevel) return
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...params, gradeLevel }),
  }).catch(() => {
    /* silent - user may be anonymous */
  })
}

/** Get the 1-based exercise ordinal among exercises only (for breadcrumb) */
function getExerciseIndexInBlocks(blocks: ResolvedLessonBlock[], blockIndex: number): number {
  let exerciseCount = 0
  for (let i = 0; i <= blockIndex; i++) {
    if (blocks[i]?.type === 'exercise') {
      exerciseCount++
    }
  }
  return exerciseCount
}

export function useExercisesPager({
  exercises,
  blocks,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  gradeLevel,
  initialExerciseIndex = 0,
}: UseExercisesPagerProps) {
  // Use blocks if provided, otherwise build from exercises
  const rawBlocks: ResolvedLessonBlock[] =
    blocks ?? exercises.map((e) => ({ type: 'exercise', data: e }))

  // Partition: content pages first (preserving relative order), then exercises (preserving relative order)
  const contentPageBlocks = rawBlocks.filter((b) => b.type === 'contentPage')
  const exerciseBlocks = rawBlocks.filter((b) => b.type === 'exercise')
  const resolvedBlocks: ResolvedLessonBlock[] = [...contentPageBlocks, ...exerciseBlocks]

  const totalExercises = exerciseBlocks.length
  const totalContentPages = contentPageBlocks.length
  const totalPages = resolvedBlocks.length + 1 // blocks + outro

  const [pageState, setPageState] = useState<PageState>(() => {
    if (resolvedBlocks.length === 0) return { type: 'outro', pageNumber: totalPages - 1 }

    const blockIndex = Math.min(Math.max(initialExerciseIndex, 0), resolvedBlocks.length - 1)
    return {
      type: resolvedBlocks[blockIndex]?.type === 'contentPage' ? 'contentPage' : 'exercise',
      pageNumber: blockIndex,
      blockIndex,
    }
  })

  const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
  const completeUrl = `${basePath}/complete`

  const getExerciseUrl = useCallback(
    (index: number) => {
      const block = resolvedBlocks[index]
      if (!block || block.type !== 'exercise') return basePath
      const exercise = block.data as Exercise
      const slug = getExerciseUrlParam(exercise)
      return `${basePath}/exercises/${slug}`
    },
    [basePath, resolvedBlocks],
  )

  const getContentPageUrl = useCallback(
    (index: number) => {
      const block = resolvedBlocks[index]
      if (!block || block.type !== 'contentPage') return basePath
      const contentPage = block.data as { slug?: string | null; id: string }
      const slug = contentPage.slug || contentPage.id
      return `${basePath}/content/${slug}`
    },
    [basePath, resolvedBlocks],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname

    if (pathname === completeUrl) {
      setPageState({ type: 'outro', pageNumber: resolvedBlocks.length + 1 })
    } else if (pathname.startsWith(`${basePath}/exercises/`)) {
      const exerciseSlug = pathname.split('/exercises/')[1]
      const index = resolvedBlocks.findIndex(
        (b) => b.type === 'exercise' && getExerciseUrlParam(b.data as Exercise) === exerciseSlug,
      )
      if (index >= 0) {
        setPageState({
          type: 'exercise',
          pageNumber: index,
          blockIndex: index,
        })
      }
    } else if (pathname.startsWith(`${basePath}/content/`)) {
      const contentSlug = pathname.split('/content/')[1]
      const index = resolvedBlocks.findIndex((b) => {
        if (b.type !== 'contentPage') return false
        const cp = b.data as { slug?: string | null; id: string }
        return (cp.slug || cp.id) === contentSlug
      })
      if (index >= 0) {
        setPageState({
          type: 'contentPage',
          pageNumber: index,
          blockIndex: index,
        })
      }
    }
  }, [basePath, completeUrl, resolvedBlocks])

  const syncUrl = useCallback(
    (state: PageState) => {
      if (typeof window === 'undefined') return

      let newUrl: string
      if (state.type === 'contentPage' && state.blockIndex !== undefined) {
        newUrl = getContentPageUrl(state.blockIndex)
      } else if (state.type === 'exercise' && state.blockIndex !== undefined) {
        newUrl = getExerciseUrl(state.blockIndex)
      } else if (state.type === 'outro') {
        newUrl = completeUrl
      } else {
        return
      }

      const currentPath = window.location.pathname
      if (currentPath !== newUrl) {
        window.history.replaceState(null, '', newUrl)
      }
    },
    [completeUrl, getExerciseUrl, getContentPageUrl],
  )

  const pageToState = useCallback(
    (page: number): PageState => {
      if (page === totalPages - 1) return { type: 'outro', pageNumber: page }

      const blockIndex = page
      const block = resolvedBlocks[blockIndex]
      if (!block) return { type: 'outro', pageNumber: totalPages - 1 }

      return {
        type: block.type === 'contentPage' ? 'contentPage' : 'exercise',
        pageNumber: page,
        blockIndex,
      }
    },
    [totalPages, resolvedBlocks],
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

  const completionSavedRef = useRef(false)
  const visitedBlocksRef = useRef(new Set<number>())

  /** Save progress when leaving an exercise or content page block */
  const saveBlockProgress = useCallback(
    (prevState: PageState) => {
      if (prevState.blockIndex === undefined) return
      if (prevState.type === 'outro') return

      const block = resolvedBlocks[prevState.blockIndex]
      if (!block) return

      visitedBlocksRef.current.add(prevState.blockIndex)

      if (block.type === 'exercise') {
        const exercise = block.data as Exercise
        saveProgress(gradeLevel, {
          recordType: 'exercise',
          recordId: exercise.id,
          completionPercentage: 100,
          status: 'completed',
        })

        const visitedCount = visitedBlocksRef.current.size
        const total = resolvedBlocks.length
        if (total > 0 && !completionSavedRef.current) {
          const pct = Math.round((visitedCount / total) * 100)
          saveProgress(gradeLevel, {
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage: Math.min(pct, 99),
            status: 'in_progress',
          })
        }
      }
      // Content pages: mark as visited but don't mark as completed
    },
    [resolvedBlocks, lessonId, gradeLevel],
  )

  const handleNext = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const nextPage = prev.pageNumber + 1
        if (nextPage >= totalPages) return prev

        const nextState = pageToState(nextPage)

        if (nextState.type === 'outro' && !completionSavedRef.current) {
          completionSavedRef.current = true
        }

        saveBlockProgress(prev)

        if (nextState.type === 'outro') {
          saveProgress(gradeLevel, {
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage: 100,
            status: 'completed',
          })
        }

        return nextState
      })
    })
  }, [totalPages, pageToState, lessonId, gradeLevel, saveBlockProgress])

  const handlePrev = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const prevPage = prev.pageNumber - 1
        if (prevPage < 0) return prev

        saveBlockProgress(prev)

        return pageToState(prevPage)
      })
    })
  }, [pageToState, saveBlockProgress])

  const handleJumpToExercise = useCallback(
    (exerciseOrdinal: number) => {
      if (exerciseOrdinal < 1 || exerciseOrdinal > totalExercises) return

      let exerciseCount = 0
      let targetBlockIndex = -1
      for (let i = 0; i < resolvedBlocks.length; i++) {
        if (resolvedBlocks[i]?.type === 'exercise') {
          exerciseCount++
          if (exerciseCount === exerciseOrdinal) {
            targetBlockIndex = i
            break
          }
        }
      }
      if (targetBlockIndex < 0) return

      startTransition(() => {
        setPageState((prev) => {
          if (targetBlockIndex === prev.blockIndex) return prev

          saveBlockProgress(prev)

          saveProgress(gradeLevel, {
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage:
              totalExercises > 0 ? Math.round((exerciseOrdinal / totalExercises) * 100) : 0,
            status: 'in_progress',
          })

          return pageToState(targetBlockIndex)
        })
      })
    },
    [totalExercises, resolvedBlocks, gradeLevel, lessonId, pageToState, saveBlockProgress],
  )

  const handleStart = useCallback(() => {
    if (resolvedBlocks.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }

    saveProgress(gradeLevel, {
      recordType: 'lesson',
      recordId: lessonId,
      completionPercentage: 0,
      status: 'in_progress',
    })

    const firstBlock = resolvedBlocks[0]
    setPageState({
      type: firstBlock?.type === 'contentPage' ? 'contentPage' : 'exercise',
      pageNumber: 0,
      blockIndex: 0,
    })
  }, [resolvedBlocks, totalPages, lessonId, gradeLevel])

  useEffect(() => {
    syncUrl(pageState)
  }, [pageState, syncUrl])

  const progressPercent = (() => {
    if (pageState.type === 'outro') return 100

    if (
      (pageState.type === 'exercise' || pageState.type === 'contentPage') &&
      pageState.blockIndex !== undefined
    ) {
      const contentSteps = resolvedBlocks.length
      if (contentSteps === 0) return 0
      return ((pageState.blockIndex + 1) / contentSteps) * 100
    }

    return 0
  })()

  /** Returns 1-based exercise ordinal among exercises only (for "Exercise N of M" breadcrumb) */
  const getExerciseOrdinal = useCallback(() => {
    if (pageState.type !== 'exercise' || pageState.blockIndex === undefined) return null
    return getExerciseIndexInBlocks(resolvedBlocks, pageState.blockIndex)
  }, [pageState, resolvedBlocks])

  /** Returns 1-based content page ordinal among content pages only */
  const getContentPageOrdinal = useCallback(() => {
    if (pageState.type !== 'contentPage' || pageState.blockIndex === undefined) return null
    let pageCount = 0
    for (let i = 0; i <= pageState.blockIndex; i++) {
      if (resolvedBlocks[i]?.type === 'contentPage') {
        pageCount++
      }
    }
    return pageCount
  }, [pageState, resolvedBlocks])

  return {
    pageState,
    totalPages,
    progressPercent,
    isNavigating,
    canGoNext: pageState.pageNumber < totalPages - 1,
    canGoPrev: pageState.pageNumber > 0,
    handleNext,
    handlePrev,
    handleJumpToExercise,
    handleStart,
    getExerciseOrdinal,
    getContentPageOrdinal,
    totalExercises,
    totalContentPages,
    totalBlocks: resolvedBlocks.length,
    resolvedBlocks,
  }
}
