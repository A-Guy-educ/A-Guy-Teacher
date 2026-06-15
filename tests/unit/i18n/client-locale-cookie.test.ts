import { describe, expect, it } from 'vitest'
import { buildClientLocaleCookie } from '@/i18n/client-locale-cookie'

describe('buildClientLocaleCookie', () => {
  it('uses a normal cookie outside embedded previews', () => {
    expect(buildClientLocaleCookie('en', false)).toBe(
      'NEXT_LOCALE=en; path=/; max-age=31536000; SameSite=Lax',
    )
  })

  it('uses a partitioned cookie inside embedded previews', () => {
    expect(buildClientLocaleCookie('he', true)).toBe(
      'NEXT_LOCALE=he; path=/; max-age=31536000; SameSite=None; Secure; Partitioned',
    )
  })
})
