/**
 * Hook for using async actions with loading state
 *
 * @fileType hook
 * @domain ui
 * @pattern async-action-hook
 * @ai-summary Combines asyncAction + useLoadingState into a single hook; key must match a LOADING_KEYS entry or the selector will always return false
 */

'use client'

import { useCallback, useMemo } from 'react'
import { asyncAction, type ActionResult, type AsyncActionOptions } from '../AsyncAction'
import { useLoadingState } from './useLoadingState'

interface UseAsyncActionReturn<T, A extends unknown[]> {
  execute: (...args: A) => Promise<ActionResult<T>>
  isLoading: boolean
}

/**
 * Hook for using async actions with loading state
 *
 * @example
 * const { execute, isLoading } = useAsyncAction(
 *   (formData: FormData) => loginAction(formData),
 *   { key: 'login' }
 * )
 *
 * async function onSubmit(e) {
 *   const result = await execute(formData)
 *   if (result.success) { ... }
 * }
 */
export function useAsyncAction<T, A extends unknown[]>(
  action: (...args: A) => Promise<T>,
  options: AsyncActionOptions,
): UseAsyncActionReturn<T, A> {
  // Use generic key selector instead of action-specific
  const isLoading = useLoadingState({ key: options.key })

  const stableOptions = useMemo(() => options, [options])

  const execute = useCallback(
    async (...args: A): Promise<ActionResult<T>> => {
      return asyncAction(() => action(...args), stableOptions)
    },
    [action, stableOptions],
  )

  return useMemo(() => ({ execute, isLoading }), [execute, isLoading])
}
