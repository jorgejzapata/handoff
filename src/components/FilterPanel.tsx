import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { DateInput } from './DateInput'
import { BATHS, BEDS, DISTANCES } from '../lib/browseFilters'
import type { Filters, PlaceType } from '../lib/browseFilters'
import { GROUPS } from '../lib/gender'
import type { Group } from '../lib/gender'

// Every Browse filter in one column. The mobile sheet edits a draft and
// applies on "Show N places"; the desktop rail applies each change right away.
export function FilterPanel({
  value,
  onChange,
  myGroup,
}: {
  value: Filters
  onChange: (next: Filters) => void
  myGroup?: Group
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch })
  const rooms = value.type !== 'whole'

  return (
    <div className="filter-panel">
      <Section title="Dates">
        <div className="date-pair">
          <DateInput label="Move in" value={value.from ?? ''} onChange={(v) => set({ from: v || undefined })} />
          <DateInput
            label="Move out"
            value={value.to ?? ''}
            min={value.from}
            onChange={(v) => set({ to: v || undefined })}
          />
        </div>
        <p className="helper">Places that cover part of your dates still show, with a note.</p>
      </Section>

      <Section title="Price per month">
        <div className="date-pair">
          <MoneyField label="Min" value={value.min} onChange={(min) => set({ min })} />
          <MoneyField label="Max" value={value.max} onChange={(max) => set({ max })} />
        </div>
        {value.min !== undefined && value.max !== undefined && value.min > value.max && (
          <p className="field-msg">Min is higher than max, so nothing will match.</p>
        )}
      </Section>

      <Section title="Type">
        <div className="segmented" role="radiogroup" aria-label="Type">
          {(
            [
              ['any', 'Any'],
              ['room', 'Room'],
              ['whole', 'Whole place'],
            ] as [PlaceType, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={value.type === t}
              className={value.type === t ? 'seg seg-on' : 'seg'}
              onClick={() => set({ type: t })}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Bedrooms">
        <Chips options={BEDS} value={value.beds} onPick={(beds) => set({ beds })} />
      </Section>

      <Section title="Bathrooms">
        <Chips options={BATHS} value={value.baths} onPick={(baths) => set({ baths })} />
        {rooms && (
          <Toggle label="Private bath" checked={value.privateBath} onChange={(privateBath) => set({ privateBath })} />
        )}
      </Section>

      <Section title="Distance to campus">
        <Chips options={DISTANCES} value={value.dist} onPick={(dist) => set({ dist })} allowAny />
      </Section>

      <Section title="Extras">
        <Toggle label="Furnished" checked={value.furnished} onChange={(furnished) => set({ furnished })} />
        <Toggle label="Utilities included" checked={value.utilities} onChange={(utilities) => set({ utilities })} />
      </Section>

      {rooms && (
        <Section title="Open to">
          <Chips
            options={GROUPS.map(([g, label]) => [g, g === myGroup ? `${label} (you)` : label] as [Group, string])}
            value={value.for}
            onPick={(g) => set({ for: g })}
          />
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="filter-section">
      <legend className="heading">{title}</legend>
      {children}
    </fieldset>
  )
}

// Tap a chip to pick it, tap it again to clear. "Any" (allowAny) clears too.
function Chips<T extends string | number | undefined>({
  options,
  value,
  onPick,
  allowAny = false,
}: {
  options: [T, string][]
  value: T | undefined
  onPick: (v: T | undefined) => void
  allowAny?: boolean
}) {
  return (
    <div className="chips-wrap">
      {options.map(([v, label]) => {
        const on = value === v
        return (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            className={on ? 'chip chip-on' : 'chip'}
            onClick={() => onPick(on && !(allowAny && v === undefined) ? undefined : v)}
          >
            {on && <Check size={14} strokeWidth={2} aria-hidden="true" />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <label className="date-field">
      <span className="caption muted">{label}</span>
      <span className="input-icon money-wrap">
        <span className="money-sign" aria-hidden="true">
          $
        </span>
        <input
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={label === 'Min' ? '0' : 'Any'}
          value={value ?? ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 5)
            onChange(digits ? Number(digits) : undefined)
          }}
        />
      </span>
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}
