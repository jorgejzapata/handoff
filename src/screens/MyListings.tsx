import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EllipsisVertical, House } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'
import { useInbox } from '../components/InboxProvider'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/Sheet'
import { MarkFilledSheet } from '../components/MarkFilledSheet'
import { ListingPhoto } from '../components/ListingCard'
import { daysToExpiry, deleteListing, fetchMyListings, isPastExpiry, keepListingUp } from '../lib/listings'
import type { Listing } from '../lib/listings'
import { deleteListingPhoto } from '../lib/photos'
import { closeThreadsForListing } from '../lib/messages'
import { setDraftPointer } from '../lib/draftCarry'
import { clearListingsCache } from '../lib/useListings'
import { formatDates, formatRent, formatShortDate } from '../lib/format'

type Tab = 'live' | 'drafts' | 'past'

function bucket(l: Listing): Tab | 'hidden' {
  if (l.status === 'draft') return 'drafts'
  if (l.status === 'hidden' || l.status === 'removed') return 'hidden'
  if (l.status === 'active' && !isPastExpiry(l)) return 'live'
  return 'past'
}

// The lister's home base. With no alert emails in the MVP, this screen
// carries every reminder: expiring soon, and what to do next.
export default function MyListings() {
  const { user } = useAuth()
  const { conversations } = useInbox()
  const navigate = useNavigate()
  const toast = useToast()
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('live')
  const [menu, setMenu] = useState<string | null>(null)
  const [filling, setFilling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Listing | null>(null)

  const load = useCallback(() => {
    if (!user) return
    fetchMyListings(user.uid)
      .then(setListings)
      .catch((e) => {
        console.error('[handoff] my listings', e)
        setError(true)
      })
  }, [user])

  useEffect(load, [load])

  if (!user) return null

  const all = listings ?? []
  const groups: Record<Tab, Listing[]> = { live: [], drafts: [], past: [] }
  const underReview: Listing[] = []
  for (const l of all) {
    const b = bucket(l)
    if (b === 'hidden') underReview.push(l)
    else groups[b].push(l)
  }
  const expiringSoon = groups.live.filter((l) => {
    const d = daysToExpiry(l)
    return d !== null && d <= 3
  })
  const chatsFor = (id: string) => (conversations ?? []).filter((c) => c.listingId === id && c.listerId === user.uid).length

  async function keepUp(l: Listing) {
    try {
      await keepListingUp(l.id, l.availableTo)
      toast('Still up. Thanks for checking in.')
      load()
    } catch {
      toast("Couldn't update. Try again in a minute.")
    }
  }

  async function remove(l: Listing) {
    try {
      if (l.status !== 'draft') {
        await closeThreadsForListing(l.id, user!.uid, user!.displayName || 'The lister', 'expired').catch(() => {})
      }
      await deleteListing(l)
      await Promise.all(l.photos.map((p) => deleteListingPhoto(p)))
      clearListingsCache()
      toast('Listing deleted.')
      load()
    } catch (e) {
      console.error('[handoff] delete listing', e)
      toast("Couldn't delete. Try again in a minute.")
    }
  }

  function finishDraft(l: Listing) {
    setDraftPointer(l.id)
    navigate('/post')
  }

  async function share(l: Listing) {
    const url = `${window.location.origin}/listings/${l.id}`
    try {
      if (navigator.share) await navigator.share({ title: l.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied')
      }
    } catch {
      /* dismissed */
    }
  }

  const tabs: [Tab, string][] = [
    ['live', 'Live'],
    ['drafts', 'Drafts'],
    ['past', 'Past'],
  ]
  const shown = groups[tab]

  return (
    <div className="page my-listings" onClick={() => menu && setMenu(null)}>
      <div className="my-head">
        <h1 className="title">Your listings</h1>
        <Link to="/post" className="btn btn-secondary btn-sm">
          Post another
        </Link>
      </div>

      {expiringSoon.map((l) => {
        const d = daysToExpiry(l)!
        return (
          <div key={l.id} className="notice attention">
            <div>
              <p className="notice-title">
                Still available? Your place {l.neighborhood ? `near ${l.neighborhood}` : `"${l.title}"`} expires{' '}
                {d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}.
              </p>
              <div className="row-8 attention-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => keepUp(l)}>
                  Keep it up
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilling(l.id)}>
                  Mark as filled
                </button>
              </div>
            </div>
          </div>
        )
      })}

      <div className="tabs" role="tablist" aria-label="Listing status">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'tab tab-on' : 'tab'}
            onClick={() => setTab(value)}
          >
            {label} <span className="tab-count">{groups[value].length}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="empty">
          <p className="heading">Couldn't load your listings.</p>
          <button type="button" className="btn btn-secondary" onClick={load}>
            Try again
          </button>
        </div>
      ) : listings === null ? (
        <div aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="thread-row skeleton-row" style={{ height: 120 }} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <div className="empty">
          <House size={48} strokeWidth={1.5} aria-hidden="true" />
          <p className="heading">You haven't posted a place yet.</p>
          <Link to="/post" className="btn btn-accent">
            Post your place
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted empty-line">
          {tab === 'live' ? 'Nothing live right now.' : tab === 'drafts' ? 'No drafts.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="manage-list">
          {shown.map((l) => {
            const chats = chatsFor(l.id)
            const pastExpiry = isPastExpiry(l)
            const chip =
              l.status === 'draft'
                ? ['Draft', 'status-muted']
                : l.status === 'filled'
                  ? ['Filled', 'status-filled']
                  : l.status === 'expired' || pastExpiry
                    ? ['Expired', 'status-muted']
                    : ['Active', 'status-active']
            return (
              <li key={l.id} className="manage-card">
                <Link to={l.status === 'draft' ? '/post' : `/listings/${l.id}`} onClick={() => l.status === 'draft' && setDraftPointer(l.id)} className="manage-main">
                  <ListingPhoto listing={l} className="manage-thumb" />
                  <span className="manage-text">
                    <span className="card-title">{l.title || 'Untitled draft'}</span>
                    <span className="caption muted">
                      {l.rentCents ? `${formatRent(l.rentCents)} / mo` : 'No rent yet'}
                      {l.availableFrom && l.availableTo ? ` · ${formatDates(l.availableFrom, l.availableTo)}` : ''}
                    </span>
                    <span className={`status-chip ${chip[1]}`}>{chip[0]}</span>
                  </span>
                </Link>

                {tab === 'live' && (
                  <p className="caption muted manage-stats">
                    {chats} {chats === 1 ? 'chat' : 'chats'}
                    {l.expiresAt && ` · Expires ${formatShortDate(l.expiresAt)}`}
                  </p>
                )}

                <div className="manage-actions">
                  {l.status === 'draft' ? (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => finishDraft(l)}>
                        Finish listing
                      </button>
                      <button type="button" className="link-btn danger-link" onClick={() => setDeleting(l)}>
                        Delete
                      </button>
                    </>
                  ) : tab === 'live' ? (
                    <>
                      <Link to={`/me/listings/${l.id}/edit`} className="btn btn-secondary btn-sm">
                        Edit
                      </Link>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilling(l.id)}>
                        Mark as filled
                      </button>
                      <div className="menu-wrap">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="More options"
                          aria-expanded={menu === l.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenu(menu === l.id ? null : l.id)
                          }}
                        >
                          <EllipsisVertical size={20} strokeWidth={1.5} />
                        </button>
                        {menu === l.id && (
                          <div className="popover" role="menu">
                            <Link role="menuitem" to={`/listings/${l.id}`}>
                              View as seeker
                            </Link>
                            <button role="menuitem" type="button" onClick={() => share(l)}>
                              Share
                            </button>
                            <button role="menuitem" type="button" className="danger-link" onClick={() => setDeleting(l)}>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Link to={`/me/listings/${l.id}/edit?relist=1`} className="btn btn-primary btn-sm">
                        Relist
                      </Link>
                      <button type="button" className="link-btn danger-link" onClick={() => setDeleting(l)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {underReview.length > 0 && (
        <section className="section">
          <h2 className="heading">Under review</h2>
          {underReview.map((l) => (
            <p key={l.id} className="notice">
              “{l.title}” is under review. We'll be in touch at your CSU email.
            </p>
          ))}
        </section>
      )}

      {filling && (
        <MarkFilledSheet
          listingId={filling}
          onDone={load}
          onClose={() => setFilling(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this listing?"
          body={deleting.status === 'draft' ? 'This draft is gone for good.' : 'Chats stay, but the listing is gone for good.'}
          action="Delete"
          danger
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
