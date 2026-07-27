'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BuyButtonProps {
  productId: string
  productSlug: string
  productName: string
  couponCode?: string
  discountedAmount?: number
}

export function BuyButton({
  productId,
  productSlug,
  productName: _productName,
  couponCode,
}: BuyButtonProps) {
  const t = useTranslations('products')
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const [isLoadingPayPal, setIsLoadingPayPal] = useState(false)

  if (isAuthLoading) {
    return (
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          disabled
          className="w-full sm:flex-1 h-14 text-body-md font-bold rounded-xl"
          size="lg"
        >
          <Loader2 className="w-5 h-5 animate-spin me-2" />
        </Button>
      </div>
    )
  }

  if (!user) {
    return (
      <Button
        onClick={() => {
          const returnTo = encodeURIComponent(`/products/${productSlug}`)
          router.push(`/login?returnTo=${returnTo}`)
        }}
        className="w-full h-14 text-body-md font-bold rounded-xl"
        size="lg"
      >
        {t('loginToBuy')}
      </Button>
    )
  }

  const handleCheckout = async (provider: 'paypal') => {
    setIsLoadingPayPal(true)

    try {
      const body: Record<string, string> = { productId, provider }
      if (couponCode) {
        body.couponCode = couponCode
      }

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        const errorKey = data.error ?? 'checkout_failed'
        const errorMessages: Record<string, string> = {
          authentication_required: t('errors.authRequired'),
          product_not_found: t('errors.productNotFound'),
          product_not_active: t('errors.productNotActive'),
          invalid_coupon: t('errors.invalidCoupon'),
          checkout_failed: t('errors.checkoutFailed'),
          payment_provider_not_configured: t('errors.providerNotConfigured'),
          // Subscription-branch error codes. `subscription_checkout_disabled`
          // fires while the Admin webhook receiver is still shipping — buyers
          // deserve a "coming soon" message rather than a generic "checkout
          // failed" that reads like an outage.
          subscription_checkout_disabled: t('errors.subscriptionCheckoutDisabled'),
          in_flight_subscription_exists: t('errors.inFlightSubscriptionExists'),
          stripe_subscriptions_not_supported: t('errors.stripeSubscriptionsNotSupported'),
          coupons_not_supported_on_subscriptions: t('errors.couponsNotSupportedOnSubscriptions'),
          product_missing_interval: t('errors.productMissingInterval'),
          product_invalid_interval: t('errors.productInvalidInterval'),
          product_missing_price: t('errors.productMissingPrice'),
          invalid_currency: t('errors.invalidCurrency'),
        }
        const message = errorMessages[errorKey] ?? t('errors.checkoutFailed')
        // Longer toast for states the buyer can't self-serve (misconfig or
        // provider outage) — they need time to read what to do next.
        const longToastKeys = new Set([
          'payment_provider_not_configured',
          'subscription_checkout_disabled',
          'product_missing_interval',
          'product_invalid_interval',
          'product_missing_price',
          'invalid_currency',
        ])
        if (longToastKeys.has(errorKey)) {
          toast.error(message, { duration: 5000 })
        } else {
          toast.error(message)
        }
        setIsLoadingPayPal(false)
        return
      }

      window.location.href = data.checkoutUrl
    } catch {
      toast.error(t('errors.checkoutFailed'))
      setIsLoadingPayPal(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        onClick={() => handleCheckout('paypal')}
        disabled={isLoadingPayPal}
        className="w-full sm:flex-1 h-14 text-body-md font-bold rounded-xl bg-warning text-warning-foreground hover:bg-warning/90 hover:shadow-elevation-1 hover:scale-[1.02]"
        size="lg"
      >
        {isLoadingPayPal ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin me-2" />
            {t('redirecting')}
          </>
        ) : (
          t('payWithPaypal')
        )}
      </Button>
    </div>
  )
}
