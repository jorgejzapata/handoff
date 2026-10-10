import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Mail, CircleCheck } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { clearPending, readPending, useAuth } from '../components/AuthProvider'
import type { PendingAction } from '../components/AuthProvider'
import { useToast } from '../components/Toast'
import { logOut, sendVerification } from '../lib/auth'
import { usingEmulators } from '../lib/firebase'
import { getDraftPointer } from '../lib/draftCarry'
import { fetchListing, listerSince, publishDraftById } from '../lib/listings'
import { findMyConversation, startConversation } from '../lib/messages'

const RESEND_SECONDS = 60

function pendingLine(p: PendingAction | null) {
  switch (p?.reason) {
    case 'say-hi':
      return p.message
        ? `Your message to ${p.listerName ?? 'the lister'} is ready. It sends the moment you're verified.`
        : `Once you're verified, we'll take you right back to ${p.listerName ? `${p.listerName}'s place` : 'that place'}.`
    case 'publish':
      return "Your listing goes live the moment you're verified."
    case 'save':
      return "Once you're verified, we'll take you right back to where you were."
    default:
      return null
  }
}

// "Check your CSU inbox". Watches for verification and continues on its own.
export default function Verify() {
  const { user, loading, verified, refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [pending] = useState(readPending)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [resendNote, setResendNote] = useState<string | null>(null)
  const finished = useRef(false)

  const finish = useCallback(async () => {
    if (finished.current) return
    finished.current = true
    clearPending()

    if (pending?.reason === 'publish' && user) {
      const id = getDraftPointer() ?? pending.listingId
      try {
        const live =
          !!id &&
          (await publishDraftById(id, user.uid, {
            firstName: user.displayName || 'A Ram',
            since: listerSince(user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date()),
          }))
        if (live) {
          navigate(`/post/live/${id}`, { replace: true })
          return
        }
        toast('Almost there. Finish the missing parts, then publish.')
      } catch (e) {
        console.error('[handoff] publish after verify', e)
        toast("Couldn't publish yet. Check your listing and try again.")
      }
      navigate('/post', { replace: true })
      return
    }

    if (pending?.reason === 'say-hi' && pending.listingId && pending.message && user) {
      try {
        const existing = await findMyConversation(pending.listingId, user.uid)
        if (existing) {
          navigate(`/messages/${existing}`, { replace: true })
          return
        }
        const listing = await fetchListing(pending.listingId)
        if (listing?.status === 'active') {
          const id = await startConversation(listing, user, pending.message)
          toast(`You're verified. Your message to ${listing.lister.firstName} is sent.`)
          navigate(`/messages/${id}`, { replace: true })
          return
        }
        toast('That place is no longer available.')
      } catch (e) {
        console.error('[handoff] say hi after verify', e)
        toast("You're verified, but the message didn't send. Try Say hi again.")
      }
      navigate(pending.returnTo ?? '/', { replace: true })
      return
    }

    toast("You're verified")
    navigate(pending?.returnTo ?? '/', { replace: true })
  }, [navigate, pending, toast, user])

  // Already verified (or verified on another device): move on.
  useEffect(() => {
    if (verified) void finish()
  }, [verified, finish])

  // Check every few seconds, and right away when the tab gets focus again.
  useEffect(() => {
    if (!user || verified) return
    const check = () => refresh().catch(() => false)
    const timer = setInterval(check, 4000)
    const onFocus = () => document.visibilityState === 'visible' && check()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user, verified, refresh])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (loading) return null

  if (!user) {
    return (
      <div className="page empty">
        <p className="heading">You're not signed in.</p>
        <Link to="/" className="btn btn-secondary">
          Back to Handoff
        </Link>
      </div>
    )
  }

  async function resend() {
    if (!user || cooldown > 0) return
    setResendNote(null)
    try {
      await sendVerification(user)
      setResendNote('Sent. Give it a minute.')
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      setResendNote(
        err instanceof FirebaseError && err.code === 'auth/too-many-requests'
          ? 'Too many tries. Wait a few minutes, then resend.'
          : "Couldn't send it. Try again in a minute.",
      )
    }
  }

  // An unverified account with a typo'd email is useless; remove it and start over.
  async function changeEmail() {
    try {
      await user?.delete()
    } catch {
      await logOut()
    }
    navigate(pending?.returnTo ?? '/', { replace: true })
    toast('Start again with the right email.')
  }

  const line = pendingLine(pending)

  return (
    <div className="page verify">
      <Mail size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
      <h1 className="title">Check your CSU inbox</h1>
      <p>
        We sent a link to <strong>{user.email}</strong>. Tap it, then come back here.
      </p>
      {line && <p className="notice">{line}</p>}
      {usingEmulators && (
        <p className="notice caption">
          Dev mode: no real email is sent. Open the link from the emulator's terminal output or the Auth tab at
          localhost:4000.
        </p>
      )}

      <div className="verify-actions">
        <a className="btn btn-primary btn-block" href="https://outlook.office.com/mail/" target="_blank" rel="noreferrer">
          Open Outlook
        </a>
        <button type="button" className="btn btn-secondary btn-block" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
        </button>
        {resendNote && (
          <p className="caption muted center" role="status">
            {resendNote}
          </p>
        )}
        <button type="button" className="link-btn center-block" onClick={changeEmail}>
          Wrong email? Change it
        </button>
      </div>
      <p className="caption muted center">Not there? Check Junk. New senders sometimes land there.</p>
    </div>
  )
}

// Where the verification link lands, possibly on a different device.
export function Verified() {
  const { user, refresh } = useAuth()
  const [pending] = useState(readPending)

  useEffect(() => {
    if (user) refresh().catch(() => {})
  }, [user, refresh])

  return (
    <div className="page verify">
      <CircleCheck size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
      <h1 className="title">You're verified!</h1>
      <p className="muted">You can message listers and post your place.</p>
      <div className="verify-actions">
        <Link
          to={pending?.returnTo ?? '/'}
          className="btn btn-accent btn-block"
          onClick={() => clearPending()}
        >
          Continue
        </Link>
      </div>
    </div>
  )
}
