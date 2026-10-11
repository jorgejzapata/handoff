import { Check, CircleAlert, FlaskConical, Lock } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { ListingPhoto } from '../../components/ListingCard'
import type { Listing } from '../../lib/listings'
import { formatCents } from '../../lib/boosts'
import { FREE_LISTINGS, LISTING_CHECKOUT, LISTING_FEE_CENTS } from '../../lib/pricing'
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
}: {
  listing: Listing
  expiresAt: Date
  error: string | null
}) {
  const fee = formatCents(LISTING_FEE_CENTS)
  return (
    <div className="fee">
      <div className="fee-head">
        <p className="eyebrow">Last step</p>
        <h1 className="title">Publish for {fee}</h1>
        <p className="muted">
          Handoff’s first {FREE_LISTINGS} places went up free. From here it’s {fee}, once, to keep listings real.
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

      {error && (
        <p className="form-error fee-error" role="alert">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {LISTING_CHECKOUT === 'test' ? (
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
// paid and the declined path. Never shown in prod (LISTING_CHECKOUT is 'off').
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
