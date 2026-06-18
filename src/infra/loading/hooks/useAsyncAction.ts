/**
 * Hook for using async actions with loading state
 *
 * @fileType hook
 * @domain ui
 * @pattern async-action-hook
 * @ai-summary Combines asyncAction + useLoadingState into a single hook; key must match a LOADING_KEYS entry or the selector will always return false
 */

'use client'

/**
 * @ai-summary Combines asyncAction + useLoadingState into a single hook — returns
 * a stable execute() function and an isLoading boolean derived from the loading key.
 * The action function can accept arbitrary arguments passed through to the underlying async call.
 *
 * @ai-trap The returned execute() is stable across renders only when the action
 * and options are stable — never inline an arrow function as the action or the
 * options object, or a new execute will be created on every render.
 */
import { useCallback, useMemo } from 'react'
import { asyncAction, type ActionResult, type AsyncActionOptions } from '../AsyncAction'
import { useLoadingState } from './useLoadingState'

/**
 * @fileType client-hook
 * @domain frontend
 * @ai-summary Combines useLoadingState and asyncAction into one hook — returns stable execute fn and isLoading bool; pass a stable options reference (not a fresh object each render) or the execute fn will be recreated on every render.
 */
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
