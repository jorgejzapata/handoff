import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Heart, ImageIcon } from 'lucide-react'
import { useSaved } from '../components/SavedProvider'
import { ListingCard } from '../components/ListingCard'
import { fetchListing, isPastExpiry } from '../lib/listings'
import type { Listing } from '../lib/listings'
import type { SavedEntry } from '../lib/saved'
import { formatDates, formatRent } from '../lib/format'

// Saved: places a seeker is weighing, newest first. Places that were filled,
// expired or taken down drop to the bottom under "No longer available".
export default function Saved() {
  const { saved, error, remove } = useSaved()
  // listingId -> the live listing, or null when it's gone.
  const [live, setLive] = useState<Record<string, Listing | null>>({})

  useEffect(() => {
    if (!saved) return
    const missing = saved.filter((s) => !(s.listingId in live))
    if (missing.length === 0) return
    let on = true
    Promise.all(
      missing.map((s) =>
        fetchListing(s.listingId)
          .then((l) => [s.listingId, l && l.status === 'active' && !isPastExpiry(l) ? l : null] as const)
          // Not readable any more means it isn't live.
          .catch(() => [s.listingId, null] as const),
      ),
    ).then((pairs) => on && setLive((m) => ({ ...m, ...Object.fromEntries(pairs) })))
    return () => {
      on = false
    }
  }, [saved, live])

  const { available, gone, checking } = useMemo(() => {
    const available: Listing[] = []
    const gone: SavedEntry[] = []
    let checking = false
    for (const s of saved ?? []) {
      if (!(s.listingId in live)) checking = true
      else if (live[s.listingId]) available.push(live[s.listingId]!)
      else gone.push(s)
    }
    return { available, gone, checking }
  }, [saved, live])

  const count = saved?.length ?? 0

  return (
    <div className="page saved">
      <h1 className="title">
        Saved{count > 0 && <span className="title-count"> {count}</span>}
      </h1>

      {error ? (
        <div className="empty">
          <p className="heading">Something broke on our end.</p>
          <p className="muted">Try again in a minute.</p>
        </div>
      ) : saved === null || (checking && available.length === 0 && gone.length === 0) ? (
        <div className="results-grid" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : count === 0 ? (
        <div className="empty">
          <Heart size={48} strokeWidth={1.5} aria-hidden="true" />
          <p className="heading">Tap the heart on any place to keep it here.</p>
          <Link to="/listings" className="btn btn-secondary">
            Browse places
          </Link>
        </div>
      ) : (
        <>
          {available.length > 0 && (
            <div className="results-grid">
              {available.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}

          {gone.length > 0 && (
            <section aria-labelledby="gone-heading" className="saved-gone">
              <h2 id="gone-heading" className="divider-label">
                No longer available
              </h2>
              <ul className="manage-list">
                {gone.map((s) => (
                  <li key={s.listingId} className="manage-card gone-card">
                    <div className="manage-main">
                      {s.thumbUrl ? (
                        <img className="photo photo-img manage-thumb" src={s.thumbUrl} alt="" loading="lazy" />
                      ) : (
                        <div className="photo manage-thumb" aria-hidden="true">
                          <ImageIcon size={20} strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="gone-text">
                        <p className="card-title">{s.title || 'A place near CSU'}</p>
                        <p className="muted">
                          {formatRent(s.rentCents)} / mo
                          {s.availableFrom && s.availableTo && ` · ${formatDates(s.availableFrom, s.availableTo)}`}
                        </p>
                        <button type="button" className="link-btn" onClick={() => void remove(s.listingId)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
