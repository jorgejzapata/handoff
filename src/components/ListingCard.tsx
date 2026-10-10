import { Link } from 'react-router'
import { Heart, ImageIcon } from 'lucide-react'
import type { Listing } from '../data/sampleListings'
import { formatDates, formatRent, typeLine } from '../data/sampleListings'
import { useSignUp } from './SignUpSheet'

// Stands in for listing photos until uploads exist.
export function PhotoPlaceholder({ tone, label, className = '' }: { tone: string; label: string; className?: string }) {
  return (
    <div className={`photo ${className}`} style={{ background: tone }} role="img" aria-label={label}>
      <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
    </div>
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

export function SaveButton({ floating = false }: { floating?: boolean }) {
  const { open } = useSignUp()
  return (
    <button
      type="button"
      className={floating ? 'float-btn' : 'icon-btn'}
      aria-label="Save"
      onClick={(e) => {
        e.preventDefault()
        open({ reason: 'save' })
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
        <PhotoPlaceholder tone={listing.photoTone} label={`Photo of ${listing.title}`} />
        {listing.boosted && (
          <div className="photo-tl">
            <BoostedTag />
          </div>
        )}
        <div className="photo-tr">
          <SaveButton floating />
        </div>
      </div>
      <div className="listing-card-body">
        <p className="price">
          {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
        </p>
        <p className="card-title">{listing.title}</p>
        <p>{typeLine(listing)}</p>
        <p>{formatDates(listing.availableFrom, listing.availableTo)}</p>
        {note && <p className="caption muted">{note}</p>}
        <p className="muted">{listing.distanceToCampusMi} mi to campus</p>
      </div>
    </Link>
  )
}
