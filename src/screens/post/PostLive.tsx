import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CircleCheck, Copy, Share } from 'lucide-react'
import { ListingCard } from '../../components/ListingCard'
import { useAuth } from '../../components/AuthProvider'
import { useToast } from '../../components/Toast'
import { fetchListing } from '../../lib/listings'
import type { Listing } from '../../lib/listings'
import { fetchProfile } from '../../lib/users'
import { formatDates, formatRent } from '../../lib/format'
import { track, withShareUtm } from '../../lib/track'

// "You're live!" after Publish. First-time listers see profile setup first.
export default function PostLive() {
  const { id } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [listing, setListing] = useState<Listing | null>(null)

  useEffect(() => {
    if (id) fetchListing(id).then(setListing)
  }, [id])

  useEffect(() => {
    if (loading || !user) return
    fetchProfile(user.uid).then((p) => {
      if (p?.onboardingStep === 'profile') navigate(`/onboarding?next=/post/live/${id}`, { replace: true })
    })
  }, [loading, user, id, navigate])

  const url = withShareUtm(`/listings/${id}`, 'publish_success')

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
      track('share', { content_type: 'listing', item_id: id, method: 'copy', from: 'publish_success' })
    } catch {
      toast(url)
    }
  }

  async function share() {
    if (!listing) return
    try {
      await navigator.share({
        title: listing.title,
        text: `${formatRent(listing.rentCents)} / mo · ${listing.title} · ${formatDates(listing.availableFrom, listing.availableTo)}`,
        url,
      })
      track('share', { content_type: 'listing', item_id: id, method: 'share_sheet', from: 'publish_success' })
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="page verify">
      <CircleCheck size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
      <h1 className="title">You're live!</h1>
      <p className="muted">Share it in your school's housing groups to get it seen.</p>

      {listing && (
        <div className="live-card">
          <ListingCard listing={listing} />
        </div>
      )}

      <div className="verify-actions">
        <button type="button" className="btn btn-accent btn-block" onClick={copy}>
          <Copy size={18} strokeWidth={2} aria-hidden="true" />
          Copy link
        </button>
        {'share' in navigator && (
          <button type="button" className="btn btn-secondary btn-block" onClick={share}>
            <Share size={18} strokeWidth={2} aria-hidden="true" />
            Share
          </button>
        )}
        <Link to={`/listings/${id}`} className="link-btn center-block">
          See your listing
        </Link>
      </div>
    </div>
  )
}
