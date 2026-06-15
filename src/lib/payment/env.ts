/**
 * Payment Environment Variables Helper
 *
 * @fileType utility
 * @domain payment
 * @pattern env-vault
 * @ai-summary Validates and exposes payment provider environment variables.
 *
 * Validates per provider so a deployment can ship with only one provider
 * configured (e.g. PayPal-only) without the other provider's secrets failing
 * validation. Throws on first access for whichever provider is requested.
 */

export interface StripeEnv {
  stripeSecretKey: string
  stripePublishableKey: string
  stripeWebhookSecret: string
  stripeCurrency: string
}

export interface PayPalEnv {
  paypalClientId: string
  paypalClientSecret: string
  paypalWebhookId: string
  paypalSandbox: boolean
}

let stripeCache: StripeEnv | null = null
let paypalCache: PayPalEnv | null = null

export function getStripeEnv(): StripeEnv {
  if (stripeCache) return stripeCache

  const missing: string[] = []
  if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY')
  if (!process.env.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET')

  if (missing.length > 0) {
    throw new Error(`Missing required Stripe environment variables: ${missing.join(', ')}`)
  }

  stripeCache = {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    stripeCurrency: process.env.STRIPE_CURRENCY ?? 'ILS',
  }
  return stripeCache
}

export function getPayPalEnv(): PayPalEnv {
  if (paypalCache) return paypalCache

  const missing: string[] = []
  if (!process.env.PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID')
  if (!process.env.PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET')
  if (!process.env.PAYPAL_WEBHOOK_ID) missing.push('PAYPAL_WEBHOOK_ID')

  if (missing.length > 0) {
    throw new Error(`Missing required PayPal environment variables: ${missing.join(', ')}`)
  }

  paypalCache = {
    paypalClientId: process.env.PAYPAL_CLIENT_ID ?? '',
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID ?? '',
    paypalSandbox: process.env.PAYPAL_SANDBOX !== 'false',
  }
  return paypalCache
}

export function resetPaymentEnvCache(): void {
  stripeCache = null
  paypalCache = null
}
