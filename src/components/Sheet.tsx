import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

// Bottom sheet on mobile, centered dialog on desktop. Focuses the sheet
// itself (not a field), so the keyboard waits for a tap.
export function Sheet({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, busy])

  return (
    <div className="scrim" onClick={() => !busy && onClose()}>
      <div
        className="sheet"
        ref={ref}
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
        {children}
      </div>
    </div>
  )
}

// The shared confirm dialog: one line on the consequence, Cancel, one action.
export function ConfirmDialog({
  title,
  body,
  action,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  action: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted">{body}</p>
      <div className="confirm-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={async () => {
            await onConfirm()
            onClose()
          }}
        >
          {action}
        </button>
      </div>
    </Sheet>
  )
}
