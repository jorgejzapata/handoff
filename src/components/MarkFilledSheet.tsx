import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Sheet } from './Sheet'
import { useAuth } from './AuthProvider'
import { markListingFilled, takeListingDown } from '../lib/listings'
import { closeThreadsForListing } from '../lib/messages'
import { clearListingsCache } from '../lib/useListings'

type Answer = 'handoff' | 'elsewhere' | 'down'

// "Did your place get filled?" This answer is the north-star metric, so the
// question is required and the three options never change wording.
const OPTIONS: [Answer, string][] = [
  ['handoff', 'On Handoff'],
  ['elsewhere', 'Somewhere else'],
  ['down', 'Taking it down for another reason'],
]

export function MarkFilledSheet({ listingId, onDone, onClose }: { listingId: string; onDone?: () => void; onClose: () => void }) {
  const { user } = useAuth()
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [state, setState] = useState<'form' | 'saving' | 'done'>('form')
  const [error, setError] = useState(false)

  async function save() {
    if (!user || !answer) return
    setState('saving')
    setError(false)
    try {
      if (answer === 'down') await takeListingDown(listingId)
      else await markListingFilled(listingId, answer === 'handoff')
      clearListingsCache()
      // Close open threads. If this part fails, the listing is still marked.
      await closeThreadsForListing(listingId, user.uid, user.displayName || 'The lister', answer === 'down' ? 'expired' : 'filled').catch(
        (e) => console.error('[handoff] closing threads', e),
      )
      setState('done')
    } catch (e) {
      console.error('[handoff] mark filled', e)
      setError(true)
      setState('form')
    }
  }

  const close = () => {
    if (state === 'done') onDone?.()
    onClose()
  }

  if (state === 'done') {
    return (
      <Sheet title={answer === 'down' ? 'Your listing is down.' : 'Nice work handing it off.'} onClose={close}>
        <CircleCheck size={40} strokeWidth={1.5} className="verify-icon" aria-hidden="true" />
        <p className="muted">It's out of search, and anyone you were chatting with will see it's {answer === 'down' ? 'down' : 'filled'}.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={close}>
          Done
        </button>
      </Sheet>
    )
  }

  return (
    <Sheet title="Did your place get filled?" onClose={close} busy={state === 'saving'}>
      <fieldset className="field chip-field">
        <legend className="label">Where did you find them?</legend>
        <div className="choice-list">
          {OPTIONS.map(([value, label]) => (
            <label key={value} className={answer === value ? 'radio-row radio-on' : 'radio-row'}>
              <input type="radio" name="filled-answer" checked={answer === value} onChange={() => setAnswer(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          Couldn't save. Check your connection and try again.
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={!answer || state === 'saving'} onClick={save}>
        {state === 'saving' ? 'Saving…' : answer === 'down' ? 'Take it down' : 'Mark as filled'}
      </button>
    </Sheet>
  )
}
