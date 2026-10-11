import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BadgeCheck, ChevronRight, Mail } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/Toast'
import { Sheet } from '../components/Sheet'
import { changePassword, deleteAccount, fetchBlocked, reauthenticate, unblock, usesPassword } from '../lib/account'
import type { BlockedPerson } from '../lib/account'
import { getTheme, setTheme, analyticsAllowed, setAnalyticsAllowed } from '../lib/settings'
import type { Theme } from '../lib/settings'
import { setAnalyticsEnabled } from '../lib/firebase'
import { SUPPORT_EMAIL } from '../config'
import { fetchProfile, saveProfile } from '../lib/users'

type Sheet_ = 'password' | 'delete' | null

export default function Account() {
  const { user, studentVerified } = useAuth()
  const toast = useToast()
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const [analytics, setAnalytics] = useState(analyticsAllowed)
  const [blocked, setBlocked] = useState<BlockedPerson[] | null>(null)
  const [sheet, setSheet] = useState<Sheet_>(null)
  const [emailAlerts, setEmailAlerts] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchBlocked(user.uid).then(setBlocked).catch(() => setBlocked([]))
    fetchProfile(user.uid).then((p) => setEmailAlerts(p?.notificationPrefs?.email !== false))
  }, [user])

  if (!user) return null

  function pickTheme(t: Theme) {
    setThemeState(t)
    setTheme(t)
  }

  async function toggleEmailAlerts(on: boolean) {
    setEmailAlerts(on)
    try {
      await saveProfile(user!.uid, { notificationPrefs: { email: on } })
    } catch {
      setEmailAlerts(!on)
      toast("Couldn't save that. Try again in a minute.")
    }
  }

  function toggleAnalytics(on: boolean) {
    setAnalytics(on)
    setAnalyticsAllowed(on)
    void setAnalyticsEnabled(on)
  }

  async function doUnblock(p: BlockedPerson) {
    try {
      await unblock(user!.uid, p.uid)
      setBlocked((list) => (list ?? []).filter((b) => b.uid !== p.uid))
      toast(`${p.firstName} is unblocked.`)
    } catch {
      toast("Couldn't unblock. Try again in a minute.")
    }
  }

  return (
    <div className="page account">
      <h1 className="title account-title">Account settings</h1>

      <section className="settings-group" aria-label="Login">
        <div className="settings-row">
          <span className="settings-label">Email</span>
          <span className="settings-value">
            <span className="settings-email">{user.email}</span>
            {studentVerified && (
              <BadgeCheck size={16} strokeWidth={1.5} className="verified-icon" aria-label="Verified student" />
            )}
          </span>
        </div>
        {usesPassword(user) && (
          <button type="button" className="settings-row settings-button" onClick={() => setSheet('password')}>
            <span className="settings-label">Password</span>
            <span className="settings-value muted">
              Change password
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
            </span>
          </button>
        )}
        <Link to="/onboarding?next=/account" className="settings-row settings-button">
          <span className="settings-label">Profile</span>
          <span className="settings-value muted">
            Name, photo, year, bio
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </Link>
      </section>

      <section className="settings-group" aria-label="Preferences">
        <div className="settings-row settings-stack">
          <span className="settings-label" id="theme-label">
            Theme
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
            {(
              [
                ['system', 'System'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                className={theme === value ? 'seg seg-on' : 'seg'}
                onClick={() => pickTheme(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="settings-row toggle-row settings-toggle">
          <span>
            <span className="settings-label">Email me about new messages</span>
            <span className="caption muted settings-help">
              Only when you're not in the app. At most one email per chat every 30 minutes.
            </span>
          </span>
          <input type="checkbox" role="switch" checked={emailAlerts} onChange={(e) => void toggleEmailAlerts(e.target.checked)} />
          <span className="switch" aria-hidden="true" />
        </label>

        <label className="settings-row toggle-row settings-toggle">
          <span>
            <span className="settings-label">Share usage analytics</span>
            <span className="caption muted settings-help">
              Helps us see what's working. Never includes your name, email or messages.
            </span>
          </span>
          <input type="checkbox" role="switch" checked={analytics} onChange={(e) => toggleAnalytics(e.target.checked)} />
          <span className="switch" aria-hidden="true" />
        </label>
      </section>

      <section className="settings-group" aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" className="settings-group-title">
          Blocked people
        </h2>
        {blocked === null ? (
          <p className="settings-row muted">Loading…</p>
        ) : blocked.length === 0 ? (
          <p className="settings-row muted">You haven't blocked anyone.</p>
        ) : (
          blocked.map((p) => (
            <div key={p.uid} className="settings-row">
              <span className="settings-label">{p.firstName}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => doUnblock(p)}>
                Unblock
              </button>
            </div>
          ))
        )}
      </section>

      <section className="settings-group" aria-label="Support">
        {SUPPORT_EMAIL ? (
          <a href={`mailto:${SUPPORT_EMAIL}`} className="settings-row settings-button">
            <span className="settings-label">Support</span>
            <span className="settings-value muted">
              <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
              Contact us
            </span>
          </a>
        ) : (
          <Link to="/safety" className="settings-row settings-button">
            <span className="settings-label">Safety tips</span>
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
      </section>

      <button type="button" className="link-btn danger-link delete-account-btn" onClick={() => setSheet('delete')}>
        Delete account
      </button>

      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteAccountSheet onClose={() => setSheet(null)} />}
    </div>
  )
}

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (next.length < 8) return setError('Use at least 8 characters.')
    setBusy(true)
    setError(null)
    try {
      await changePassword(user, current, next)
      toast('Password changed.')
      onClose()
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? "Your current password isn't right."
          : code === 'auth/too-many-requests'
            ? 'Too many tries. Wait a minute, then try again.'
            : "Couldn't change it. Try again in a minute.",
      )
      setBusy(false)
    }
  }

  return (
    <Sheet title="Change password" onClose={onClose} busy={busy}>
      <form className="stack-12" onSubmit={save}>
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <input id="pw-new" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="helper">At least 8 characters.</p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !current || !next}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </Sheet>
  )
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!user) return null
  const needsPassword = usesPassword(user)

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!user || busy) return
    setBusy(true)
    setError(null)
    try {
      setStep('Checking it’s you')
      await reauthenticate(user, password)
      await deleteAccount(user, setStep)
      toast('Your account is deleted.')
      navigate('/', { replace: true })
    } catch (err) {
      console.error('[handoff] delete account', err)
      const code = err instanceof FirebaseError ? err.code : ''
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? "That password isn't right."
          : code === 'auth/popup-closed-by-user'
            ? 'Confirm with Google to delete your account.'
            : "Something went wrong partway. Your account isn't fully deleted yet; try again.",
      )
      setBusy(false)
      setStep(null)
    }
  }

  return (
    <Sheet title="Delete your account?" onClose={onClose} busy={busy}>
      <p>
        Your listings come down, your name in chats changes to “Former member”, and this can't be undone.
      </p>
      <form className="stack-12" onSubmit={confirm}>
        {needsPassword ? (
          <div className="field">
            <label htmlFor="del-pw">Enter your password to confirm</label>
            <input id="del-pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        ) : (
          <p className="caption muted">You'll confirm with Google.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {step && (
          <p className="caption muted" role="status">
            {step}…
          </p>
        )}
        <button type="submit" className="btn btn-danger btn-block" disabled={busy || (needsPassword && !password)}>
          {busy ? 'Deleting…' : 'Delete account'}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </form>
    </Sheet>
  )
}
