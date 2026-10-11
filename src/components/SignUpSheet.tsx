import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { Check, X } from 'lucide-react'
import {
  birthYearOptions,
  friendlyError,
  isAdultBirthYear,
  logInWithEmail,
  MIN_AGE,
  resetPassword,
  signUpWithEmail,
} from '../lib/auth'
import type { FriendlyError } from '../lib/auth'
import { GENDERS, GENDER_SELF_MAX, invalidateMyGroup } from '../lib/gender'
import type { Gender } from '../lib/gender'
import { savePending, useAuth } from './AuthProvider'
import type { PendingAction } from './AuthProvider'
import { useFinishPending } from './useFinishPending'

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
  const { member } = useAuth()
  const location = useLocation()

  const open = useCallback(
    (a: OpenArgs) => {
      if (member) return
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
  const [mode, setMode] = useState<Mode>(args.reason === 'login' ? 'login' : 'signup')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [genderSelf, setGenderSelf] = useState('')
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
      if (!birthYear) return setError({ message: 'Pick your birth year.', field: 'birthYear' })
      if (!isAdultBirthYear(Number(birthYear)))
        return setError({ message: `You need to be ${MIN_AGE} or older to use Handoff.`, field: 'birthYear' })
      void run(async () => {
        const user = await signUpWithEmail(firstName, email, password, {
          birthYear: Number(birthYear),
          gender,
          genderSelfDescribe: genderSelf,
          reason: args.reason,
        })
        if (gender) invalidateMyGroup()
        onClose()
        await finishPending(user, { welcome: `Welcome to Handoff, ${firstName.trim()}!` })
      })
      return
    }

    void run(async () => {
      const user = await logInWithEmail(email, password)
      onClose()
      await finishPending(user, { welcome: `Welcome back${user.displayName ? `, ${user.displayName}` : ''}.` })
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
        {mode === 'signup' && <p className="muted">Free, and you're in right away.</p>}
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

            {mode === 'signup' && (
              <>
                <Field id="su-birth" label="Birth year" error={fieldError('birthYear')}>
                  <select
                    id="su-birth"
                    className="input"
                    autoComplete="bday-year"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    aria-invalid={!!fieldError('birthYear')}
                  >
                    <option value="" disabled>
                      Select year
                    </option>
                    {birthYearOptions().map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  {!fieldError('birthYear') && <p className="helper">Handoff is for people {MIN_AGE} and older.</p>}
                </Field>

                <fieldset className="field chip-field">
                  <legend className="label">Gender (optional)</legend>
                  <div className="chips-wrap">
                    {GENDERS.map(([g, label]) => (
                      <button
                        key={g}
                        type="button"
                        className={gender === g ? 'chip chip-on' : 'chip'}
                        aria-pressed={gender === g}
                        onClick={() => setGender(gender === g ? undefined : g)}
                      >
                        {gender === g && <Check size={14} strokeWidth={2} aria-hidden="true" />}
                        {label}
                      </button>
                    ))}
                  </div>
                  {gender === 'self' && (
                    <input
                      className="input gender-self"
                      aria-label="Your gender, in your words"
                      maxLength={GENDER_SELF_MAX}
                      placeholder="In your words"
                      value={genderSelf}
                      onChange={(e) => setGenderSelf(e.target.value)}
                    />
                  )}
                  <p className="helper">Only you see this. It helps show places that are open to you.</p>
                </fieldset>
              </>
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
