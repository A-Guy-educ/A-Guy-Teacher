/**
 * BugReportForm
 *
 * Floating popover that opens when the user clicks the bug-report FAB. Mirrors
 * the header/animation structure of the (now-parked) AgentChatWindow so the
 * slot, z-index, and motion feel consistent with what users previously had.
 *
 * The form contains: description textarea (required, min 5 chars), optional
 * contact email (prefilled from useCurrentUser when available), and a submit
 * button that shows a spinner while the request is in flight.
 *
 * Localization: all visible strings come from the `bugReport` i18n namespace;
 * the popover respects the active locale's text direction via the I18n
 * provider's `useLocale()` hook.
 *
 * @fileType component
 * @domain bug-report
 * @pattern floating-form
 */

'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Bug, Loader2, Send, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { useLocale, useTranslations } from '@/ui/web/providers/I18n'

import { useBugReportForm } from '../hooks/useBugReportForm'

interface BugReportFormProps {
  isOpen: boolean
  onClose: () => void
}

export function BugReportForm({ isOpen, onClose }: BugReportFormProps) {
  const t = useTranslations('bugReport')
  const locale = useLocale()
  const isRtl = locale === 'he'

  const {
    description,
    setDescription,
    contactEmail,
    setContactEmail,
    isSubmitting,
    canSubmit,
    submit,
    reset,
  } = useBugReportForm({
    successMessage: t('success'),
    errorMessage: t('error'),
    rateLimitedMessage: t('rateLimited'),
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus the textarea when the popover opens.
  useEffect(() => {
    if (isOpen) {
      // rAF so the textarea is mounted before we try to focus.
      requestAnimationFrame(() => textareaRef.current?.focus())
    } else {
      reset()
    }
  }, [isOpen, reset])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSubmit) return
    const result = await submit()
    if (result.ok) {
      toast.success(t('success'))
      onClose()
    } else if (result.rateLimited) {
      toast.error(t('rateLimited'))
    } else {
      toast.error(t('error'))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter alone submits, Shift+Enter inserts a newline. Same shortcut the
    // (now-parked) AgentChatWindow used so muscle memory carries over.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-24 right-6 z-[70] w-[400px] max-w-[calc(100vw-2rem)] bg-card rounded-2xl border border-border shadow-modal overflow-hidden flex flex-col"
          dir={isRtl ? 'rtl' : 'ltr'}
          data-testid="bug-report-form"
        >
          {/* Header — mirrors AgentChatWindow header structure so the slot feels
              identical to the user. */}
          <div className="flex items-center justify-between p-card-padding border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <Bug className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-body-sm">{t('title')}</h3>
                <p className="text-body-xs text-muted-foreground">{t('subtitle')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              aria-label={t('close')}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="p-card-padding space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="bug-report-description"
                className="block text-body-sm font-medium text-foreground"
              >
                {t('descriptionLabel')}
              </label>
              <textarea
                id="bug-report-description"
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('descriptionPlaceholder')}
                rows={4}
                required
                minLength={5}
                disabled={isSubmitting}
                className="w-full bg-muted rounded-lg px-3 py-2 text-body-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="bug-report-email"
                className="block text-body-sm font-medium text-foreground"
              >
                {t('emailLabel')}
              </label>
              <input
                id="bug-report-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                disabled={isSubmitting}
                className="w-full bg-muted rounded-lg px-3 py-2 text-body-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-10 rounded-lg bg-destructive text-destructive-foreground flex items-center justify-center gap-2 hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-body-sm font-medium">{t('sending')}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="text-body-sm font-medium">{t('submit')}</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
