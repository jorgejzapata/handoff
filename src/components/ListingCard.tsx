import { maskBlockedLanguage } from '../lib/moderation'
import { Link } from 'react-router'
import { Heart, ImageIcon } from 'lucide-react'
import type { Listing } from '../lib/listings'
import { distanceLabel, formatDates, formatRent, typeLine } from '../lib/format'
import { useSignUp } from './SignUpSheet'
import { useAuth } from './AuthProvider'
import { useSaved } from './SavedProvider'
import { isOpenToAnyone, openToLabel } from '../lib/gender'

export function ListingPhoto({ listing, className = '' }: { listing: Listing; className?: string }) {
  const photo = listing.photos[0]
  if (!photo) {
    return (
      <div className={`photo ${className}`} role="img" aria-label="No photo yet">
        <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      className={`photo photo-img ${className}`}
      src={photo.url}
      alt={`Photo of ${listing.title}`}
      width={photo.width}
      height={photo.height}
      loading="lazy"
    />
  )
}

export function BoostedTag() {
  return (
    <span className="boosted-tag">
      <span className="lime-dot" aria-hidden="true" />
      Boosted
    </span>
  )
}

export function SaveButton({ listing, floating = false }: { listing: Listing; floating?: boolean }) {
  const { open } = useSignUp()
  const { user, member } = useAuth()
  const { isSaved, toggle } = useSaved()
  if (user && listing.ownerId === user.uid) return null // your own place
  const on = member && isSaved(listing.id)
  return (
    <button
      type="button"
      className={`${floating ? 'float-btn' : 'icon-btn'} save-btn`}
      aria-label={on ? 'Remove from Saved' : 'Save'}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!member) open({ reason: 'save', listingId: listing.id })
        else void toggle(listing)
      }}
    >
      <Heart size={20} strokeWidth={1.5} />
    </button>
  )
}

export function ListingCard({ listing, note }: { listing: Listing; note?: string }) {
  return (
    <Link to={`/listings/${listing.id}`} className="listing-card">
      <div className="listing-card-photo">
        <ListingPhoto listing={listing} />
        {listing.boosted && (
          <div className="photo-tl">
            <BoostedTag />
          </div>
        )}
        <div className="photo-tr">
          <SaveButton listing={listing} floating />
        </div>
      </div>
      <div className="listing-card-body">
        <p className="price">
          {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
        </p>
        <p className="card-title">{maskBlockedLanguage(listing.title)}</p>
        <p>{typeLine(listing)}</p>
        <p>{formatDates(listing.availableFrom, listing.availableTo)}</p>
        {!isOpenToAnyone(listing.openTo) && <p className="open-to-tag">{openToLabel(listing.openTo)}</p>}
        {note && <p className="caption muted">{note}</p>}
        <p className="muted">{distanceLabel(listing.distanceToCampusMi)}</p>
      </div>
    </Link>
  )
}
