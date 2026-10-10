import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Share } from 'lucide-react'
import { SaveButton } from '../components/ListingCard'
import { ListerCard, ListingView } from '../components/ListingView'
import { useAuth } from '../components/AuthProvider'
import { useSignUp } from '../components/SignUpSheet'
import { useToast } from '../components/Toast'
import { fetchListing } from '../lib/listings'
import type { Listing } from '../lib/listings'
import { formatDates, formatRent, formatShortDate } from '../lib/format'

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { open } = useSignUp()
  const { rawUser } = useAuth()
  const toast = useToast()
  const [listing, setListing] = useState<Listing | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setListing(undefined)
    if (id) fetchListing(id).then((l) => alive && setListing(l))
    return () => {
      alive = false
    }
  }, [id, rawUser?.uid])

  if (listing === undefined) return <div className="detail detail-loading" aria-busy="true" />

  if (!listing || !['active', 'filled', 'expired'].includes(listing.status) && listing.ownerId !== rawUser?.uid) {
    return (
      <div className="page empty">
        <p className="heading">This listing isn't available</p>
        <Link to="/listings" className="btn btn-secondary">
          Browse places
        </Link>
      </div>
    )
  }

  const name = listing.lister.firstName
  const isOwn = !!rawUser && rawUser.uid === listing.ownerId
  const closed = listing.status === 'filled' || listing.status === 'expired'
  const sayHi = () => open({ reason: 'say-hi', listerName: name })

  async function share() {
    const url = `${window.location.origin}/listings/${listing!.id}`
    const text = `${formatRent(listing!.rentCents)} / mo · ${listing!.title} · ${formatDates(listing!.availableFrom, listing!.availableTo)}`
    try {
      if (navigator.share) await navigator.share({ title: listing!.title, text, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied')
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  const action = closed ? (
    <Link to="/listings" className="btn btn-secondary">
      See similar places
    </Link>
  ) : isOwn ? (
    <Link to="/me" className="btn btn-secondary">
      Manage
    </Link>
  ) : (
    <button type="button" className="btn btn-accent" onClick={sayHi}>
      Say hi to {name}
    </button>
  )

  return (
    <div className="detail">
      {isOwn && <p className="own-banner">This is your listing, as seekers see it.</p>}
      {closed && (
        <p className="own-banner">{listing.status === 'filled' ? 'This place was filled' : 'This listing expired'}</p>
      )}
      <ListingView
        listing={listing}
        galleryOverlay={
          <div className="gallery-bar">
            <button type="button" className="float-btn" aria-label="Back" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} strokeWidth={1.5} />
            </button>
            <div className="row-8">
              <button type="button" className="float-btn" aria-label="Share" onClick={share}>
                <Share size={20} strokeWidth={1.5} />
              </button>
              <SaveButton floating />
            </div>
          </div>
        }
        aside={
          <div className="card sticky-card">
            <p className="price">
              {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
            </p>
            <p className="row-8">
              {formatDates(listing.availableFrom, listing.availableTo, true)}
              {listing.datesFlexible && <span className="chip chip-static">Flexible</span>}
            </p>
            <ListerCard lister={listing.lister} />
            {action}
          </div>
        }
        footer={
          <footer className="detail-foot">
            <p className="caption muted">
              Posted {formatShortDate(listing.postedAt)}
              {listing.updatedAt.slice(0, 10) !== listing.postedAt.slice(0, 10) &&
                ` · Updated ${formatShortDate(listing.updatedAt)}`}
            </p>
            {!isOwn && (
              <button type="button" className="link-btn caption" onClick={() => open({ reason: 'login' })}>
                Report this listing
              </button>
            )}
          </footer>
        }
      />

      <div className="sticky-bar mobile-only">
        <p className="price">
          {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
        </p>
        {action}
      </div>
    </div>
  )
}
