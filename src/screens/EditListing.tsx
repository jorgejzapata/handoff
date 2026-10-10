import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/Toast'
import { fetchListing, fetchListingDraft, missingForPublish, relistListing, saveListingEdits } from '../lib/listings'
import type { Listing, ListingDraft, Photo } from '../lib/listings'
import { deleteListingPhoto } from '../lib/photos'
import { clearListingsCache } from '../lib/useListings'
import { StepLease, StepLocation, StepOffering, StepPhotos, StepPlace, StepRentDates } from './post/PostSteps'

// Editing a live listing: the wizard's fields as one long form with section
// headings and a sticky Save. With ?relist=1 it puts a filled or expired
// listing back up (pick new dates first).
export default function EditListing() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [listing, setListing] = useState<Listing | null | undefined>(undefined)
  const [original, setOriginal] = useState<ListingDraft | null>(null)
  const [draft, setDraft] = useState<ListingDraft>({})
  const [changes, setChanges] = useState<ListingDraft>({})
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([fetchListing(id), fetchListingDraft(id)])
      .then(([l, d]) => {
        setListing(l)
        setOriginal(d)
        setDraft(d ?? {})
      })
      .catch(() => setListing(null))
  }, [id])

  const relisting = params.get('relist') === '1' || (!!listing && ['filled', 'expired'].includes(listing.status))
  const missing = useMemo(() => missingForPublish(draft), [draft])
  const dirty = Object.keys(changes).length > 0

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (listing === undefined) return <div className="page" aria-busy="true" />
  if (!listing || !user || listing.ownerId !== user.uid || !original) {
    return (
      <div className="page empty">
        <p className="heading">You can't edit this listing.</p>
        <Link to="/me/listings" className="btn btn-secondary">
          Your listings
        </Link>
      </div>
    )
  }
  if (listing.status === 'hidden' || listing.status === 'removed') {
    return (
      <div className="page empty">
        <p className="heading">This listing is under review.</p>
        <Link to="/me/listings" className="btn btn-secondary">
          Your listings
        </Link>
      </div>
    )
  }

  const update = (c: ListingDraft) => {
    setDraft((d) => ({ ...d, ...c }))
    setChanges((x) => ({ ...x, ...c }))
  }
  const ensureDraft = async () => ({ id: listing.id, uid: user.uid })

  // Relisting needs dates that haven't passed yet.
  const today = new Date().toISOString().slice(0, 10)
  const datesStale = relisting && (!draft.availableTo || draft.availableTo < today)

  async function save() {
    if (missing.length || saving || datesStale) return
    setSaving(true)
    try {
      if (relisting && listing!.status === 'active') {
        // Still "active" in the database, just past its expiry: a fresh 3 months.
        await saveListingEdits(listing!.id, changes, draft.availableTo, true)
      } else if (relisting) {
        await relistListing(listing!.id, changes, draft.availableTo!)
      } else {
        await saveListingEdits(listing!.id, changes, draft.availableTo)
      }
      // Photos removed in this edit are deleted from Storage once it's saved.
      const kept = new Set((draft.photos ?? []).map((p) => p.id))
      const removed = (original!.photos ?? []).filter((p: Photo) => !kept.has(p.id))
      await Promise.all(removed.map((p) => deleteListingPhoto(p)))
      clearListingsCache()
      setChanges({})
      toast(relisting ? "You're live again!" : 'Changes saved.')
      navigate(relisting ? `/post/live/${listing!.id}` : '/me/listings', { replace: true })
    } catch (e) {
      console.error('[handoff] save listing', e)
      toast("Couldn't save. Check each section, then try again.")
      setSaving(false)
    }
  }

  return (
    <div className="wizard edit-listing">
      <header className="wizard-top">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        <span className="caption muted">{dirty ? 'Unsaved changes' : ''}</span>
      </header>

      <main className="wizard-body">
        <p className="eyebrow">{relisting ? 'Relist' : 'Edit listing'}</p>
        <h1 className="title">{draft.title || 'Your listing'}</h1>
        {relisting && (
          <p className="notice caption">Check your dates first, then update anything that's changed.</p>
        )}

        <Section title="Rent and dates">
          <StepRentDates draft={draft} update={update} />
          {datesStale && (
            <p className="field-msg" role="alert">
              Pick a move-out date that hasn't passed.
            </p>
          )}
        </Section>
        <Section title="What you're offering">
          <StepOffering draft={draft} update={update} />
        </Section>
        <Section title="About the place">
          <StepPlace draft={draft} update={update} />
        </Section>
        <Section title="Photos">
          <StepPhotos draft={draft} update={update} ensureDraft={ensureDraft} onUploading={setUploading} deleteOnRemove={false} />
        </Section>
        <Section title="Location">
          <StepLocation draft={draft} draftId={listing.id} update={update} ensureDraft={ensureDraft} />
        </Section>
        <Section title="Lease">
          <StepLease draft={draft} update={update} />
        </Section>

        {missing.length > 0 && (
          <p className="form-error" role="alert">
            Still needed: {missing.map((m) => m.label.toLowerCase()).join(', ')}.
          </p>
        )}
        {draft.availableFrom !== original.availableFrom || draft.availableTo !== original.availableTo ? (
          <p className="caption muted">New dates reset your listing's 3-month expiry.</p>
        ) : null}
      </main>

      <footer className="wizard-foot">
        <Link to="/me/listings" className="link-btn">
          Cancel
        </Link>
        <button
          type="button"
          className={relisting ? 'btn btn-accent' : 'btn btn-primary'}
          disabled={saving || uploading > 0 || missing.length > 0 || datesStale || (!relisting && !dirty)}
          onClick={save}
        >
          {saving ? 'Saving…' : relisting ? 'Relist' : 'Save changes'}
        </button>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="edit-section">
      <h2 className="heading">{title}</h2>
      {children}
    </section>
  )
}
