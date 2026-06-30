/**
 * @fileType hook
 * @domain utility
 * @pattern debounce
 * @ai-summary Delays propagating a value by `delay` ms — delays the returned value until the input stops changing for the specified duration.
 */

'use client'

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
