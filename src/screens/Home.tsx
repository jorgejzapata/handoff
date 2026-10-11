import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Check, ChevronRight, DollarSign, Handshake, KeyRound, MessageCircle, PencilLine, ShieldCheck } from 'lucide-react'
import { ListingCard } from '../components/ListingCard'
import { DateInput } from '../components/DateInput'
import { readLastSearch, saveLastSearch } from '../lib/lastSearch'
import { Footer } from '../components/Shell'
import { useActiveListings } from '../lib/useListings'
import { useAuth } from '../components/AuthProvider'
import { maskBlockedLanguage } from '../lib/moderation'
import { FREE_LISTINGS, freeSpotsLeft, listingFeeApplies, useListingStats } from '../lib/pricing'
import type { ListingStats } from '../lib/pricing'

type PlaceType = 'any' | 'room' | 'whole'

export default function Home() {
  const navigate = useNavigate()
  // If a listing link's preview page ever falls back, it lands here with ?listing=id.
  const [params] = useSearchParams()
  const fallbackListing = params.get('listing')
  useEffect(() => {
    if (fallbackListing && /^[A-Za-z0-9_-]{1,64}$/.test(fallbackListing))
      navigate(`/listings/${fallbackListing}`, { replace: true })
  }, [fallbackListing, navigate])
  // Returning visitors get their last search back.
  const [last] = useState(readLastSearch)
  const [from, setFrom] = useState(last.from ?? '')
  const [to, setTo] = useState(last.to ?? '')
  const [max, setMax] = useState(last.max ?? '')
  const [type, setType] = useState<PlaceType>((last.type as PlaceType) ?? 'any')

  const { listings, loading } = useActiveListings()
  const { rawUser } = useAuth()
  const stats = useListingStats()
  const feeOn = listingFeeApplies(stats)
  const newest = (listings ?? []).slice(0, 8)
  const mine = rawUser ? (listings ?? []).find((l) => l.ownerId === rawUser.uid) : undefined

  function findPlace(e: React.FormEvent) {
    e.preventDefault()
    saveLastSearch({ from, to, max, type })
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (max) params.set('max', max)
    if (type !== 'any') params.set('type', type)
    navigate(`/listings${params.size ? `?${params}` : ''}`)
  }

  return (
    <div className="page home">
      <div className="home-top">
        <section className="hero">
          <p className="eyebrow">Subleases near campus</p>
          <h1 className="display hero-title">
            <span>A little less rent.</span> <span>A lot more possibility.</span>
          </h1>
          <p className="lead">Find a room for a semester, or hand off your lease to another student.</p>
          <ul className="hero-points" aria-label="Why Handoff">
            {[feeOn ? 'Free to browse' : 'Free to post', 'Sign up in seconds', 'No fees to message'].map((t) => (
              <li key={t}>
                <Check size={16} strokeWidth={2} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <form className="card search-card" onSubmit={findPlace} aria-label="Find a place">
          <div className="field">
            <span className="label" id="dates-label">
              Dates
            </span>
            <div className="date-pair" role="group" aria-labelledby="dates-label">
              <DateInput label="Move in" value={from} onChange={setFrom} />
              <DateInput label="Move out" value={to} min={from || undefined} onChange={setTo} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="budget" className="label">
              Budget
            </label>
            <div className="input-icon">
              <DollarSign size={18} strokeWidth={1.5} aria-hidden="true" />
              <input
                id="budget"
                className="input"
                inputMode="numeric"
                placeholder="Up to $ / mo"
                value={max}
                onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Type of place">
            {(
              [
                ['any', 'Any'],
                ['room', 'Room'],
                ['whole', 'Whole place'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                className={type === value ? 'seg seg-on' : 'seg'}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-accent btn-block">
            Find a place
          </button>
        </form>
      </div>

      {mine && (
        <Link to="/me/listings" className="mine-row">
          <span className="mine-text">
            <span className="caption muted">Your place{mine.neighborhood ? ` in ${mine.neighborhood}` : ''}</span>
            <span className="card-title">{maskBlockedLanguage(mine.title)}</span>
          </span>
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      )}

      <section className="lister-card" aria-labelledby="lister-heading">
        <span className="lister-icon" aria-hidden="true">
          <KeyRound size={22} strokeWidth={1.5} />
        </span>
        <div className="lister-text">
          <h2 className="heading" id="lister-heading">
            Leaving for the summer or a semester?
          </h2>
          <p>Hand off your lease to another student. It takes about 5 minutes.</p>
          <PostingPrice stats={stats} />
        </div>
        <Link to="/post" className="btn btn-secondary">
          Post your place
          <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
        </Link>
      </section>

      {loading && (
        <section className="section" aria-busy="true" aria-label="Loading listings">
          <div className="section-head">
            <h2 className="heading">Just posted</h2>
          </div>
          <div className="strip">
            {[0, 1, 2, 3].map((i) => (
              <div className="strip-item" key={i}>
                <div className="skeleton-card" />
              </div>
            ))}
          </div>
        </section>
      )}

      {newest.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="heading">Just posted</h2>
            <Link to="/listings?sort=newest" className="text-link">
              See all
            </Link>
          </div>
          <div className="strip">
            {newest.map((l) => (
              <div className="strip-item" key={l.id}>
                <ListingCard listing={l} />
              </div>
            ))}
            {newest.length < 4 && (
              <div className="strip-item">
                <Link to="/post" className="first-card">
                  <span className="heading">Be one of the first to post</span>
                  <span className="muted">It’s free and takes about 5 minutes.</span>
                  <span className="btn btn-secondary btn-sm">Post your place</span>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="heading">How it works</h2>
        <ol className="how">
          {(
            [
              [PencilLine, feeOn ? 'Post your place' : 'Post for free', 'Rooms and whole-place lease takeovers, in about 5 minutes.'],
              [MessageCircle, 'Chat right in Handoff', 'Message listers without sharing your number. Look for the Verified student badge.'],
              [Handshake, 'Hand it off', 'Sort out the lease with your landlord, then mark it filled.'],
            ] as const
          ).map(([Icon, title, body], i) => (
            <li key={title}>
              <span className="how-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.5} />
                <span className="how-num">{i + 1}</span>
              </span>
              <div>
                <p className="how-title">{title}</p>
                <p className="muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="notice">
        <ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <p className="notice-title">See the place before you send money.</p>
          <p className="caption muted">The Verified student badge confirms a school email, not the property or lease.</p>
        </div>
      </section>

      <Footer />
    </div>
  )
}

// The price, stated before anyone starts the form. While free spots last it
// doubles as the launch hook; after that it's one plain line.
function PostingPrice({ stats }: { stats: ListingStats | null }) {
  const fee = listingFeeApplies(stats)
  const total = stats?.free ?? FREE_LISTINGS
  const left = stats ? freeSpotsLeft(stats) : total
  const used = total - left

  if (fee)
    return (
      <p className="lister-price caption">
        <span>
          <strong>$1 to post</strong>, one time. Browsing and messaging are always free.{' '}
          <Link to="/pricing" className="text-link">
            Pricing
          </Link>
        </span>
      </p>
    )

  if (stats && left === 0)
    return (
      <p className="lister-price caption">
        <span>
          <strong>Free to post</strong> right now.{' '}
          <Link to="/pricing" className="text-link">
            Pricing
          </Link>
        </span>
      </p>
    )

  return (
    <div className="lister-price">
      {stats && used >= 5 ? (
        <div className="free-spots">
          <div className="free-spots-text">
            <span>Free for the first {total} places</span>
            <span>{left} left</span>
          </div>
          <div className="progress" role="progressbar" aria-label="Free spots used" aria-valuemin={0} aria-valuemax={total} aria-valuenow={used}>
            <div className="progress-fill" style={{ width: `${total ? (used / total) * 100 : 100}%` }} />
          </div>
        </div>
      ) : (
        <p className="caption">
          <strong>The first {total} places post free.</strong>
        </p>
      )}
      <p className="caption muted">
        After that it’s $1, one time.{' '}
        <Link to="/pricing" className="text-link">
          Pricing
        </Link>
      </p>
    </div>
  )
}
