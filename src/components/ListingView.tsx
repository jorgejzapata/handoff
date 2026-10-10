import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Bath, BedDouble, BadgeCheck, CircleCheck, CircleHelp, Clock, ImageIcon, Info, Sofa, Users, Zap } from 'lucide-react'
import type { Listing } from '../lib/listings'
import { householdLabel, openToLabel } from '../lib/gender'
import { AREA_RADIUS_M, LazyMap } from './map/LazyMap'
import {
  distanceLabel,
  eyebrowLabel,
  formatDates,
  formatRent,
  formatShortDate,
  landlordLine,
} from '../lib/format'

const LANDLORD_ICON = { allowed: CircleCheck, needsApproval: Clock, notSure: CircleHelp }

// Everything below the top bar on a listing page. Used live (Listing detail)
// and in the Post wizard's preview, where each section gets an Edit link.
export function ListingView({
  listing,
  galleryOverlay,
  aside,
  onEdit,
  footer,
}: {
  listing: Listing
  galleryOverlay?: ReactNode
  aside?: ReactNode
  onEdit?: (step: number) => void
  footer?: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const name = listing.lister.firstName
  const LandlordIcon = LANDLORD_ICON[listing.landlordStatus]
  const utilities = listing.utilitiesIncluded
    ? 'Included'
    : listing.utilitiesEstimateCents
      ? `About ${formatRent(listing.utilitiesEstimateCents)} / mo`
      : 'Not included'

  const edit = (step: number) =>
    onEdit && (
      <button type="button" className="link-btn edit-link" onClick={() => onEdit(step)}>
        Edit
      </button>
    )

  return (
    <>
      <div className="gallery-wrap">
        <Gallery photos={listing.photos} title={listing.title} />
        {galleryOverlay}
        {onEdit && <div className="gallery-edit">{edit(3)}</div>}
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-block">
            <div className="block-head">
              <p className="eyebrow">{eyebrowLabel(listing)}</p>
              {edit(0)}
            </div>
            <h1 className="title">{listing.title || 'Your title'}</h1>
            <p className="muted">
              Near {listing.neighborhood} · {distanceLabel(listing.distanceToCampusMi)}
            </p>
          </section>

          <section className={aside ? 'detail-block mobile-only' : 'detail-block'}>
            <div className="block-head">
              <p className="price">
                {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
              </p>
              {edit(1)}
            </div>
            <p className="row-8">
              {formatDates(listing.availableFrom, listing.availableTo, true)}
              {listing.datesFlexible && <span className="chip chip-static">Flexible</span>}
            </p>
          </section>

          <section className="tiles" aria-label="Quick facts">
            <Tile
              icon={<BedDouble size={20} strokeWidth={1.5} />}
              label="Bedrooms"
              value={listing.bedrooms === 0 ? 'Studio' : String(listing.bedrooms)}
            />
            <Tile
              icon={<Bath size={20} strokeWidth={1.5} />}
              label="Bathrooms"
              value={`${listing.bathrooms}${listing.privateBath && listing.listingType === 'room' ? ' · private' : ''}`}
            />
            <Tile icon={<Sofa size={20} strokeWidth={1.5} />} label="Furnished" value={listing.furnished ? 'Yes' : 'No'} />
            <Tile icon={<Zap size={20} strokeWidth={1.5} />} label="Utilities" value={utilities} />
          </section>

          <section className={aside ? 'lister mobile-only' : 'lister'}>
            <ListerCard lister={listing.lister} />
          </section>

          <section className="detail-block">
            <div className="block-head">
              <h2 className="heading">About this place</h2>
              {edit(2)}
            </div>
            <p className={expanded ? 'prewrap' : 'prewrap clamp-6'}>{listing.description || 'Your description'}</p>
            {listing.description.length > 280 && (
              <button type="button" className="link-btn" onClick={() => setExpanded((e) => !e)}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </section>

          <section className="detail-block">
            <h2 className="heading">Details</h2>
            {listing.listingType === 'room' && (
              <>
                <p>{householdLabel(listing.roommateCount, listing.householdGenders)}</p>
                <p className="open-to-line">
                  <Users size={18} strokeWidth={1.5} aria-hidden="true" />
                  {openToLabel(listing.openTo)}
                </p>
              </>
            )}
            {listing.amenities.length > 0 && (
              <div className="chips-wrap">
                {listing.amenities.map((a) => (
                  <span key={a} className="chip chip-static">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {listing.depositNote && <p>Deposit: {listing.depositNote}</p>}
            <div className="block-head">
              <p className="landlord-line">
                <LandlordIcon size={18} strokeWidth={1.5} aria-hidden="true" />
                {landlordLine[listing.landlordStatus]}
              </p>
              {edit(5)}
            </div>
          </section>

          <section className="detail-block">
            <div className="block-head">
              <h2 className="heading">Location</h2>
              {edit(4)}
            </div>
            {listing.approxLat !== undefined && listing.approxLng !== undefined ? (
              <LazyMap
                className="map-detail"
                label={`Map of the approximate area near ${listing.neighborhood}`}
                circle={{ lat: listing.approxLat, lng: listing.approxLng, radiusM: AREA_RADIUS_M }}
                zoom={14}
              />
            ) : (
              <div className="map" role="img" aria-label={`Approximate area near ${listing.neighborhood}`}>
                <div className="map-circle" />
              </div>
            )}
            <p className="muted">{name} shares the exact address in chat.</p>
          </section>

          <section className="notice">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <p>
                Handoff doesn't handle rent or deposits. Check the lease and get the landlord's OK before you commit.
              </p>
              <p className="caption muted">Email verification does not verify the property or lease.</p>
              <Link to="/safety" className="text-link caption">
                Safety tips
              </Link>
            </div>
          </section>

          {footer ?? (
            <footer className="detail-foot">
              <p className="caption muted">
                Posted {formatShortDate(listing.postedAt)}
                {listing.updatedAt.slice(0, 10) !== listing.postedAt.slice(0, 10) &&
                  ` · Updated ${formatShortDate(listing.updatedAt)}`}
              </p>
            </footer>
          )}
        </div>

        {aside && <aside className="detail-aside desktop-only">{aside}</aside>}
      </div>
    </>
  )
}

function Gallery({ photos, title }: { photos: Listing['photos']; title: string }) {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)

  if (!photos.length) {
    return (
      <div className="gallery">
        <div className="photo gallery-photo" role="img" aria-label="No photos yet">
          <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
        </div>
      </div>
    )
  }

  return (
    <div className="gallery">
      <div
        className="gallery-track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {photos.map((p, i) => (
          <img
            key={p.id}
            src={p.url}
            alt={`${title}, photo ${i + 1} of ${photos.length}`}
            className="gallery-img"
            width={p.width}
            height={p.height}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>
      {photos.length > 1 && (
        <span className="gallery-count">
          {index + 1} / {photos.length}
        </span>
      )}
    </div>
  )
}

function Tile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="tile">
      <span aria-hidden="true">{icon}</span>
      <span className="caption muted">{label}</span>
      <span className="tile-value">{value}</span>
    </div>
  )
}

export function ListerCard({ lister }: { lister: Listing['lister'] }) {
  return (
    <div className="lister-row">
      {lister.photoUrl ? (
        <img src={lister.photoUrl} alt="" className="avatar avatar-img" />
      ) : (
        <span className="avatar" aria-hidden="true">
          {lister.firstName[0]}
        </span>
      )}
      <div>
        <p className="lister-name">{lister.firstName}</p>
        <p className="verified">
          <BadgeCheck size={16} strokeWidth={1.5} aria-hidden="true" />
          Verified CSU student
        </p>
        <p className="caption muted">
          {[lister.year, lister.since && `On Handoff since ${lister.since}`].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}
