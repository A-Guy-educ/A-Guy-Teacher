/**
 * @fileType hook
 * @domain auth
 * @pattern user-context
 * @ai-summary Fetches the authenticated user from `/api/users/me` — listens to the `auth:changed` window event; returns `user: null` (never throws) when unauthenticated; do not use in server components.
 *
 * Gotcha: OAuth callback flows can briefly observe `user: null` before the auth change event fires, so callers should keep loading/anonymous states distinct.
 */

'use client'

import type { User } from '@/infra/types/content'
import { useCallback, useEffect, useState } from 'react'

interface UseCurrentUserReturn {
  user: User | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user'))
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Listen for auth changes (login/logout)
  useEffect(() => {
    const handleAuthChange = () => fetchUser()
    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [fetchUser])

  return { user, isLoading, error, refetch: fetchUser }
}
