import { describe, expect, it } from 'vitest'

import { isEmbeddedRequest } from '@/infra/auth/shared-login/embedded-request'

describe('isEmbeddedRequest', () => {
  it('treats an iframe document load as embedded', () => {
    expect(isEmbeddedRequest(new Headers({ 'Sec-Fetch-Dest': 'iframe' }))).toBe(true)
    expect(isEmbeddedRequest(new Headers({ 'sec-fetch-dest': 'IFRAME' }))).toBe(true)
  })

  it('never treats a top-level navigation as embedded, even cross-site', () => {
    // The Google OAuth redirect. Classing it as embedded would partition the
    // cookie and break login on mobile Safari (issue #783).
    expect(
      isEmbeddedRequest(
        new Headers({ 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Site': 'cross-site' }),
      ),
    ).toBe(false)
  })

  it('treats a cross-site subresource request as embedded', () => {
    // A server action posted from inside the preview iframe.
    expect(
      isEmbeddedRequest(new Headers({ 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Site': 'cross-site' })),
    ).toBe(true)
  })

  it('does not treat a same-origin subresource request as embedded', () => {
    expect(
      isEmbeddedRequest(
        new Headers({ 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Site': 'same-origin' }),
      ),
    ).toBe(false)
  })

  it('falls back to comparing Origin with Host when Sec-Fetch headers are absent', () => {
    // Safari before 16.4 sends no Sec-Fetch-* headers. Without this fallback a
    // login inside the preview pane would be written as a plain Lax cookie and
    // silently dropped by the browser.
    expect(
      isEmbeddedRequest(
        new Headers({ origin: 'https://dashboard.example.com', host: 'www.a-guy.co.il' }),
      ),
    ).toBe(true)

    expect(
      isEmbeddedRequest(
        new Headers({ origin: 'https://www.a-guy.co.il', host: 'www.a-guy.co.il' }),
      ),
    ).toBe(false)
  })

  it('assumes top-level when there is nothing to go on', () => {
    // The shareable variant is the safer default: it is readable by siblings,
    // whereas a needless partition would break them silently.
    expect(isEmbeddedRequest(new Headers())).toBe(false)
    expect(isEmbeddedRequest(new Headers({ origin: 'not-a-url', host: 'www.a-guy.co.il' }))).toBe(
      false,
    )
  })
})
