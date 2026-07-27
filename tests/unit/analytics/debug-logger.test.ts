// @vitest-environment jsdom
/**
 * Debug Logger Unit Tests
 *
 * Verifies that the analytics debug logger:
 * - emits log/warn in development
 * - becomes a no-op in production without the URL flag
 * - honors the `?debug` URL query flag as a runtime escape hatch
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  _resetDebugLoggerForTests,
  analyticsDebugLog,
  createDebugLogger,
} from '@/infra/analytics/utils/debug-logger'

describe('Analytics Debug Logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let originalNodeEnv: string | undefined
  let originalLocation: Location | undefined

  beforeEach(() => {
    _resetDebugLoggerForTests()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    originalNodeEnv = process.env.NODE_ENV
    originalLocation = window.location
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    process.env.NODE_ENV = originalNodeEnv
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
    _resetDebugLoggerForTests()
  })

  it('emits log() in development', () => {
    process.env.NODE_ENV = 'development'

    analyticsDebugLog.log('hello')

    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls[0][0]).toBe('[Analytics]')
    expect(logSpy.mock.calls[0][1]).toBe('hello')
  })

  it('emits log() in test', () => {
    process.env.NODE_ENV = 'test'

    analyticsDebugLog.log('hello')

    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('is a no-op for log() in production without URL flag', () => {
    process.env.NODE_ENV = 'production'
    Object.defineProperty(window, 'location', {
      value: { search: '' } as Location,
      writable: true,
      configurable: true,
    })

    analyticsDebugLog.log('hello')

    expect(logSpy).not.toHaveBeenCalled()
  })

  it('is a no-op for warn() in production without URL flag', () => {
    process.env.NODE_ENV = 'production'
    Object.defineProperty(window, 'location', {
      value: { search: '' } as Location,
      writable: true,
      configurable: true,
    })

    analyticsDebugLog.warn('uh oh')

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('emits log() in production when ?debug is in URL', () => {
    process.env.NODE_ENV = 'production'
    Object.defineProperty(window, 'location', {
      value: { search: '?debug=1' } as unknown as Location,
      writable: true,
      configurable: true,
    })

    analyticsDebugLog.log('production debug')

    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls[0][1]).toBe('production debug')
  })

  it('emits warn() in production when ?debug is in URL', () => {
    process.env.NODE_ENV = 'production'
    Object.defineProperty(window, 'location', {
      value: { search: '?debug=analytics&foo=bar' } as unknown as Location,
      writable: true,
      configurable: true,
    })

    analyticsDebugLog.warn('warn in prod')

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('caches the URL flag so subsequent calls are consistent', () => {
    process.env.NODE_ENV = 'production'
    Object.defineProperty(window, 'location', {
      value: { search: '?debug=1' } as unknown as Location,
      writable: true,
      configurable: true,
    })

    analyticsDebugLog.log('first call')
    expect(logSpy).toHaveBeenCalledTimes(1)

    // Mutate the URL mid-session — the cache should keep emitting.
    Object.defineProperty(window, 'location', {
      value: { search: '' } as Location,
      writable: true,
      configurable: true,
    })
    analyticsDebugLog.log('second call')
    expect(logSpy).toHaveBeenCalledTimes(2)
  })

  describe('createDebugLogger()', () => {
    it('uses the supplied namespace as prefix', () => {
      process.env.NODE_ENV = 'development'
      const logger = createDebugLogger('GA4')

      logger.log('init')

      expect(logSpy.mock.calls[0][0]).toBe('[GA4]')
      expect(logSpy.mock.calls[0][1]).toBe('init')
    })

    it('forwards multiple arguments', () => {
      process.env.NODE_ENV = 'development'
      const logger = createDebugLogger('Mixpanel')

      logger.log('event', { foo: 1 }, [1, 2, 3])

      expect(logSpy.mock.calls[0]).toEqual(['[Mixpanel]', 'event', { foo: 1 }, [1, 2, 3]])
    })
  })
})
