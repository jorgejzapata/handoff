import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Sheet } from './Sheet'
import { useAuth } from './AuthProvider'
import { REPORT_REASONS, submitReport } from '../lib/reports'
import type { ReportReason, ReportTarget } from '../lib/reports'

// Report a listing, a person or a message. Only admins ever see reports.
export function ReportSheet({
  targetType,
  targetId,
  title,
  onBlock,
  onClose,
}: {
  targetType: ReportTarget
  targetId: string
  title: string // "Report this listing", "Report Jake"
  onBlock?: () => void // offered after reporting a person
  onClose: () => void
}) {
  const { user } = useAuth()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [error, setError] = useState(false)

  async function send() {
    if (!user || !reason) return
    setState('sending')
    setError(false)
    try {
      await submitReport(user.uid, targetType, targetId, reason, details)
      setState('done')
    } catch (e) {
      console.error('[handoff] report', e)
      setError(true)
      setState('form')
    }
  }

  if (state === 'done') {
    return (
      <Sheet title="Thanks. We'll look into it." onClose={onClose}>
        <CircleCheck size={40} strokeWidth={1.5} className="verify-icon" aria-hidden="true" />
        <p>The person you reported won't know it was you.</p>
        <p className="caption muted">If you ever feel unsafe, call 911.</p>
        {onBlock && (
          <button type="button" className="btn btn-secondary btn-block" onClick={onBlock}>
            Block them too
          </button>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Done
        </button>
      </Sheet>
    )
  }

  return (
    <Sheet title={title} onClose={onClose} busy={state === 'sending'}>
      <div className="choice-list" role="radiogroup" aria-label="Reason">
        {REPORT_REASONS.map(([value, label]) => (
          <label key={value} className={reason === value ? 'radio-row radio-on' : 'radio-row'}>
            <input type="radio" name="report-reason" checked={reason === value} onChange={() => setReason(value)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor="report-details">Details (optional)</label>
        <textarea
          id="report-details"
          className="input textarea"
          rows={3}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          Couldn't send the report. Try again in a minute.
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={!reason || state === 'sending'} onClick={send}>
        {state === 'sending' ? 'Sending…' : 'Send report'}
      </button>
    </Sheet>
  )
}
