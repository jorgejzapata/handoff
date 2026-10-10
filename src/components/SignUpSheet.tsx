import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { X } from 'lucide-react'
import {
  friendlyError,
  isCsuEmail,
  logInWithEmail,
  resetPassword,
  signUpWithEmail,
} from '../lib/auth'
import type { FriendlyError } from '../lib/auth'
import { clearPending, savePending, useAuth } from './AuthProvider'
import type { PendingAction } from './AuthProvider'
import { useToast } from './Toast'

// The sign-up sheet opens only at the moment of intent: Say hi, Save or Publish.

type Reason = PendingAction['reason']
interface OpenArgs {
  reason: Reason
  listerName?: string
  listingId?: string
  message?: string
}

const SignUpContext = createContext<{ open: (args: OpenArgs) => void }>({ open: () => {} })
export const useSignUp = () => useContext(SignUpContext)

// Until messaging and saves exist, a verified student gets a heads-up instead.
const COMING_NEXT: Partial<Record<Reason, string>> = {
  save: 'Saving places is coming next.',
}

function titleFor({ reason, listerName }: OpenArgs) {
  switch (reason) {
    case 'say-hi':
      return `Sign up to say hi to ${listerName ?? 'them'}`
    case 'save':
      return 'Sign up to save places'
    case 'publish':
      return 'Sign up to publish your place'
    case 'messages':
      return 'Sign up to see your messages'
    case 'login':
      return 'Log in to Handoff'
  }
}

export function SignUpProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<OpenArgs | null>(null)
  const { user, verified } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const open = useCallback(
    (a: OpenArgs) => {
      if (verified) {
        const note = COMING_NEXT[a.reason]
        if (note) toast(note)
        return
      }
      savePending({
        reason: a.reason,
        listerName: a.listerName,
        listingId: a.listingId,
        message: a.message,
        returnTo: location.pathname + location.search,
      })
      if (user) navigate('/verify') // signed in, just not verified yet
      else setArgs(a)
    },
    [verified, user, navigate, location, toast],
  )

  return (
    <SignUpContext.Provider value={{ open }}>
      {children}
      {args && <SignUpSheet args={args} onClose={() => setArgs(null)} />}
    </SignUpContext.Provider>
  )
}

type Mode = 'signup' | 'login' | 'reset'

function SignUpSheet({ args, onClose }: { args: OpenArgs; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(args.reason === 'login' ? 'login' : 'signup')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<FriendlyError | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const titleId = useId()
  // Focus the sheet itself, not a field, so the keyboard doesn't pop up until
  // the student taps a field. Screen readers still land inside the dialog.
  const sheetRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true })
  }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, busy])

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setResetSent(false)
  }

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    if (mode === 'reset') {
      void run(async () => {
        await resetPassword(email)
        setResetSent(true)
      })
      return
    }

    if (mode === 'signup') {
      if (!firstName.trim()) return setError({ message: 'Add your first name.', field: 'name' })
      if (!isCsuEmail(email))
        return setError({
          message: 'Handoff is just for CSU students right now. Use your @colostate.edu email.',
          field: 'email',
        })
      if (password.length < 8) return setError({ message: 'Use at least 8 characters.', field: 'password' })
      void run(async () => {
        await signUpWithEmail(firstName, email, password)
        onClose()
        navigate('/verify')
      })
      return
    }

    void run(async () => {
      const user = await logInWithEmail(email, password)
      onClose()
      // Verify finishes a pending publish (and moves on right away if already verified).
      if (args.reason === 'publish' || args.reason === 'say-hi') {
        navigate('/verify')
      } else if (user.emailVerified) {
        clearPending()
        toast(`Welcome back${user.displayName ? `, ${user.displayName}` : ''}.`)
      } else {
        navigate('/verify')
      }
    })
  }

  const title = mode === 'login' ? 'Log in to Handoff' : mode === 'reset' ? 'Reset your password' : titleFor(args)
  const fieldError = (f: FriendlyError['field']) => (error?.field === f ? error : null)

  return (
    <div className="scrim" onClick={() => !busy && onClose()}>
      <div
        className="sheet"
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <button type="button" className="icon-btn sheet-close" aria-label="Close" onClick={onClose} disabled={busy}>
          <X size={20} strokeWidth={1.5} />
        </button>

        <h2 id={titleId} className="title-sm">
          {title}
        </h2>
        {mode === 'signup' && <p className="muted">Listers only hear from verified CSU students.</p>}
        {mode === 'reset' && !resetSent && <p className="muted">We'll email you a link to set a new one.</p>}

        {mode === 'reset' && resetSent ? (
          <p className="notice">Check your inbox for a reset link. Not there? Check Junk.</p>
        ) : (
          <form className="stack-12" onSubmit={onSubmit} noValidate>
            {mode === 'signup' && (
              <Field id="su-name" label="First name" error={fieldError('name')}>
                <input
                  id="su-name"
                  className="input"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={40}
                  aria-invalid={!!fieldError('name')}
                />
              </Field>
            )}
            <Field id="su-email" label="CSU email" error={fieldError('email')}>
              <input
                id="su-email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder="you@colostate.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldError('email')}
              />
            </Field>
            {error?.action === 'login' && (
              <button type="button" className="link-btn helper-link" onClick={() => switchMode('login')}>
                Log in instead
              </button>
            )}
            {mode !== 'reset' && (
              <Field id="su-pass" label="Password" error={fieldError('password')}>
                <div className="input-wrap">
                  <input
                    id="su-pass"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!fieldError('password')}
                  />
                  <button type="button" className="input-action" onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {mode === 'signup' && !fieldError('password') && <p className="helper">At least 8 characters.</p>}
                {mode === 'login' && (
                  <button type="button" className="link-btn helper-link" onClick={() => switchMode('reset')}>
                    Forgot password?
                  </button>
                )}
              </Field>
            )}

            {error && !error.field && (
              <p className="form-error" role="alert">
                {error.message}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy
                ? 'One sec…'
                : mode === 'login'
                  ? 'Log in'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : 'Create account'}
            </button>
          </form>
        )}

        <p className="center">
          {mode === 'signup' ? 'Already have an account? ' : mode === 'login' ? 'New to Handoff? ' : ''}
          <button
            type="button"
            className="link-btn"
            onClick={() => switchMode(mode === 'signup' ? 'login' : mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'signup' ? 'Log in' : mode === 'login' ? 'Sign up' : 'Back to log in'}
          </button>
        </p>
        {mode === 'signup' && (
          <p className="caption muted center">
            By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
        )}
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error: FriendlyError | null
  children: ReactNode
}) {
  return (
    <div className={error ? 'field field-error' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="field-msg" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
