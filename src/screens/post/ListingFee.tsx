import { Check, CircleAlert, CircleCheck, FlaskConical, Info, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../components/AuthProvider'
import { setDraftPointer } from '../../lib/draftCarry'
import { watchListingOrder } from '../../lib/listingFee'
import type { ListingOrder } from '../../lib/listingFee'
import { clearListingsCache } from '../../lib/useListings'
import { track } from '../../lib/track'
import { Sheet } from '../../components/Sheet'
import { ListingPhoto } from '../../components/ListingCard'
import type { Listing } from '../../lib/listings'
import { formatCents } from '../../lib/boosts'
import { LISTING_FEE_CENTS } from '../../lib/pricing'
import type { CheckoutMode } from '../../lib/pricing'
import { formatDates, formatRent } from '../../lib/format'

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// The $1 step between Preview and live. Rules for a paywall that doesn't
// scare people off:
//   - the price was shown before they started (Home, step 1, Preview)
//   - one line item, one total, no add-ons pushed at them
//   - say what the $1 is for, and what stays free
//   - the draft is safe whatever happens here
export function ListingFeeBody({
  listing,
  expiresAt,
  error,
  note,
  mode,
  freeSpots,
}: {
  listing: Listing
  expiresAt: Date
  error: string | null
  note?: string | null
  mode: CheckoutMode
  freeSpots: number
}) {
  const fee = formatCents(LISTING_FEE_CENTS)
  return (
    <div className="fee">
      <div className="fee-head">
        <p className="eyebrow">Last step</p>
        <h1 className="title">Publish for {fee}</h1>
        <p className="muted">
          {freeSpots > 0
            ? `Handoff’s first ${freeSpots} places went up free. From here it’s ${fee}, once, to keep listings real.`
            : `It’s ${fee}, once, to keep listings real.`}
        </p>
      </div>

      <div className="compact-row">
        <ListingPhoto listing={listing} className="compact-thumb" />
        <span className="manage-text">
          <span className="card-title">{listing.title || 'Your place'}</span>
          <span className="caption muted">
            {listing.rentCents ? `${formatRent(listing.rentCents)} / mo · ` : ''}
            {formatDates(listing.availableFrom, listing.availableTo)}
          </span>
        </span>
      </div>

      <div className="card fee-receipt" aria-label="What you pay">
        <div className="fee-line">
          <span>
            <span className="card-title">Listing fee</span>
            <span className="caption muted">Live until {dayFmt.format(expiresAt)}, or until it’s filled</span>
          </span>
          <span>{(LISTING_FEE_CENTS / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
        </div>
        <div className="fee-line fee-total">
          <span className="heading">Total today</span>
          <span className="price">{fee}</span>
        </div>
      </div>

      <ul className="fee-points" aria-label="What the fee covers">
        {[
          'Keeps fake listings and scams off Handoff',
          'One time. No subscription, no cut of your rent',
          'Editing, sharing and marking it filled stay free',
        ].map((t) => (
          <li key={t}>
            <Check size={16} strokeWidth={2} aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>

      {note && !error && (
        <p className="notice">
          <Info size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}

      {error && (
        <p className="form-error fee-error" role="alert">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {mode === 'test' ? (
        <p className="caption muted fee-secure">
          <FlaskConical size={12} strokeWidth={1.5} aria-hidden="true" /> Test mode: Stripe isn’t connected yet, so
          nothing is charged.
        </p>
      ) : (
        <p className="caption muted fee-secure">
          <Lock size={12} strokeWidth={1.5} aria-hidden="true" /> Paid securely through Stripe. Handoff never sees your
          card.
        </p>
      )}
      <p className="caption muted fee-secure">Not ready? Your draft is saved. Come back anytime.</p>
    </div>
  )
}

// Stands in for Stripe Checkout until it's wired up. Lets you try both the
// paid and the declined path. Never shown in prod (test mode is dev only).
export function TestCheckoutSheet({
  onPaid,
  onDeclined,
  onClose,
}: {
  onPaid: () => Promise<void>
  onDeclined: () => void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const fee = formatCents(LISTING_FEE_CENTS)

  async function pay() {
    setBusy(true)
    try {
      await new Promise((r) => setTimeout(r, 900)) // feels like a real round trip
      await onPaid()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Test checkout" onClose={onClose} busy={busy}>
      <p className="notice">
        <FlaskConical size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Stripe isn’t connected yet. No card is needed and nothing is charged.</span>
      </p>
      <div className="fee-line fee-total">
        <span className="heading">Handoff listing fee</span>
        <span className="price">{fee}</span>
      </div>
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={pay}>
        {busy ? 'Paying…' : `Pay ${fee} (test)`}
      </button>
      <button type="button" className="link-btn center-block fee-decline" disabled={busy} onClick={onDeclined}>
        Try a declined card
      </button>
    </Sheet>
  )
}

// /post/paid?order=…: where Stripe sends them back. Waits for the webhook to
// publish the listing, then goes straight to "You're live!".
export function ListingFeeResult() {
  const [params] = useSearchParams()
  const orderId = params.get('order')
  const navigate = useNavigate()
  const { rawUser, loading } = useAuth()
  const [order, setOrder] = useState<ListingOrder | null | undefined>()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (loading || !rawUser || !orderId) return
    const t = setTimeout(() => setSlow(true), 30_000)
    const stop = watchListingOrder(orderId, setOrder, () => setOrder(null))
    return () => {
      clearTimeout(t)
      stop()
    }
  }, [orderId, rawUser, loading])

  useEffect(() => {
    if (order?.status !== 'paid') return
    track('listing_fee_paid', {
      listing_id: order.listingId,
      value: order.amountCents / 100,
      currency: 'USD',
      store: 'stripe',
    })
    track('listing_published', { listing_id: order.listingId, listing_fee: true })
    setDraftPointer(null)
    clearListingsCache()
    navigate(`/post/live/${order.listingId}`, { replace: true })
  }, [order?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (order?.status === 'refunding' || order?.status === 'refunded')
    return (
      <div className="page empty boost-result">
        <CircleCheck size={48} strokeWidth={1.5} aria-hidden="true" className="ok-icon" />
        <p className="heading">Your place was already live.</p>
        <p className="muted">So we refunded the {formatCents(order.amountCents)}. It can take a few days to show up.</p>
        <Link to="/me/listings" className="btn btn-primary">
          Your listings
        </Link>
      </div>
    )

  if (order && (order.status === 'failed' || order.status === 'expired'))
    return (
      <div className="page empty boost-result">
        <CircleAlert size={48} strokeWidth={1.5} aria-hidden="true" />
        <p className="heading">That payment didn’t go through.</p>
        <p className="muted">No charge was made. Your draft is saved.</p>
        <Link to="/post?checkout=1" className="btn btn-primary">
          Try again
        </Link>
      </div>
    )

  return (
    <div className="page empty boost-result" aria-live="polite">
      {slow ? (
        <>
          <p className="heading">Payment received. Your place goes live within a minute.</p>
          <p className="muted">We’ll email you when it’s up.</p>
          <Link to="/me/listings" className="btn btn-secondary">
            Your listings
          </Link>
        </>
      ) : (
        <>
          <span className="spinner" aria-hidden="true" />
          <p className="heading">Publishing your place…</p>
          <p className="muted">Confirming your payment with Stripe.</p>
        </>
      )}
    </div>
  )
}
