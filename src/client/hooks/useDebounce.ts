/**
 * @fileType hook
 * @domain utility
 * @pattern debounce
 * @ai-summary Delays propagating a value until it has stopped changing for `delay` ms. Used to avoid excessive API calls or re-renders on rapid input.
 */

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
