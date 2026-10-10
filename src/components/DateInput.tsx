import { CalendarDays } from 'lucide-react'

// One date field that looks the same everywhere. Our calendar icon replaces
// the browser's, the whole field opens the picker, and iPhone gets a
// placeholder (Safari shows an empty date field as blank).
export function DateInput({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: string
  min?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="date-field">
      <span className="caption muted">{label}</span>
      <span className="input-icon date-wrap">
        <CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" />
        <input
          type="date"
          className="input"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.()
            } catch {
              /* not supported, or already open */
            }
          }}
        />
        {!value && (
          <span className="date-placeholder" aria-hidden="true">
            Add date
          </span>
        )}
      </span>
    </label>
  )
}
