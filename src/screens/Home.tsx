import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CalendarDays, DollarSign, MessageCircle, PencilLine, ShieldCheck, Handshake } from 'lucide-react'
import { ListingCard } from '../components/ListingCard'
import { Footer } from '../components/Shell'
import { useActiveListings } from '../lib/useListings'
import { useAuth } from '../components/AuthProvider'

type PlaceType = 'any' | 'room' | 'whole'

export default function Home() {
  const navigate = useNavigate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [max, setMax] = useState('')
  const [type, setType] = useState<PlaceType>('any')

  const { listings } = useActiveListings()
  const { rawUser } = useAuth()
  const newest = (listings ?? []).slice(0, 8)
  const mine = rawUser ? (listings ?? []).find((l) => l.ownerId === rawUser.uid) : undefined

  function findPlace(e: React.FormEvent) {
    e.preventDefault()
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
          <p className="eyebrow">Subleases near CSU</p>
          <h1 className="display">A little less rent. A lot more possibility.</h1>
          <p className="lead">Find a room for a semester, or hand off your lease to another Ram.</p>
        </section>

        <form className="card search-card" onSubmit={findPlace} aria-label="Find a place">
          <div className="field">
            <span className="label" id="dates-label">
              Dates
            </span>
            <div className="date-pair" role="group" aria-labelledby="dates-label">
              <label className="input-icon">
                <CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only">Move in</span>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="input-icon">
                <CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only">Move out</span>
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
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
        <Link to={`/listings/${mine.id}`} className="mine-row">
          <span className="caption muted">Your place</span>
          <span className="card-title">{mine.title}</span>
        </Link>
      )}

      <section className="lister-card">
        <h2 className="heading">Leaving for the summer or a semester?</h2>
        <p>Posting is free and takes about 5 minutes.</p>
        <Link to="/post" className="btn btn-secondary">
          Post your place
        </Link>
      </section>

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
                <span className="heading">Be one of the first to post at CSU</span>
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
          <li>
            <PencilLine size={24} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <p className="how-title">Post for free</p>
              <p className="muted">Rooms and whole-place lease takeovers, in about 5 minutes.</p>
            </div>
          </li>
          <li>
            <MessageCircle size={24} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <p className="how-title">Chat with verified Rams</p>
              <p className="muted">Only students with a CSU email can message you.</p>
            </div>
          </li>
          <li>
            <Handshake size={24} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <p className="how-title">Hand it off</p>
              <p className="muted">Sort out the lease with your landlord, then mark it filled.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="notice">
        <ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <p className="notice-title">Only verified CSU students can message listers.</p>
          <p className="caption muted">Email verification does not verify the property or lease.</p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
