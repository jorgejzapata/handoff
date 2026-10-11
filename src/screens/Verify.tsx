import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Mail, CircleCheck, BadgeCheck } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { applyActionCode } from 'firebase/auth'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/Toast'
import { isStudentEmail, sendVerification } from '../lib/auth'
import { auth, usingEmulators } from '../lib/firebase'

const RESEND_SECONDS = 60

// Optional: confirm a school (.edu) email for the "Verified student" badge and
// student perks. Nobody has to do this to use Handoff, so nothing waits on it.
export default function Verify() {
  const { user, loading, studentVerified, refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const done = useRef(false)

  // Verified (here or on another device): celebrate and head back.
  useEffect(() => {
    if (!studentVerified || done.current) return
    done.current = true
    toast("You're a verified student")
    navigate('/me', { replace: true })
  }, [studentVerified, navigate, toast])

  // Once a link is out, check every few seconds and when the tab gets focus.
  useEffect(() => {
    if (!user || !sent || studentVerified) return
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
  }, [user, sent, studentVerified, refresh])

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

  if (!isStudentEmail(user.email)) {
    return (
      <div className="page verify">
        <BadgeCheck size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
        <h1 className="title">Student verification</h1>
        <p>
          The Verified student badge is for school emails (ending in .edu). You signed up with{' '}
          <strong>{user.email}</strong>, and everything on Handoff works the same without it.
        </p>
        <div className="verify-actions">
          <Link to="/me" className="btn btn-secondary btn-block">
            Back
          </Link>
        </div>
      </div>
    )
  }

  async function send() {
    if (!user || sending || cooldown > 0) return
    setSending(true)
    setNote(null)
    try {
      await sendVerification(user)
      setSent(true)
      setCooldown(RESEND_SECONDS)
      setNote(sent ? 'Sent again. Give it a minute.' : null)
    } catch (err) {
      setNote(
        err instanceof FirebaseError && err.code === 'auth/too-many-requests'
          ? 'Too many tries. Wait a few minutes, then try again.'
          : "Couldn't send it. Try again in a minute.",
      )
    } finally {
      setSending(false)
    }
  }

  if (!sent) {
    return (
      <div className="page verify">
        <BadgeCheck size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
        <h1 className="title">Get your Verified student badge</h1>
        <p>
          Confirm <strong>{user.email}</strong> and your listings show a Verified student badge. Verified students will
          also get a discount on boosts.
        </p>
        <div className="verify-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={send} disabled={sending}>
            {sending ? 'Sending…' : 'Email me a link'}
          </button>
          {note && (
            <p className="caption muted center" role="status">
              {note}
            </p>
          )}
          <Link to="/me" className="link-btn center-block">
            Maybe later
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page verify">
      <Mail size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
      <h1 className="title">Check your school inbox</h1>
      <p>
        We sent a link to <strong>{user.email}</strong>. Tap it, then come back here. You can keep using Handoff in the
        meantime.
      </p>
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
        <button type="button" className="btn btn-secondary btn-block" onClick={send} disabled={sending || cooldown > 0}>
          {cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
        </button>
        {note && (
          <p className="caption muted center" role="status">
            {note}
          </p>
        )}
        <Link to="/me" className="link-btn center-block">
          Done for now
        </Link>
      </div>
      <p className="caption muted center">Not there? Check Junk or Quarantine. School email can take a few minutes.</p>
    </div>
  )
}

// Where the verification link lands, possibly on a different device.
export function Verified() {
  const { user, refresh } = useAuth()

  useEffect(() => {
    if (user) refresh().catch(() => {})
  }, [user, refresh])

  return (
    <div className="page verify">
      <CircleCheck size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
      <h1 className="title">You're a verified student!</h1>
      <p className="muted">Your listings now show the Verified student badge.</p>
      <div className="verify-actions">
        <Link to={user ? '/me' : '/'} className="btn btn-accent btn-block">
          Continue
        </Link>
      </div>
    </div>
  )
}

// Where the verification email's button lands. Nothing happens until the
// student taps Verify: school email scanners (like Microsoft's) open every
// link in an email, and Firebase codes work only once, so verifying on page
// load would let the scanner use up the link before the student gets there.
export function ConfirmEmail() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const code = params.get('oobCode')
  const [state, setState] = useState<'ready' | 'working' | 'failed'>(code ? 'ready' : 'failed')

  async function confirm() {
    if (!code) return
    setState('working')
    try {
      await applyActionCode(auth, code)
      if (user) await refresh().catch(() => false)
      navigate('/verified', { replace: true })
    } catch (err) {
      // Already verified (an older link, or a second tap)? Then all is well.
      const done = user ? await refresh().catch(() => false) : false
      if (done) {
        navigate('/verified', { replace: true })
        return
      }
      console.error('[handoff] confirm email', err)
      setState('failed')
    }
  }

  if (state === 'failed') {
    return (
      <div className="page verify">
        <Mail size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
        <h1 className="title">That link didn't work</h1>
        <p>It may have expired or already been used. If Handoff already shows you as verified, you're all set. If not, get a fresh link.</p>
        <div className="verify-actions">
          {user ? (
            <Link to="/verify" className="btn btn-primary btn-block">
              Send a new link
            </Link>
          ) : (
            <Link to="/" className="btn btn-primary btn-block">
              Log in to get a new link
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page verify">
      <Mail size={48} strokeWidth={1.5} aria-hidden="true" className="verify-icon" />
      <h1 className="title">Verify your school email</h1>
      <p>One tap to confirm it's you and get your Verified student badge.</p>
      <div className="verify-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={confirm} disabled={state === 'working'}>
          {state === 'working' ? 'Verifying…' : 'Verify my email'}
        </button>
      </div>
    </div>
  )
}
