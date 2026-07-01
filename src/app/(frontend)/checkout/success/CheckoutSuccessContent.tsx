'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { CheckCircle2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'

type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

interface TransactionData {
  id: string
  status: TransactionStatus
}

interface FirstCourse {
  id: string
  slug: string
  title: string
}

interface CheckoutSuccessContentProps {
  sessionId?: string
  transaction: TransactionData | null
  productName: string
  firstCourse?: FirstCourse | null
}

// Poll cadence for the two "waiting for admin webhook" states.
// PayPal typically fires the CAPTURE.COMPLETED webhook 5–20s after redirect;
// 3s keeps latency-to-unlock tight without hammering Mongo. We stop after
// ~45s so a genuine webhook failure (misconfigured URL, admin down) doesn't
// leave the buyer staring at a spinner — they get the manual refresh button
// as an escape hatch. Pending-state auto-refresh is a coarser 5s: it re-runs
// the server component to re-read `transaction.status`, so a shorter interval
// would waste request budget without helping. Pending is capped at 5 minutes
// wall-clock so a genuinely stuck payment (ACH hold, bank review, dead
// webhook during a sale) doesn't pile up unbounded refreshes for however
// long the buyer leaves the tab open. After the cap they still have the
// manual refresh button.
const ENTITLEMENT_POLL_INTERVAL_MS = 3000
const ENTITLEMENT_POLL_TIMEOUT_MS = 45000
const PENDING_STATUS_REFRESH_INTERVAL_MS = 5000
const PENDING_STATUS_REFRESH_MAX_MS = 5 * 60 * 1000

