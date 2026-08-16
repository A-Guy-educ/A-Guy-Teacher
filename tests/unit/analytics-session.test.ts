/**
 * Unit tests for the external-dashboard analytics session helper.
 *
 * Covers:
 *  - getOrCreateSessionId returns a UUID and is stable within a session
 *  - resolveSource honours the priority order (utm_source → known referrer →
 *    direct) and persists the resolved value to localStorage
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __test__,
  getOrCreateSessionId,
  _resetSessionForTesting,
  resolveSource,
} from '@/lib/analytics/session'

describe('analytics session helper', () => {
  beforeEach(() => {
    if (typeof window === 'undefined') return

    window.sessionStorage.clear()
    window.localStorage.clear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { search: '' },
    })
    Object.defineProperty(document, 'referrer', { configurable: true, writable: true, value: '' })
  })

  afterEach(() => {
    _resetSessionForTesting()
    vi.restoreAllMocks()
  })

  describe('getOrCreateSessionId', () => {
    it('returns a UUID-shaped string', () => {
      const id = getOrCreateSessionId()
      expect(__test__.isUuid(id)).toBe(true)
    })

    it('persists the session id in sessionStorage under "aguy_sid"', () => {
      const id = getOrCreateSessionId()
      expect(window.sessionStorage.getItem('aguy_sid')).toBe(id)
    })

    it('returns the same id on subsequent calls within the same session', () => {
      const first = getOrCreateSessionId()
      const second = getOrCreateSessionId()
      expect(first).toBe(second)
    })

    it('reuses a non-UUID legacy value as if it were absent', () => {
      window.sessionStorage.setItem('aguy_sid', 'not-a-uuid')
      const id = getOrCreateSessionId()
      expect(id).not.toBe('not-a-uuid')
      expect(__test__.isUuid(id)).toBe(true)
    })
  })

  describe('resolveSource', () => {
    it('returns "direct" when no utm, no referrer, and no stored value', () => {
      expect(resolveSource()).toBe('direct')
      expect(window.localStorage.getItem('aguy_src')).toBe('direct')
    })

    it('prefers utm_source over a known referrer and persists the lowercased value', () => {
      ;(window.location as { search: string }).search = '?utm_source=Facebook'
      Object.defineProperty(document, 'referrer', { value: 'https://www.google.com/' })
      const source = resolveSource()
      expect(source).toBe('facebook')
      expect(window.localStorage.getItem('aguy_src')).toBe('facebook')
    })

    it('falls back to the referrer hostname when it is on the known list', () => {
      window.localStorage.clear()
      Object.defineProperty(document, 'referrer', { value: 'https://news.ycombinator.com/' })
      expect(resolveSource()).toBe('direct') // news.ycombinator.com is NOT in the known list

      window.localStorage.clear()
      Object.defineProperty(document, 'referrer', { value: 'https://www.google.com/search?q=foo' })
      expect(resolveSource()).toBe('www.google.com')
      expect(window.localStorage.getItem('aguy_src')).toBe('www.google.com')
    })

    it('reuses the persisted source on subsequent loads', () => {
      window.localStorage.setItem('aguy_src', 'reddit')
      ;(window.location as { search: string }).search = ''
      Object.defineProperty(document, 'referrer', { value: 'https://www.google.com/' })
      expect(resolveSource()).toBe('reddit')
    })

    it('ignores malformed referrers', () => {
      Object.defineProperty(document, 'referrer', { value: 'not-a-real-url' })
      expect(resolveSource()).toBe('direct')
    })
  })
})
