import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  Bath,
  BedDouble,
  BadgeCheck,
  CircleCheck,
  CircleHelp,
  Clock,
  Info,
  Share,
  Sofa,
  Zap,
} from 'lucide-react'
import { PhotoPlaceholder, SaveButton } from '../components/ListingCard'
import { useSignUp } from '../components/SignUpSheet'
import {
  eyebrowLabel,
  formatDates,
  formatRent,
  formatShortDate,
  getListing,
  landlordLine,
} from '../data/sampleListings'

const LANDLORD_ICON = { allowed: CircleCheck, needsApproval: Clock, notSure: CircleHelp }

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { open } = useSignUp()
  const [expanded, setExpanded] = useState(false)
  const listing = id ? getListing(id) : undefined

  if (!listing) {
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
  const LandlordIcon = LANDLORD_ICON[listing.landlordStatus]
  const utilities = listing.utilitiesIncluded
    ? 'Included'
    : listing.utilitiesEstimateCents
      ? `About ${formatRent(listing.utilitiesEstimateCents)} / mo`
      : 'Not included'
  const sayHi = () => open({ reason: 'say-hi', listerName: name })

  return (
    <div className="detail">
      <div className="gallery">
        <PhotoPlaceholder tone={listing.photoTone} label={`Photo 1 of ${listing.photoCount}`} className="gallery-photo" />
        <div className="gallery-bar">
          <button type="button" className="float-btn" aria-label="Back" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
          <div className="row-8">
            <button type="button" className="float-btn" aria-label="Share">
              <Share size={20} strokeWidth={1.5} />
            </button>
            <SaveButton floating />
          </div>
        </div>
        <span className="gallery-count">1 / {listing.photoCount}</span>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-block">
            <p className="eyebrow">{eyebrowLabel(listing)}</p>
            <h1 className="title">{listing.title}</h1>
            <p className="muted">
              Near {listing.neighborhood} · {listing.distanceToCampusMi} mi to campus
            </p>
          </section>

          <section className="detail-block mobile-only">
            <p className="price">
              {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
            </p>
            <p className="row-8">
              {formatDates(listing.availableFrom, listing.availableTo, true)}
              {listing.datesFlexible && <span className="chip chip-static">Flexible</span>}
            </p>
          </section>

          <section className="tiles" aria-label="Quick facts">
            <Tile icon={<BedDouble size={20} strokeWidth={1.5} />} label="Bedrooms" value={listing.bedrooms === 0 ? 'Studio' : String(listing.bedrooms)} />
            <Tile
              icon={<Bath size={20} strokeWidth={1.5} />}
              label="Bathrooms"
              value={`${listing.bathrooms}${listing.privateBath && listing.listingType === 'room' ? ' · private' : ''}`}
            />
            <Tile icon={<Sofa size={20} strokeWidth={1.5} />} label="Furnished" value={listing.furnished ? 'Yes' : 'No'} />
            <Tile icon={<Zap size={20} strokeWidth={1.5} />} label="Utilities" value={utilities} />
          </section>

          <section className="lister mobile-only">
            <ListerCard name={name} year={listing.lister.year} since={listing.lister.since} />
          </section>

          <section className="detail-block">
            <h2 className="heading">About this place</h2>
            <p className={expanded ? '' : 'clamp-6'}>{listing.description}</p>
            {listing.description.length > 280 && (
              <button type="button" className="link-btn" onClick={() => setExpanded((e) => !e)}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </section>

          <section className="detail-block">
            <h2 className="heading">Details</h2>
            {listing.listingType === 'room' && (
              <p>
                {listing.roommateCount} {listing.roommateCount === 1 ? 'roommate' : 'roommates'}
              </p>
            )}
            <div className="chips-wrap">
              {listing.amenities.map((a) => (
                <span key={a} className="chip chip-static">
                  {a}
                </span>
              ))}
            </div>
            {listing.depositNote && <p>Deposit: {listing.depositNote}</p>}
            <p className="landlord-line">
              <LandlordIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              {landlordLine[listing.landlordStatus]}
            </p>
          </section>

          <section className="detail-block">
            <h2 className="heading">Location</h2>
            <div className="map" role="img" aria-label={`Approximate area near ${listing.neighborhood}`}>
              <div className="map-circle" />
            </div>
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

          <footer className="detail-foot">
            <p className="caption muted">
              Posted {formatShortDate(listing.postedAt)}
              {listing.updatedAt !== listing.postedAt && ` · Updated ${formatShortDate(listing.updatedAt)}`}
            </p>
            <button type="button" className="link-btn caption" onClick={() => open({ reason: 'login' })}>
              Report this listing
            </button>
          </footer>
        </div>

        <aside className="detail-aside desktop-only">
          <div className="card sticky-card">
            <p className="price">
              {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
            </p>
            <p className="row-8">
              {formatDates(listing.availableFrom, listing.availableTo, true)}
              {listing.datesFlexible && <span className="chip chip-static">Flexible</span>}
            </p>
            <ListerCard name={name} year={listing.lister.year} since={listing.lister.since} />
            <button type="button" className="btn btn-accent btn-block" onClick={sayHi}>
              Say hi to {name}
            </button>
          </div>
        </aside>
      </div>

      <div className="sticky-bar mobile-only">
        <p className="price">
          {formatRent(listing.rentCents)} <span className="per-mo">/ mo</span>
        </p>
        <button type="button" className="btn btn-accent" onClick={sayHi}>
          Say hi to {name}
        </button>
      </div>
    </div>
  )
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="tile">
      <span aria-hidden="true">{icon}</span>
      <span className="caption muted">{label}</span>
      <span className="tile-value">{value}</span>
    </div>
  )
}

function ListerCard({ name, year, since }: { name: string; year: string; since: string }) {
  return (
    <div className="lister-row">
      <span className="avatar" aria-hidden="true">
        {name[0]}
      </span>
      <div>
        <p className="lister-name">{name}</p>
        <p className="verified">
          <BadgeCheck size={16} strokeWidth={1.5} aria-hidden="true" />
          Verified CSU student
        </p>
        <p className="caption muted">
          {year} · On Handoff since {since}
        </p>
      </div>
    </div>
  )
}
