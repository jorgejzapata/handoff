import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

// The sign-up sheet opens only at the moment of intent: Say hi, Save or Publish.
// UI only for now; Firebase Auth gets wired in next.

type Reason = 'say-hi' | 'save' | 'publish' | 'messages' | 'login'
interface OpenArgs {
  reason: Reason
  listerName?: string
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
  const open = useCallback((a: OpenArgs) => setArgs(a), [])
  return (
    <SignUpContext.Provider value={{ open }}>
      {children}
      {args && <SignUpSheet args={args} onClose={() => setArgs(null)} />}
    </SignUpContext.Provider>
  )
}

function SignUpSheet({ args, onClose }: { args: OpenArgs; onClose: () => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>(args.reason === 'login' ? 'login' : 'signup')
  const [showPassword, setShowPassword] = useState(false)
  const titleId = useId()
  const firstField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstField.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, mode])

  const title = mode === 'login' ? 'Log in to Handoff' : titleFor(args)

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <button type="button" className="icon-btn sheet-close" aria-label="Close" onClick={onClose}>
          <X size={20} strokeWidth={1.5} />
        </button>

        <h2 id={titleId} className="title-sm">{title}</h2>
        {mode === 'signup' && <p className="muted">Listers only hear from verified CSU students.</p>}

        <form className="stack-12" onSubmit={(e) => e.preventDefault()}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="su-name">First name</label>
              <input id="su-name" ref={firstField} className="input" autoComplete="given-name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="su-email">CSU email</label>
            <input
              id="su-email"
              ref={mode === 'login' ? firstField : undefined}
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@colostate.edu"
            />
          </div>
          <div className="field">
            <label htmlFor="su-pass">Password</label>
            <div className="input-wrap">
              <input
                id="su-pass"
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
              />
              <button type="button" className="input-action" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {mode === 'signup' ? (
              <p className="helper">At least 8 characters.</p>
            ) : (
              <button type="button" className="link-btn helper-link">
                Forgot password?
              </button>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {mode === 'signup' && (
          <>
            <div className="divider" role="separator">
              <span>or</span>
            </div>
            <button type="button" className="btn btn-secondary btn-block">
              Continue with Google
            </button>
            <p className="caption muted center">For @rams.colostate.edu accounts</p>
          </>
        )}

        <p className="center">
          {mode === 'signup' ? 'Already have an account? ' : 'New to Handoff? '}
          <button type="button" className="link-btn" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>
        <p className="caption muted center">
          By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
