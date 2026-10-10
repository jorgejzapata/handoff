import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Check, House, KeyRound, X } from 'lucide-react'

// Post a listing wizard. Step 1 is built; steps 2–6 and the preview come next.
// The draft saves to this device for now; it moves to a Firestore draft under
// an anonymous account once Auth is wired up.

const STEPS = ['What are you offering?', 'Rent and dates', 'Tell us about the place', 'Add photos', 'Where is it?', 'Check your lease']
const DRAFT_KEY = 'handoff:post-draft'

type Offering = 'room' | 'takeover'
interface Draft {
  step: number
  offering?: Offering
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : { step: 0 }
  } catch {
    return { step: 0 }
  }
}

export default function PostListing() {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      if (draft.offering) setSaved(true)
    } catch {
      /* storage unavailable: keep going without autosave */
    }
  }, [draft])

  const step = draft.step
  const canNext = step === 0 ? !!draft.offering : true
  const go = (s: number) => setDraft((d) => ({ ...d, step: Math.max(0, Math.min(STEPS.length - 1, s)) }))

  return (
    <div className="wizard">
      <header className="wizard-top">
        <Link to="/" className="icon-btn" aria-label="Save and exit">
          <X size={22} strokeWidth={1.5} />
        </Link>
        <span className="caption muted" aria-live="polite">
          {saved ? 'Saved' : ''}
        </span>
      </header>
      <div className="progress" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <main className="wizard-body">
        <p className="eyebrow">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="title">{STEPS[step]}</h1>

        {step === 0 ? (
          <>
            <p className="muted">Pick one. The rest of the form adapts to it.</p>
            <div className="choice-list" role="radiogroup" aria-label="What are you offering?">
              <Choice
                selected={draft.offering === 'room'}
                onSelect={() => setDraft((d) => ({ ...d, offering: 'room' }))}
                icon={<House size={28} strokeWidth={1.5} />}
                title="A room in a shared place"
                body="Sublet your room for a semester or the summer. Your roommates stay."
              />
              <Choice
                selected={draft.offering === 'takeover'}
                onSelect={() => setDraft((d) => ({ ...d, offering: 'takeover' }))}
                icon={<KeyRound size={28} strokeWidth={1.5} />}
                title="The whole place (lease takeover)"
                body="Someone takes over your lease and the whole unit."
              />
            </div>
            <p className="notice caption">No account needed yet. Your draft saves as you go.</p>
          </>
        ) : (
          <div className="empty">
            <p className="muted">This step is next on the build list.</p>
          </div>
        )}
      </main>

      <footer className="wizard-foot">
        <button type="button" className="link-btn" onClick={() => go(step - 1)} disabled={step === 0}>
          Back
        </button>
        <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => go(step + 1)}>
          Next
        </button>
      </footer>
    </div>
  )
}

function Choice(props: { selected: boolean; onSelect: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      className={props.selected ? 'choice choice-on' : 'choice'}
      onClick={props.onSelect}
    >
      <span className="choice-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span className="choice-text">
        <span className="heading">{props.title}</span>
        <span className="muted">{props.body}</span>
      </span>
      <span className="choice-check" aria-hidden="true">
        {props.selected && <Check size={16} strokeWidth={2.5} />}
      </span>
    </button>
  )
}
