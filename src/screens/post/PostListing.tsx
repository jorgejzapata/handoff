import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'
import { useSignUp } from '../../components/SignUpSheet'
import { useToast } from '../../components/Toast'
import { ListingView } from '../../components/ListingView'
import { ensureAnonymous } from '../../lib/auth'
import { getDraftPointer, setDraftPointer, takeDraftNotice } from '../../lib/draftCarry'
import {
  createDraft,
  deleteDraft,
  draftToPreview,
  fetchDraft,
  listerSince,
  missingForPublish,
  publishListing,
  saveDraft,
} from '../../lib/listings'
import type { ListingDraft } from '../../lib/listings'
import { clearListingsCache } from '../../lib/useListings'
import { StepLease, StepLocation, StepOffering, StepPhotos, StepPlace, StepRentDates, stepValid } from './PostSteps'

// Post a listing: six short steps and a preview. No account needed until
// Publish; the draft autosaves to Firestore under an anonymous account.

const STEPS = [
  { title: 'What are you offering?', help: 'Pick one. The rest of the form adapts to it.' },
  { title: 'Rent and dates', help: 'What the next person pays you, or the landlord, each month.' },
  { title: 'Tell us about the place', help: 'The details people ask about first.' },
  { title: 'Add photos', help: 'Up to 8. The first one is the cover.' },
  { title: 'Where is it?', help: 'Search for the address.' },
  { title: 'Check your lease', help: 'Subleasing without the landlord’s OK can cost you your deposit.' },
]
const PREVIEW = STEPS.length

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function PostListing() {
  const navigate = useNavigate()
  const toast = useToast()
  const { open } = useSignUp()
  const { rawUser, user, member, studentVerified, loading: authLoading } = useAuth()

  const [draft, setDraft] = useState<ListingDraft>({})
  const [draftId, setDraftId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'resume' | 'editing'>('loading')
  const [save, setSave] = useState<SaveState>('idle')
  const [uploading, setUploading] = useState(0)
  const [publishing, setPublishing] = useState(false)

  const pending = useRef<ListingDraft>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef<string | null>(null)
  const uidRef = useRef<string | null>(null)
  const creating = useRef<Promise<{ id: string; uid: string }> | null>(null)

  // ---- Load an existing draft on this device ----
  useEffect(() => {
    if (authLoading || phase !== 'loading') return
    const pointer = getDraftPointer()
    if (!pointer || !rawUser) {
      setDraftPointer(null)
      setPhase('editing')
      return
    }
    fetchDraft(pointer, rawUser.uid).then((d) => {
      if (!d || !d.listingType) {
        setDraftPointer(null)
        setPhase('editing')
        return
      }
      idRef.current = pointer
      uidRef.current = rawUser.uid
      setDraftId(pointer)
      setDraft(d)
      const notice = takeDraftNotice()
      if (notice) {
        toast(notice)
        setPhase('editing')
        setStep(firstOpenStep(d))
      } else {
        setPhase('resume')
      }
    })
  }, [authLoading, rawUser, phase, toast])

  // ---- Autosave ----
  const ensureDraft = useCallback(async () => {
    if (idRef.current && uidRef.current) return { id: idRef.current, uid: uidRef.current }
    if (!creating.current) {
      creating.current = (async () => {
        const u = await ensureAnonymous()
        const changes = pending.current
        pending.current = {}
        const id = await createDraft(u.uid, changes)
        idRef.current = id
        uidRef.current = u.uid
        setDraftId(id)
        setDraftPointer(id)
        return { id, uid: u.uid }
      })().finally(() => {
        creating.current = null
      })
    }
    return creating.current
  }, [])

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setSave('saving')
    try {
      if (!idRef.current) await ensureDraft()
      if (idRef.current && Object.keys(pending.current).length) {
        const changes = pending.current
        pending.current = {}
        await saveDraft(idRef.current, changes)
      }
      setSave('saved')
    } catch (e) {
      console.error('[handoff] autosave', e)
      setSave('error')
    }
  }, [ensureDraft])

  const update = useCallback(
    (changes: ListingDraft) => {
      setDraft((d) => ({ ...d, ...changes }))
      pending.current = { ...pending.current, ...changes }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), 700)
    },
    [flush],
  )

  // Save whatever is pending when leaving the page.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      if (timer.current) void flush()
    }
  }, [flush])

  function go(next: number) {
    void flush()
    setStep(Math.max(0, Math.min(PREVIEW, next)))
    window.scrollTo({ top: 0 })
  }

  async function startOver() {
    const old = idRef.current
    idRef.current = null
    pending.current = {}
    setDraftId(null)
    setDraftPointer(null)
    setDraft({})
    setStep(0)
    setPhase('editing')
    if (old) await deleteDraft(old).catch(() => {})
  }

  // ---- Publish ----
  async function publish() {
    await flush()
    const id = idRef.current
    if (!id) return
    if (!member) {
      open({ reason: 'publish', listingId: id })
      return
    }
    setPublishing(true)
    try {
      await publishListing(id, draft, {
        firstName: user?.displayName || 'A student',
        since: listerSince(user?.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date()),
        verified: studentVerified,
      })
      clearListingsCache()
      setDraftPointer(null)
      navigate(`/post/live/${id}`, { replace: true })
    } catch (e) {
      console.error('[handoff] publish', e)
      toast("Couldn't publish. Check each step, then try again.")
      setPublishing(false)
    }
  }

  // ---- Render ----
  if (phase === 'loading') return <div className="wizard" aria-busy="true" />

  if (phase === 'resume') {
    return (
      <div className="wizard">
        <WizardTop save="idle" onExit={() => navigate('/')} />
        <main className="wizard-body">
          <h1 className="title">Pick up where you left off?</h1>
          <p className="muted">
            {draft.title ? `“${draft.title}” is saved as a draft.` : 'You have a listing saved as a draft.'}
          </p>
          <div className="verify-actions">
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                setPhase('editing')
                setStep(firstOpenStep(draft))
              }}
            >
              Continue
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={startOver}>
              Start over
            </button>
          </div>
        </main>
      </div>
    )
  }

  const isPreview = step === PREVIEW
  const valid = isPreview || (stepValid(step, draft) && !(step === 3 && uploading > 0))
  const missing = missingForPublish(draft)

  return (
    <div className="wizard">
      <WizardTop save={save} onExit={() => void flush().then(() => navigate('/'))} />
      <div className="progress" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${(Math.min(step + 1, PREVIEW) / PREVIEW) * 100}%` }} />
      </div>

      {isPreview ? (
        <main className="wizard-preview">
          <div className="wizard-body preview-head">
            <p className="eyebrow">Preview</p>
            <h1 className="title">Here's how it looks</h1>
            {missing.length > 0 ? (
              <div className="form-error" role="alert">
                Before you publish, add: {missing.map((m) => m.label.toLowerCase()).join(', ')}.
              </div>
            ) : (
              <p className="muted">Tap Edit on any section to change it.</p>
            )}
          </div>
          <ListingView
            listing={draftToPreview(draft, {
              firstName: user?.displayName || 'You',
              since: listerSince(),
            })}
            onEdit={go}
            footer={<div />}
          />
        </main>
      ) : (
        <main className="wizard-body">
          <p className="eyebrow">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="title">{STEPS[step].title}</h1>
          <p className="muted">{STEPS[step].help}</p>

          {step === 0 && <StepOffering draft={draft} update={update} />}
          {step === 1 && <StepRentDates draft={draft} update={update} />}
          {step === 2 && <StepPlace draft={draft} update={update} />}
          {step === 3 && (
            <StepPhotos draft={draft} update={update} ensureDraft={ensureDraft} onUploading={setUploading} />
          )}
          {step === 4 && <StepLocation draft={draft} draftId={draftId} update={update} ensureDraft={ensureDraft} />}
          {step === 5 && <StepLease draft={draft} update={update} />}

          {step === 0 && (
            <p className="notice caption">No account needed yet. Your draft saves as you go.</p>
          )}
        </main>
      )}

      <footer className="wizard-foot">
        <button type="button" className="link-btn" onClick={() => go(step - 1)} disabled={step === 0}>
          Back
        </button>
        {isPreview ? (
          <button
            type="button"
            className="btn btn-accent"
            onClick={publish}
            disabled={missing.length > 0 || publishing}
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => go(step + 1)}>
            {step === STEPS.length - 1 ? 'Preview' : 'Next'}
          </button>
        )}
      </footer>
    </div>
  )
}

function WizardTop({ save, onExit }: { save: SaveState; onExit: () => void }) {
  return (
    <header className="wizard-top">
      <button type="button" className="icon-btn" aria-label="Save and exit" onClick={onExit}>
        <X size={22} strokeWidth={1.5} />
      </button>
      <span className={save === 'error' ? 'caption save-error' : 'caption muted'} aria-live="polite">
        {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : save === 'error' ? 'Not saved. Check your connection.' : ''}
      </span>
    </header>
  )
}

function firstOpenStep(d: ListingDraft) {
  for (let i = 0; i < STEPS.length; i++) if (!stepValid(i, d)) return i
  return PREVIEW
}
