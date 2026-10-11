import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Check, CircleAlert, CircleCheck, Lock, Zap } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'
import { ListingPhoto } from '../components/ListingCard'
import { fetchListing } from '../lib/listings'
import type { Listing } from '../lib/listings'
import { isVerifiedStudent } from '../lib/auth'
import { boostsUnlocked, useListingStats } from '../lib/pricing'
import { TIERS, endDateFor, formatCents, priceFor, startBoostCheckout, watchOrder } from '../lib/boosts'
import type { BoostOrder, Tier } from '../lib/boosts'
import { formatDates, formatRent } from '../lib/format'
import { track } from '../lib/track'

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

// /me/listings/:id/boost: one clear choice, honestly priced.
export default function Boost() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null | undefined>()
  const [tier, setTier] = useState<Tier>('30d')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stats = useListingStats()
  const student = isVerifiedStudent(user)

  useEffect(() => {
    if (!id) return
    fetchListing(id)
      .then((l) => setListing(l && l.ownerId === user?.uid ? l : null))
      .catch(() => setListing(null))
  }, [id, user?.uid])

  useEffect(() => {
    if (listing) track('boost_viewed', { listing_id: listing.id, already_boosted: listing.boosted })
  }, [listing])

  if (listing === undefined || stats === null) return <div className="page" aria-busy="true" />

  const unlocked = boostsUnlocked(stats)
  if (!listing || listing.status !== 'active' || !unlocked)
    return (
      <div className="page empty">
        <p className="heading">{!listing ? "This listing isn't available" : 'Boosts aren’t available for this listing'}</p>
        <Link to="/me/listings" className="btn btn-secondary">
          Back to your listings
        </Link>
      </div>
    )

  async function pay() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await startBoostCheckout(listing!.id, tier, priceFor(tier, student))
      window.location.assign(url)
    } catch (e) {
      const msg = (e as { message?: string }).message
      track('boost_failed', { listing_id: listing!.id, tier, step: 'checkout_create' })
      setError(msg && !msg.includes('internal') ? msg : 'Something broke on our end. Try again in a minute.')
      setBusy(false)
    }
  }

  return (
    <div className="page boost">
      <button type="button" className="link-btn back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} strokeWidth={1.5} aria-hidden="true" />
        Your listings
      </button>
      <h1 className="title">{listing.boosted ? 'Extend your boost' : 'Boost your listing'}</h1>
      <p className="muted">Boosted places show first in Browse with a Boosted tag.</p>

      <div className="compact-row">
        <ListingPhoto listing={listing} className="compact-thumb" />
        <span className="manage-text">
          <span className="card-title">{listing.title}</span>
          <span className="caption muted">
            {formatRent(listing.rentCents)} / mo · {formatDates(listing.availableFrom, listing.availableTo)}
          </span>
          {listing.boostedUntil && (
            <span className="caption boosted-line">
              <span className="lime-dot" aria-hidden="true" />
              Boosted until {dayFmt.format(new Date(listing.boostedUntil))}
            </span>
          )}
        </span>
      </div>

      <div className="choice-list" role="radiogroup" aria-label="Boost length">
        {(['7d', '30d'] as Tier[]).map((t) => {
          const on = tier === t
          const price = priceFor(t, student)
          const ends = dayFmt.format(endDateFor(t, listing.boostedUntil))
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? 'choice boost-choice choice-on' : 'choice boost-choice'}
              onClick={() => setTier(t)}
            >
              <span className="choice-text">
                <span className="heading">
                  {listing.boosted ? `Add ${TIERS[t].label}` : TIERS[t].label}
                  {t === '30d' && <span className="best-tag">Best value</span>}
                </span>
                <span className="caption muted">Ends {ends}</span>
              </span>
              <span className="boost-price">
                {student && <s className="caption muted">{formatCents(TIERS[t].cents)}</s>}
                <span className="price">{formatCents(price)}</span>
              </span>
              <span className={on ? 'choice-check choice-check-on' : 'choice-check'} aria-hidden="true">
                {on && <Check size={14} strokeWidth={2.5} />}
              </span>
            </button>
          )
        })}
      </div>

      {student ? (
        <p className="notice">
          <CircleCheck size={18} strokeWidth={1.5} aria-hidden="true" />
          Verified student price: 20% off.
        </p>
      ) : (
        <p className="caption muted">
          Verify a .edu email in Account settings to get 20% off boosts.
        </p>
      )}

      <p className="caption muted">A boost gets more eyes on your place. It can’t guarantee messages.</p>

      {error && (
        <p className="form-error" role="alert">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" /> {error}
        </p>
      )}

      <button type="button" className="btn btn-accent btn-block" disabled={busy} onClick={pay}>
        <Zap size={18} strokeWidth={1.5} aria-hidden="true" />
        {busy ? 'Opening checkout…' : `Continue to payment · ${formatCents(priceFor(tier, student))}`}
      </button>
      <p className="caption muted center">
        <Lock size={12} strokeWidth={1.5} aria-hidden="true" /> Paid securely through Stripe. Handoff never sees your card.
      </p>
    </div>
  )
}