export function CheckoutSuccessContent({
  sessionId,
  transaction,
  productName,
  firstCourse,
}: CheckoutSuccessContentProps) {
  const t = useTranslations('checkout')
  const router = useRouter()

  // Invalidate the Next.js client router cache once the transaction has flipped
  // to `succeeded`. Without this, the buyer's next navigation (e.g. clicking
  // into the course they just bought) would serve a cached layout/page from
  // before the enrollment was created — they'd see a "needs payment" gate that
  // only clears after a hard reload. router.refresh() bumps the cache so the
  // next server fetch is fresh.
  //
  // Note: this latch is deliberately one-shot per mount via useRef. If a
  // transaction ever toggles pending → succeeded → pending (e.g. a refund
  // arriving while the buyer is still on this page), it will NOT refresh again.
  // That's the intended behavior — the cache invalidation only matters for the
  // initial succeeded transition before the buyer navigates into the course.
  // Don't replace this with a state-based gate unless you want refresh loops.
  const hasRefreshedRef = useRef(false)
  useEffect(() => {
    if (transaction?.status === 'succeeded' && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true
      router.refresh()
    }
  }, [transaction?.status, router])

  // Auto-refresh the pending state every ~5s so buyers don't have to sit and
  // press the manual refresh button waiting for the webhook. Only wires up in
  // the pending state; other statuses either terminate here (confirmed / failed)
  // or drive the entitlement polling below. Bounded at 5 minutes so an
  // indefinitely stuck payment (bank hold, webhook outage during a busy sale)
  // can't pile up refreshes for hours on an abandoned tab.
  useEffect(() => {
    if (transaction?.status !== 'pending') return
    const startedAt = Date.now()
    const id = window.setInterval(() => {
      if (Date.now() - startedAt >= PENDING_STATUS_REFRESH_MAX_MS) {
        window.clearInterval(id)
        return
      }
      router.refresh()
    }, PENDING_STATUS_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [transaction?.status, router])

  // Once the transaction is confirmed, poll /api/entitlements/check for the
  // first course the product grants until we see hasAccess=true. The gap
  // between "payment succeeded" and "enrollment row written" is the whole
  // reason the buyer used to hit the paid modal after purchase; holding this
  // screen in a "granting access…" state until the row lands closes that race.
  //
  // Bounded at ENTITLEMENT_POLL_TIMEOUT_MS so a genuine webhook failure
  // doesn't trap the buyer — after that we reveal the button anyway. The
  // course page they land on will still render its paid-content modal in that
  // failure case (same "purchase required" copy as any other lack-of-access),
  // which is not a purchase-specific narrative — this is the known gap, do
  // NOT re-tighten to keep the buyer trapped here.
  //
  // Uses chained setTimeout instead of setInterval so we (a) never overlap
  // in-flight requests when Mongo hits >3s, and (b) naturally stop scheduling
  // once we've resolved (hasAccess=true) or timed out — no orphaned interval
  // continuing to hammer the API after we've given up. `pollTimedOut` also
  // participates in shouldPollEntitlement below as belt-and-suspenders: the
  // effect will bail immediately on re-render even before the pending
  // in-flight request settles.
  const [hasEntitlement, setHasEntitlement] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const shouldPollEntitlement =
    transaction?.status === 'succeeded' && !!firstCourse && !hasEntitlement && !pollTimedOut
  // Pin to the primitive id so the effect doesn't re-fire (and reset the 45s
  // timeout budget) when router.refresh() hands us a new `firstCourse` object
  // with the same identity. slug is captured via ref for the same reason.
  const firstCourseId = firstCourse?.id
  const firstCourseSlug = firstCourse?.slug
  useEffect(() => {
    if (!shouldPollEntitlement || !firstCourseId) return
    let cancelled = false
    let timeoutId: number | undefined
    const startedAt = Date.now()

    async function poll() {
      if (cancelled) return
      try {
        const res = await fetch(
          `/api/entitlements/check?courseId=${encodeURIComponent(firstCourseId!)}`,
          { cache: 'no-store' },
        )
        if (cancelled) return
        if (res.ok) {
          const data: { hasAccess?: boolean } = await res.json()
          if (cancelled) return
          if (data.hasAccess) {
            setHasEntitlement(true)
            // Fire analytics AFTER the poll confirms the enrollment row is
            // actually written server-side — this is the moment the buyer
            // materially gained access. Was previously emitted at coupon-redeem
            // in the modal (now removed); the paid path is the buy-flow analog
            // and coupons still emit from within their own success handlers if
            // reintroduced. Server-side (redeem API) can't reach the browser
            // event bus, so the client is the right seam.
            systemEventBus.emit(SYSTEM_EVENTS.ACCESS_GRANTED, {
              access_type: 'paid' as const,
              course_id: firstCourseId!,
              course_slug: firstCourseSlug,
            })
            return
          }
        }
      } catch {
        // Network hiccup — swallow and let the next scheduled tick retry.
      }
      if (cancelled) return
      if (Date.now() - startedAt >= ENTITLEMENT_POLL_TIMEOUT_MS) {
        setPollTimedOut(true)
        return
      }
      timeoutId = window.setTimeout(poll, ENTITLEMENT_POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [shouldPollEntitlement, firstCourseId, firstCourseSlug])

  if (!sessionId) {
    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.missingSession')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-6">
            {t('success.noSessionDescription')}
          </p>
          <Button onClick={() => (window.location.href = '/products')} className="w-full">
            {t('success.backToProducts')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!transaction) {
    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.processing')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-6">
            {t('success.processingDescription')}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            <RefreshCw className="w-4 h-4 me-2" />
            {t('success.refresh')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // TODO: when grantProductEntitlements is wired up (currently a stub at
  // src/lib/payment/grant-entitlements.ts), tighten this back to also require
  // `entitlementsGrantedAt`. Right now nothing ever sets that field, so
  // requiring it would leave every payment stuck on "Pending" forever.
  const isConfirmed = transaction.status === 'succeeded'
  const isFailed = transaction.status === 'failed' || transaction.status === 'refunded'

  if (isFailed) {
    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.paymentFailed')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-6">
            {t('success.paymentFailedDescription')}
          </p>
          <Button onClick={() => (window.location.href = '/products')} className="w-full">
            {t('success.backToProducts')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isConfirmed) {
    const waitingForAccess = !!firstCourse && !hasEntitlement && !pollTimedOut
    const courseHref = firstCourse ? `/courses/${encodeURIComponent(firstCourse.slug)}` : '/'
    const goToCourseLabel = firstCourse
      ? t('success.goToCourse').replace('{course}', firstCourse.title)
      : t('success.goHome')

    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.confirmedTitle')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-2">
            {t('success.confirmedDescription')}
          </p>
          {productName && (
            <p className="text-body-sm text-muted-foreground mb-6">
              {t('success.productLabel').replace('{product}', productName)}
            </p>
          )}
          {waitingForAccess ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('success.grantingAccess')}</span>
              </div>
              <Button disabled className="w-full">
                {goToCourseLabel}
              </Button>
            </div>
          ) : (
            <Button onClick={() => (window.location.href = courseHref)} className="w-full">
              {goToCourseLabel}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Pending
  return (
    <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
      <CardContent className="p-card-padding-lg text-center">
        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
        <h1 className="text-heading-lg font-black text-card-foreground mb-2">
          {t('success.pendingTitle')}
        </h1>
        <p className="text-body-md text-muted-foreground mb-2">{t('success.pendingDescription')}</p>
        {productName && (
          <p className="text-body-sm text-muted-foreground mb-6">
            {t('success.productLabel').replace('{product}', productName)}
          </p>
        )}
        <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
          <RefreshCw className="w-4 h-4 me-2" />
          {t('success.refresh')}
        </Button>
      </CardContent>
    </Card>
  )
}
