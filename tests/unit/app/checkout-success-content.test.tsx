// @vitest-environment jsdom

/**
 * Regression guard for CheckoutSuccessContent.
 *
 * Pinned behavior:
 *   - transaction === null → "Processing..." spinner (the old stuck state, which
 *     is now only reached when the lookup id genuinely doesn't match a row)
 *   - transaction.status === 'succeeded' → "Confirmed!" — does NOT require
 *     entitlementsGrantedAt (which is currently always null because
 *     grantProductEntitlements is a stub; the old check would have left every
 *     successful payment stuck on "Pending" forever)
 *   - transaction.status === 'pending' → "Pending" with refresh button
 *   - transaction.status === 'failed' or 'refunded' → "Payment failed"
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const t = (key: string) => key
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => t,
}))

import { CheckoutSuccessContent } from '@/app/(frontend)/checkout/success/CheckoutSuccessContent'

describe('CheckoutSuccessContent', () => {
  afterEach(() => cleanup())

  it('renders "missingSession" when sessionId is not provided', () => {
    render(<CheckoutSuccessContent sessionId={undefined} transaction={null} productName="" />)
    expect(screen.getByRole('heading').textContent).toBe('success.missingSession')
  })

  it('renders the "processing" spinner when the transaction lookup returns null', () => {
    render(<CheckoutSuccessContent sessionId="ORDER_X" transaction={null} productName="" />)
    expect(screen.getByRole('heading').textContent).toBe('success.processing')
  })

  it('renders "confirmed" purely on status=succeeded — does NOT require entitlementsGrantedAt', () => {
    // This is the regression we care about. Pre-this-PR the check was
    // `succeeded && !!entitlementsGrantedAt`. Because grantProductEntitlements
    // is a stub today, the latter half was always false, so the buyer saw
    // "Pending" forever even after the webhook flipped status. Lock it down.
    render(
      <CheckoutSuccessContent
        sessionId="ORDER_X"
        transaction={{ id: 'tx1', status: 'succeeded' }}
        productName="Test Product"
      />,
    )
    expect(screen.getByRole('heading').textContent).toBe('success.confirmedTitle')
  })

  it('renders "pending" for status=pending', () => {
    render(
      <CheckoutSuccessContent
        sessionId="ORDER_X"
        transaction={{ id: 'tx1', status: 'pending' }}
        productName=""
      />,
    )
    expect(screen.getByRole('heading').textContent).toBe('success.pendingTitle')
  })

  it('renders "paymentFailed" for status=failed', () => {
    render(
      <CheckoutSuccessContent
        sessionId="ORDER_X"
        transaction={{ id: 'tx1', status: 'failed' }}
        productName=""
      />,
    )
    expect(screen.getByRole('heading').textContent).toBe('success.paymentFailed')
  })

  it('renders "paymentFailed" for status=refunded', () => {
    render(
      <CheckoutSuccessContent
        sessionId="ORDER_X"
        transaction={{ id: 'tx1', status: 'refunded' }}
        productName=""
      />,
    )
    expect(screen.getByRole('heading').textContent).toBe('success.paymentFailed')
  })
})
