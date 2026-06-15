/**
 * Unit Tests for Payment Environment Helpers
 *
 * Tests the per-provider env getters: getStripeEnv() and getPayPalEnv().
 * They're independent so a deployment can configure only one provider.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getPayPalEnv,
  getStripeEnv,
  MissingPaymentEnvError,
  resetPaymentEnvCache,
} from '@/lib/payment/env'

const STRIPE_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CURRENCY',
]
const PAYPAL_VARS = [
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'PAYPAL_SANDBOX',
]

function clearAllPaymentVars() {
  for (const name of [...STRIPE_VARS, ...PAYPAL_VARS]) {
    delete process.env[name]
  }
}

describe('Payment Environment Helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    resetPaymentEnvCache()
    clearAllPaymentVars()
  })

  afterEach(() => {
    resetPaymentEnvCache()
    clearAllPaymentVars()
    vi.restoreAllMocks()
  })

  describe('getStripeEnv', () => {
    it('returns all Stripe env vars when required ones are set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      process.env.STRIPE_CURRENCY = 'USD'

      const env = getStripeEnv()

      expect(env.stripeSecretKey).toBe('sk_test_xxx')
      expect(env.stripePublishableKey).toBe('pk_test_xxx')
      expect(env.stripeWebhookSecret).toBe('whsec_xxx')
      expect(env.stripeCurrency).toBe('USD')
    })

    it('defaults STRIPE_CURRENCY to ILS when not set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'

      expect(getStripeEnv().stripeCurrency).toBe('ILS')
    })

    it('returns empty string for optional vars that are not set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'

      expect(getStripeEnv().stripePublishableKey).toBe('')
    })

    it('throws listing only Stripe vars when STRIPE_SECRET_KEY is missing', () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'

      expect(() => getStripeEnv()).toThrow(
        'Missing required Stripe environment variables: STRIPE_SECRET_KEY',
      )
    })

    it('throws when STRIPE_WEBHOOK_SECRET is missing', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'

      expect(() => getStripeEnv()).toThrow(
        'Missing required Stripe environment variables: STRIPE_WEBHOOK_SECRET',
      )
    })

    it('does NOT throw when PayPal vars are missing', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'

      expect(() => getStripeEnv()).not.toThrow()
    })

    it('caches the result across calls', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'

      expect(getStripeEnv()).toBe(getStripeEnv())
    })
  })

  describe('getPayPalEnv', () => {
    it('returns all PayPal env vars when required ones are set', () => {
      process.env.PAYPAL_CLIENT_ID = 'client_id_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'
      process.env.PAYPAL_WEBHOOK_ID = 'webhook_id_xxx'
      process.env.PAYPAL_SANDBOX = 'true'

      const env = getPayPalEnv()

      expect(env.paypalClientId).toBe('client_id_xxx')
      expect(env.paypalClientSecret).toBe('client_secret_xxx')
      expect(env.paypalWebhookId).toBe('webhook_id_xxx')
      expect(env.paypalSandbox).toBe(true)
    })

    it('defaults paypalSandbox to true when PAYPAL_SANDBOX is unset', () => {
      process.env.PAYPAL_CLIENT_ID = 'cid'
      process.env.PAYPAL_CLIENT_SECRET = 'cs'
      process.env.PAYPAL_WEBHOOK_ID = 'wid'

      expect(getPayPalEnv().paypalSandbox).toBe(true)
    })

    it('treats PAYPAL_SANDBOX="false" as live mode', () => {
      process.env.PAYPAL_CLIENT_ID = 'cid'
      process.env.PAYPAL_CLIENT_SECRET = 'cs'
      process.env.PAYPAL_WEBHOOK_ID = 'wid'
      process.env.PAYPAL_SANDBOX = 'false'

      expect(getPayPalEnv().paypalSandbox).toBe(false)
    })

    it('throws listing every missing PayPal var', () => {
      expect(() => getPayPalEnv()).toThrow(
        'Missing required PayPal environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID',
      )
    })

    it('does NOT throw when Stripe vars are missing', () => {
      process.env.PAYPAL_CLIENT_ID = 'cid'
      process.env.PAYPAL_CLIENT_SECRET = 'cs'
      process.env.PAYPAL_WEBHOOK_ID = 'wid'

      expect(() => getPayPalEnv()).not.toThrow()
    })

    it('caches the result across calls', () => {
      process.env.PAYPAL_CLIENT_ID = 'cid'
      process.env.PAYPAL_CLIENT_SECRET = 'cs'
      process.env.PAYPAL_WEBHOOK_ID = 'wid'

      expect(getPayPalEnv()).toBe(getPayPalEnv())
    })
  })

  describe('MissingPaymentEnvError', () => {
    // The route layer uses `instanceof MissingPaymentEnvError` to distinguish a
    // missing-env failure from any other thrown error. This guarantees the
    // class is an actual constructor that survives `throw`/`catch`.
    it('throws an instance of MissingPaymentEnvError for missing Stripe vars', () => {
      try {
        getStripeEnv()
        throw new Error('expected getStripeEnv to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(MissingPaymentEnvError)
        expect(err).toBeInstanceOf(Error)
        if (err instanceof MissingPaymentEnvError) {
          expect(err.provider).toBe('Stripe')
          expect(err.missing).toContain('STRIPE_SECRET_KEY')
        }
      }
    })

    it('throws an instance of MissingPaymentEnvError for missing PayPal vars', () => {
      try {
        getPayPalEnv()
        throw new Error('expected getPayPalEnv to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(MissingPaymentEnvError)
        if (err instanceof MissingPaymentEnvError) {
          expect(err.provider).toBe('PayPal')
          expect(err.missing).toContain('PAYPAL_CLIENT_ID')
        }
      }
    })
  })

  describe('resetPaymentEnvCache', () => {
    it('clears both caches so subsequent calls re-validate', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      process.env.PAYPAL_CLIENT_ID = 'cid'
      process.env.PAYPAL_CLIENT_SECRET = 'cs'
      process.env.PAYPAL_WEBHOOK_ID = 'wid'

      getStripeEnv()
      getPayPalEnv()

      process.env.STRIPE_SECRET_KEY = 'sk_test_yyy'
      process.env.PAYPAL_CLIENT_ID = 'new_cid'

      // Cached values still in effect.
      expect(getStripeEnv().stripeSecretKey).toBe('sk_test_xxx')
      expect(getPayPalEnv().paypalClientId).toBe('cid')

      resetPaymentEnvCache()

      expect(getStripeEnv().stripeSecretKey).toBe('sk_test_yyy')
      expect(getPayPalEnv().paypalClientId).toBe('new_cid')
    })
  })
})
