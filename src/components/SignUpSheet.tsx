import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { X } from 'lucide-react'
import { friendlyError, logInWithEmail, resetPassword, signUpWithEmail } from '../lib/auth'
import { isReturningDevice, markReturningDevice } from '../lib/settings'
import type { FriendlyError } from '../lib/auth'
import { savePending, useAuth } from './AuthProvider'
import type { PendingAction } from './AuthProvider'
import { useFinishPending } from './useFinishPending'
import { track } from '../lib/track'

// The sign-up sheet opens only at the moment of intent: Say hi, Save or Publish.

type Reason = PendingAction['reason']
interface OpenArgs {
  reason: Reason
  // Which tab to open on. Without it: Log in on a device that has had an
  // account, Sign up everywhere else.
  mode?: 'signup' | 'login'
  listerName?: string
  listingId?: string
  message?: string
}

const SignUpContext = createContext<{ open: (args: OpenArgs) => void }>({ open: () => {} })
export const useSignUp = () => useContext(SignUpContext)

// One line under the tabs that names what they were doing.
function leadFor({ reason, listerName }: OpenArgs, mode: 'signup' | 'login') {
  const doing =
    reason === 'say-hi'
      ? `say hi to ${listerName ?? 'them'}`
      : reason === 'save'
        ? 'save places'
        : reason === 'publish'
          ? 'publish your place'
          : reason === 'messages'
            ? 'see your messages'
            : null
  if (mode === 'login') return doing ? `Welcome back. Log in to ${doing}.` : 'Welcome back. Use the email you signed up with.'
  return doing ? `Make a free account to ${doing}. It takes a minute.` : "It's free, and you're in right away."
}

export function SignUpProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<OpenArgs | null>(null)
  const { member } = useAuth()
  const location = useLocation()

  const open = useCallback(
    (a: OpenArgs) => {
      if (member) return
      track('signup_sheet_opened', { trigger: a.reason })
      savePending({
        reason: a.reason,
        listerName: a.listerName,
        listingId: a.listingId,
        message: a.message,
        returnTo: location.pathname + location.search,
      })
      setArgs(a)
    },
    [member, location],
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
  // New devices start on Sign up, devices that have had an account start on
  // Log in. Either way the two tabs at the top make the mode obvious.
  const [mode, setMode] = useState<Mode>(args.mode ?? (isReturningDevice() ? 'login' : 'signup'))
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
  const finishPending = useFinishPending()

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
      if (!email.trim()) return setError({ message: 'Add your email.', field: 'email' })
      if (password.length < 8) return setError({ message: 'Use at least 8 characters.', field: 'password' })
      void run(async () => {
        const user = await signUpWithEmail(firstName, email, password, { reason: args.reason })
        markReturningDevice()
        onClose()
        await finishPending(user, { welcome: `Welcome to Handoff, ${firstName.trim()}!` })
      })
      return
    }

    void run(async () => {
      const user = await logInWithEmail(email, password)
      markReturningDevice()
      onClose()
      await finishPending(user, { welcome: `Welcome back${user.displayName ? `, ${user.displayName}` : ''}.` })
    })
  }

  const lead = mode === 'reset' ? "We'll email you a link to set a new one." : leadFor(args, mode)
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

        {mode === 'reset' ? (
          <h2 id={titleId} className="title-sm auth-reset-title">
            Reset your password
          </h2>
        ) : (
          <div className="auth-tabs" role="tablist" aria-labelledby={titleId}>
            <span id={titleId} className="sr-only">
              Sign up or log in
            </span>
            {(
              [
                ['signup', 'Sign up'],
                ['login', 'Log in'],
              ] as ['signup' | 'login', string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? 'auth-tab auth-tab-on' : 'auth-tab'}
                onClick={() => switchMode(m)}
                disabled={busy}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!(mode === 'reset' && resetSent) && <p className="muted auth-lead">{lead}</p>}

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
            <Field id="su-email" label="Email" error={fieldError('email')}>
              <input
                id="su-email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder="you@example.com"
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
            {/* The common slip: a new person typing into Log in. One tap moves
                what they typed over to Sign up. */}
            {mode === 'login' && error?.action === 'signup' && (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => switchMode('signup')}>
                New here? Create an account with this email
              </button>
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

        {mode === 'reset' && (
          <p className="center">
            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          </p>
        )}
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