// /boost/success?order=… and /boost/cancel?listing=…
export function BoostResult({ cancelled = false }: { cancelled?: boolean }) {
  const [params] = useSearchParams()
  const orderId = params.get('order')
  const listingId = params.get('listing')
  const [order, setOrder] = useState<BoostOrder | null | undefined>()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (cancelled || !orderId) return
    const t = setTimeout(() => setSlow(true), 30_000)
    const stop = watchOrder(orderId, setOrder, () => setOrder(null))
    return () => {
      clearTimeout(t)
      stop()
    }
  }, [orderId, cancelled])

  useEffect(() => {
    if (order?.status === 'paid')
      track('boost_purchased', {
        listing_id: order.listingId,
        tier: order.tier,
        value: order.amountCents / 100,
        currency: 'USD',
        store: 'stripe',
      })
  }, [order?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cancelled)
    return (
      <div className="page empty boost-result">
        <CircleAlert size={48} strokeWidth={1.5} aria-hidden="true" />
        <p className="heading">No charge was made.</p>
        <div className="confirm-actions">
          <Link to="/me/listings" className="btn btn-secondary">
            Back to your listings
          </Link>
          {listingId && (
            <Link to={`/me/listings/${listingId}/boost`} className="btn btn-primary">
              Try again
            </Link>
          )}
        </div>
      </div>
    )

  if (order?.status === 'paid')
    return (
      <div className="page empty boost-result">
        <CircleCheck size={48} strokeWidth={1.5} aria-hidden="true" className="ok-icon" />
        <p className="title">You’re boosted!</p>
        <p className="muted">
          Your place shows first in Browse{order.endsAt ? ` until ${dayFmt.format(order.endsAt)}` : ''}.
        </p>
        <Link to="/me/listings" className="btn btn-primary">
          Back to your listings
        </Link>
        <Link to="/listings" className="link-btn">
          See it in Browse
        </Link>
      </div>
    )

  if (order && order.status !== 'pending')
    return (
      <div className="page empty boost-result">
        <CircleAlert size={48} strokeWidth={1.5} aria-hidden="true" />
        <p className="heading">That payment didn’t go through.</p>
        <p className="muted">No boost was added. You can try again.</p>
        <Link to={`/me/listings/${order.listingId}/boost`} className="btn btn-primary">
          Try again
        </Link>
      </div>
    )

  return (
    <div className="page empty boost-result" aria-live="polite">
      {slow ? (
        <>
          <p className="heading">Payment received. Your boost starts within a minute.</p>
          <Link to="/me/listings" className="btn btn-secondary">
            Back to your listings
          </Link>
        </>
      ) : (
        <>
          <span className="spinner" aria-hidden="true" />
          <p className="heading">Confirming your payment…</p>
        </>
      )}
    </div>
  )
}
