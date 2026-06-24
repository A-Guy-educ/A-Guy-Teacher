'use client'

import React, { useState } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Button } from '@/ui/web/components/button'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { ResolvedLessonBlock } from '@/server/repos/queries/lesson-blocks'

interface ContentPageData {
  id: string
  title?: string | null
  slug?: string | null
}

interface ContentPagesPreambleProps {
  lessonTitle: string
  blocks: ResolvedLessonBlock[]
  contentPageBodies?: Record<string, React.ReactNode>
  onFinish: () => void
}

const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
}

export function ContentPagesPreamble({
  lessonTitle,
  blocks,
  contentPageBodies,
  onFinish,
}: ContentPagesPreambleProps) {
  const t = useTranslations('courses')
  const contentPages = blocks
    .filter((b) => b.type === 'contentPage')
    .map((b) => b.data as ContentPageData)
  const total = contentPages.length
  const [index, setIndex] = useState(0)

  if (total === 0) {
    onFinish()
    return null
  }

  const current = contentPages[index]
  const isLast = index === total - 1
  const bodyRendered = contentPageBodies?.[current.id]
  const finishLabel = t('lessonIntroStart')
  const nextLabel = t('exercisesPagerNext')
  const prevLabel = t('exercisesPagerPrev')

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => {
    if (isLast) {
      onFinish()
      return
    }
    setIndex((i) => Math.min(total - 1, i + 1))
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 overflow-y-auto pb-4 outline-none">
        <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div key={current.id} {...pageTransition} className="space-y-8">
              <div className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground">
                <span className="truncate max-w-[200px]">{lessonTitle}</span>
                <ChevronRight className="w-3 h-3 shrink-0 rtl:rotate-180" />
                <span className="text-foreground font-medium">
                  {`${t('contentPageLabel')} ${index + 1} ${t('of')} ${total}`}
                </span>
              </div>

              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-border/40">
                  <FileText className="w-3 h-3 inline-block me-1" />
                  {`${t('contentPageLabel')} ${index + 1} ${t('of')} ${total}`}
                </span>
                <h1 className="text-display-md md:text-display-lg font-medium leading-tight text-foreground mb-3">
                  {current.title}
                </h1>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50">
                {bodyRendered ? (
                  <div className="prose prose-lg max-w-none dark:prose-invert leading-relaxed">
                    {bodyRendered}
                  </div>
                ) : (
                  <div className="text-center py-section-md">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-body-sm font-medium text-muted-foreground">
                      {t('contentPageNoBody')}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <div className="sticky bottom-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border/50 px-6 py-content-gap pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-content-gap-lg">
          <button
            onClick={goPrev}
            disabled={index === 0}
            aria-label={prevLabel}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
              index === 0
                ? 'text-muted-foreground/40'
                : 'bg-muted text-foreground hover:bg-muted/80',
            )}
          >
            <span className="text-heading-lg font-light">‹</span>
          </button>
          {isLast ? (
            <Button onClick={goNext} className="px-6">
              {finishLabel}
            </Button>
          ) : (
            <button
              onClick={goNext}
              aria-label={nextLabel}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer bg-muted text-foreground hover:bg-muted/80"
            >
              <span className="text-heading-lg font-light">›</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
