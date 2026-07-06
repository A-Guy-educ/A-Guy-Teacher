/**
 * useBugReportForm
 *
 * Encapsulates the local form state for the "Report a Bug" popover: description,
 * optional contact email (prefilled from the current user when available),
 * submission lifecycle, and the underlying POST to /api/bug-report.
 *
 * The hook is intentionally dumb about i18n — callers translate the messages
 * via the existing `useTranslations` provider so the strings live in
 * messages/{en,he}.json, not in this file.
 *
 * @fileType hook
 * @domain bug-report
 * @pattern form-state
 */

'use client'

import { useCallback, useState } from 'react'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'

export interface UseBugReportFormOptions {
  /** Translation for "report sent, thanks" — success toast body */
  successMessage: string
  /** Translation for "send failed, try again" — error toast body */
  errorMessage: string
  /** Translation for the "you're sending too many, slow down" toast */
  rateLimitedMessage: string
}

export interface UseBugReportFormReturn {
  description: string
  setDescription: (value: string) => void
  contactEmail: string
  setContactEmail: (value: string) => void
  isSubmitting: boolean
  error: string | null
  /** Pre-filled from useCurrentUser() — flips to true once the user object loads. */
  prefilledFromUser: boolean
  canSubmit: boolean
  submit: () => Promise<{ ok: boolean; rateLimited: boolean }>
  reset: () => void
}

const DESCRIPTION_MIN = 5

export function useBugReportForm(options: UseBugReportFormOptions): UseBugReportFormReturn {
  const { user } = useCurrentUser()

  const [description, setDescription] = useState('')
  const [contactEmail, setContactEmail] = useState<string>(() => {
    return user?.email ?? ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Once the user finishes loading, snap the prefilled email in. We don't
  // overwrite a value the user already typed, so a deliberate edit survives
  // a slow auth resolve.
  const [prefilledFromUser, setPrefilledFromUser] = useState<boolean>(() => {
    return Boolean(user?.email)
  })
  if (user?.email && !prefilledFromUser && contactEmail === '') {
    setContactEmail(user.email)
    setPrefilledFromUser(true)
  }

  const canSubmit = description.trim().length >= DESCRIPTION_MIN && !isSubmitting

  const submit = useCallback(async (): Promise<{ ok: boolean; rateLimited: boolean }> => {
    if (!canSubmit) return { ok: false, rateLimited: false }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          contactEmail: contactEmail.trim() || undefined,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        }),
      })

      if (response.status === 429) {
        setError(options.rateLimitedMessage)
        return { ok: false, rateLimited: true }
      }

      if (!response.ok) {
        setError(options.errorMessage)
        return { ok: false, rateLimited: false }
      }

      // 200 with delivered:false (e.g. no adapter) is still a success from the
      // user's perspective — the report is captured. We don't surface that
      // detail to the user; the support team will see the same envelope.
      setDescription('')
      return { ok: true, rateLimited: false }
    } catch {
      setError(options.errorMessage)
      return { ok: false, rateLimited: false }
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, description, contactEmail, options.errorMessage, options.rateLimitedMessage])

  const reset = useCallback(() => {
    setDescription('')
    setError(null)
  }, [])

  return {
    description,
    setDescription,
    contactEmail,
    setContactEmail,
    isSubmitting,
    error,
    prefilledFromUser,
    canSubmit,
    submit,
    reset,
  }
}
