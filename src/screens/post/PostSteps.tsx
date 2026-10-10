import { hasBlockedLanguage } from '../../lib/moderation'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  CircleHelp,
  Clock,
  House,
  ImagePlus,
  KeyRound,
  MapPin,
  RotateCw,
  Search,
  Trash2,
} from 'lucide-react'
import { AMENITIES, LIMITS, savePrivateLocation, fetchPrivateLocation } from '../../lib/listings'
import type { LandlordStatus, ListingDraft, Photo } from '../../lib/listings'
import { GROUPS } from '../../lib/gender'
import type { Group } from '../../lib/gender'
import { approximate, distanceToCampusMi, searchAddress } from '../../lib/geo'
import type { AddressResult } from '../../lib/geo'
import { deleteListingPhoto, uploadListingPhoto } from '../../lib/photos'
import { DateInput } from '../../components/DateInput'
import { AREA_RADIUS_M, LazyMap } from '../../components/map/LazyMap'

interface StepProps {
  draft: ListingDraft
  update: (changes: ListingDraft) => void
}

type EnsureDraft = () => Promise<{ id: string; uid: string }>

// ---- Which steps are complete ----
export function stepValid(step: number, d: ListingDraft) {
  switch (step) {
    case 0:
      return !!d.listingType
    case 1:
      return (
        !!d.rentCents &&
        d.rentCents >= LIMITS.rentMin * 100 &&
        d.rentCents <= LIMITS.rentMax * 100 &&
        !!d.availableFrom &&
        !!d.availableTo &&
        d.availableTo > d.availableFrom
      )
    case 2:
      return (
        d.bedrooms !== undefined &&
        !!d.title?.trim() &&
        (d.description?.trim().length ?? 0) >= LIMITS.descriptionMin &&
        !hasBlockedLanguage(`${d.title ?? ''} ${d.description ?? ''}`)
      )
    case 3:
      return (d.photos?.length ?? 0) >= 1
    case 4:
      return d.approxLat !== undefined && d.approxLng !== undefined
    case 5:
      return !!d.landlordStatus && !!d.leaseAcked
    default:
      return true
  }
}

// ---- Step 1: What are you offering? ----
export function StepOffering({ draft, update }: StepProps) {
  const pick = (listingType: 'room' | 'takeover') =>
    update({
      listingType,
      roomType: listingType === 'room' ? 'private' : 'whole',
      // Roommate preferences only apply to shared places.
      ...(listingType === 'takeover' ? { openTo: [], householdGenders: [] } : {}),
    })
  return (
    <div className="choice-list" role="radiogroup" aria-label="What are you offering?">
      <Choice
        selected={draft.listingType === 'room'}
        onSelect={() => pick('room')}
        icon={<House size={28} strokeWidth={1.5} />}
        title="A room in a shared place"
        body="Sublet your room for a semester or the summer. Your roommates stay."
      />
      <Choice
        selected={draft.listingType === 'takeover'}
        onSelect={() => pick('takeover')}
        icon={<KeyRound size={28} strokeWidth={1.5} />}
        title="The whole place (lease takeover)"
        body="Someone takes over your lease and the whole unit."
      />
    </div>
  )
}

function Choice(props: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; body: string }) {
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

// ---- Step 2: Rent and dates ----
export function StepRentDates({ draft, update }: StepProps) {
  const rent = draft.rentCents ? String(draft.rentCents / 100) : ''
  const rentNum = draft.rentCents ? draft.rentCents / 100 : 0
  const rentError =
    rent && (rentNum < LIMITS.rentMin || rentNum > LIMITS.rentMax)
      ? `Enter a monthly rent between $${LIMITS.rentMin} and $${LIMITS.rentMax.toLocaleString('en-US')}.`
      : null
  const dateError =
    draft.availableFrom && draft.availableTo && draft.availableTo <= draft.availableFrom
      ? 'Move-out needs to be after move-in.'
      : null
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="form-stack">
      <Field label="Monthly rent" htmlFor="rent" error={rentError}>
        <div className="input-icon">
          <span className="input-prefix" aria-hidden="true">
            $
          </span>
          <input
            id="rent"
            className="input"
            inputMode="numeric"
            placeholder="650"
            value={rent}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 5)
              update({ rentCents: digits ? Number(digits) * 100 : undefined })
            }}
            aria-invalid={!!rentError}
          />
          <span className="input-suffix" aria-hidden="true">
            / mo
          </span>
        </div>
      </Field>

      <Toggle
        label="Utilities included"
        checked={!!draft.utilitiesIncluded}
        onChange={(v) => update({ utilitiesIncluded: v, ...(v ? { utilitiesEstimateCents: null } : {}) })}
      />
      {!draft.utilitiesIncluded && (
        <Field label="Utilities estimate (optional)" htmlFor="util" helper="Your share per month, roughly.">
          <div className="input-icon">
            <span className="input-prefix" aria-hidden="true">
              $
            </span>
            <input
              id="util"
              className="input"
              inputMode="numeric"
              placeholder="60"
              value={draft.utilitiesEstimateCents ? String(draft.utilitiesEstimateCents / 100) : ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                update({ utilitiesEstimateCents: digits ? Number(digits) * 100 : null })
              }}
            />
            <span className="input-suffix" aria-hidden="true">
              / mo
            </span>
          </div>
        </Field>
      )}

      <Field label="Deposit note (optional)" htmlFor="deposit" helper='For example "$500, paid to the landlord".'>
        <input
          id="deposit"
          className="input"
          maxLength={LIMITS.depositNoteMax}
          value={draft.depositNote ?? ''}
          onChange={(e) => update({ depositNote: e.target.value })}
        />
      </Field>

      <div className="field">
        <span className="label">Dates</span>
        <div className="date-pair">
          <DateInput
            label="Move in"
            value={draft.availableFrom ?? ''}
            min={today}
            onChange={(v) => update({ availableFrom: v })}
          />
          <DateInput
            label="Move out"
            value={draft.availableTo ?? ''}
            min={draft.availableFrom || today}
            onChange={(v) => update({ availableTo: v })}
          />
        </div>
        {dateError && (
          <p className="field-msg" role="alert">
            {dateError}
          </p>
        )}
      </div>

      <Toggle
        label="Dates are flexible"
        checked={!!draft.datesFlexible}
        onChange={(v) => update({ datesFlexible: v })}
      />
    </div>
  )
}

// ---- Step 3: Tell us about the place ----
const BEDROOMS = [
  [0, 'Studio'],
  [1, '1'],
  [2, '2'],
  [3, '3'],
  [4, '4'],
  [5, '5+'],
] as const
const BATHROOMS = [1, 1.5, 2, 2.5, 3] as const

function suggestTitle(d: ListingDraft) {
  const furnished = d.furnished ? 'Furnished ' : ''
  if (d.listingType === 'takeover') {
    return d.bedrooms === 0 ? `${furnished}studio near CSU` : `${furnished}${d.bedrooms ?? 2}-bed place near CSU`
  }
  return `${furnished}${furnished ? 'room' : 'Room'} in a ${d.bedrooms ?? 3}-bed near CSU`
}

export function StepPlace({ draft, update }: StepProps) {
  const isRoom = draft.listingType !== 'takeover'
  const descLen = draft.description?.trim().length ?? 0
  const amenities = draft.amenities ?? []

  return (
    <div className="form-stack">
      <ChipGroup label="Bedrooms">
        {BEDROOMS.map(([value, label]) => (
          <SelectChip key={value} on={draft.bedrooms === value} onClick={() => update({ bedrooms: value })}>
            {label}
          </SelectChip>
        ))}
      </ChipGroup>

      <ChipGroup label="Bathrooms">
        {BATHROOMS.map((value) => (
          <SelectChip key={value} on={draft.bathrooms === value} onClick={() => update({ bathrooms: value })}>
            {value === 3 ? '3+' : String(value)}
          </SelectChip>
        ))}
      </ChipGroup>

      {isRoom && (
        <>
          <Toggle label="Private bathroom" checked={!!draft.privateBath} onChange={(v) => update({ privateBath: v })} />
          <ChipGroup label="Roommates who stay">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <SelectChip key={n} on={draft.roommateCount === n} onClick={() => update({ roommateCount: n })}>
                {n === 5 ? '5+' : String(n)}
              </SelectChip>
            ))}
          </ChipGroup>
          {(draft.roommateCount ?? 0) > 0 && (
            <ChipGroup label="Who lives there now (optional)">
              {GROUPS.map(([g, label]) => {
                const list = draft.householdGenders ?? []
                const on = list.includes(g)
                return (
                  <SelectChip key={g} on={on} onClick={() => update({ householdGenders: toggle(list, g) })}>
                    {label}
                  </SelectChip>
                )
              })}
            </ChipGroup>
          )}
          <OpenTo value={draft.openTo ?? []} onChange={(openTo) => update({ openTo })} />
        </>
      )}

      <Toggle label="Furnished" checked={!!draft.furnished} onChange={(v) => update({ furnished: v })} />

      <ChipGroup label="Amenities">
        {AMENITIES.map((a) => {
          const on = amenities.includes(a)
          return (
            <SelectChip
              key={a}
              on={on}
              onClick={() => update({ amenities: on ? amenities.filter((x) => x !== a) : [...amenities, a] })}
            >
              {a}
            </SelectChip>
          )
        })}
      </ChipGroup>

      <Field
        label="Title"
        htmlFor="title"
        helper={`${draft.title?.length ?? 0} / ${LIMITS.titleMax}`}
        error={hasBlockedLanguage(draft.title ?? '') ? 'Keep it friendly. Remove the word that isn’t allowed on Handoff.' : null}
      >
        <input
          id="title"
          className="input"
          maxLength={LIMITS.titleMax}
          placeholder={suggestTitle(draft)}
          value={draft.title ?? ''}
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>
      {!draft.title && (
        <button type="button" className="link-btn helper-link" onClick={() => update({ title: suggestTitle(draft) })}>
          Use “{suggestTitle(draft)}”
        </button>
      )}

      <Field
        label="Description"
        htmlFor="desc"
        error={hasBlockedLanguage(draft.description ?? '') ? 'Keep it friendly. Remove the word that isn’t allowed on Handoff.' : null}
        helper={
          descLen < LIMITS.descriptionMin
            ? `At least ${LIMITS.descriptionMin} characters (${LIMITS.descriptionMin - descLen} to go).`
            : `${draft.description?.length ?? 0} / ${LIMITS.descriptionMax}`
        }
      >
        <textarea
          id="desc"
          className="input textarea"
          rows={6}
          maxLength={LIMITS.descriptionMax}
          placeholder="What's nearby, who the roommates are, the vibe. Bus stops, parking, quiet hours."
          value={draft.description ?? ''}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
    </div>
  )
}

function toggle(list: Group[], g: Group) {
  return list.includes(g) ? list.filter((x) => x !== g) : [...list, g]
}

// Who's welcome to move in. Nothing picked means anyone.
function OpenTo({ value, onChange }: { value: Group[]; onChange: (v: Group[]) => void }) {
  const anyone = value.length === 0
  return (
    <ChipGroup label="Who can move in" helper="Women and men include trans and cis people. Pick more than one if you like.">
      <SelectChip on={anyone} onClick={() => onChange([])}>
        Anyone
      </SelectChip>
      {GROUPS.map(([g, label]) => (
        <SelectChip
          key={g}
          on={value.includes(g)}
          onClick={() => {
            const next = toggle(value, g)
            onChange(next.length === GROUPS.length ? [] : next)
          }}
        >
          {label}
        </SelectChip>
      ))}
    </ChipGroup>
  )
}

// ---- Step 4: Add photos ----
interface Upload {
  key: string
  file: File
  preview: string
  progress: number
  failed: boolean
}

export function StepPhotos({
  draft,
  update,
  ensureDraft,
  onUploading,
  deleteOnRemove = true,
}: StepProps & { ensureDraft: EnsureDraft; onUploading: (n: number) => void; deleteOnRemove?: boolean }) {
  const photos = draft.photos ?? []
  const [uploads, setUploads] = useState<Upload[]>([])
  const photosRef = useRef(photos)
  photosRef.current = photos
  const inputId = useId()

  useEffect(() => onUploading(uploads.filter((u) => !u.failed).length), [uploads, onUploading])
  useEffect(() => () => uploads.forEach((u) => URL.revokeObjectURL(u.preview)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const room = LIMITS.photosMax - photos.length - uploads.length

  async function start(u: Upload) {
    setUploads((list) => list.map((x) => (x.key === u.key ? { ...x, failed: false, progress: 0 } : x)))
    try {
      const { id, uid } = await ensureDraft()
      const photo = await uploadListingPhoto(uid, id, u.file, (p) =>
        setUploads((list) => list.map((x) => (x.key === u.key ? { ...x, progress: p } : x))),
      )
      // Update the ref right away so two uploads finishing together both stick.
      photosRef.current = [...photosRef.current, photo]
      update({ photos: photosRef.current })
      setUploads((list) => list.filter((x) => x.key !== u.key))
      URL.revokeObjectURL(u.preview)
    } catch (e) {
      console.error('[handoff] photo upload', e)
      setUploads((list) => list.map((x) => (x.key === u.key ? { ...x, failed: true } : x)))
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith('image/') || /\.heic$/i.test(f.name))
      .slice(0, Math.max(0, room))
    const next = picked.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      failed: false,
    }))
    setUploads((list) => [...list, ...next])
    next.forEach((u) => void start(u))
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...photos]
    const [p] = next.splice(index, 1)
    next.splice(index + dir, 0, p)
    update({ photos: next })
  }

  function remove(photo: Photo) {
    update({ photos: photos.filter((p) => p.id !== photo.id) })
    // Editing a live listing deletes removed photos only once the edit is saved.
    if (deleteOnRemove) void deleteListingPhoto(photo)
  }

  return (
    <div className="form-stack">
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div key={p.id} className="photo-tile">
            <img src={p.thumbUrl} alt={`Photo ${i + 1}`} />
            {i === 0 && <span className="cover-tag">Cover</span>}
            <div className="photo-tile-actions">
              <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowLeft size={16} strokeWidth={2} />
              </button>
              <button type="button" aria-label="Remove photo" onClick={() => remove(p)}>
                <Trash2 size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label="Move later"
                disabled={i === photos.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}

        {uploads.map((u) => (
          <div key={u.key} className="photo-tile uploading">
            <img src={u.preview} alt="" />
            {u.failed ? (
              <button type="button" className="tile-retry" onClick={() => void start(u)}>
                <RotateCw size={20} strokeWidth={2} aria-hidden="true" />
                Retry
              </button>
            ) : (
              <span
                className="ring"
                role="progressbar"
                aria-label="Uploading"
                aria-valuenow={Math.round(u.progress * 100)}
                style={{ ['--p' as string]: `${Math.round(u.progress * 100)}%` }}
              />
            )}
          </div>
        ))}

        {room > 0 && (
          <label htmlFor={inputId} className="photo-add">
            <ImagePlus size={28} strokeWidth={1.5} aria-hidden="true" />
            <span className="label">Add photos</span>
            <input
              id={inputId}
              type="file"
              accept="image/*,.heic"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      <p className="notice caption">Tip: 4 or more photos in daylight get more messages. Start with the room itself.</p>
    </div>
  )
}

// ---- Step 5: Where is it? ----
export function StepLocation({
  draft,
  draftId,
  update,
  ensureDraft,
}: StepProps & { draftId: string | null; ensureDraft: EnsureDraft }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<AddressResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [chosen, setChosen] = useState<{ streetAddress: string; lat: number; lng: number } | null>(null)
  const [unit, setUnit] = useState('')
  const [saveError, setSaveError] = useState(false)

  // Load the saved exact address when coming back to this step.
  useEffect(() => {
    if (!draftId || draft.approxLat === undefined) return
    fetchPrivateLocation(draftId).then((loc) => {
      if (!loc) return
      setChosen({ streetAddress: loc.streetAddress, lat: loc.exactLat, lng: loc.exactLng })
      setUnit(loc.unit ?? '')
    })
  }, [draftId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chosen || q.trim().length < 4) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setSearching(true)
      setSearchError(false)
      searchAddress(q, ctrl.signal)
        .then(setResults)
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setSearchError(true)
        })
        .finally(() => setSearching(false))
    }, 350)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, chosen])

  async function persist(streetAddress: string, lat: number, lng: number, unitValue: string) {
    setSaveError(false)
    try {
      const { id } = await ensureDraft()
      await savePrivateLocation(id, { streetAddress, unit: unitValue.trim(), exactLat: lat, exactLng: lng })
    } catch (e) {
      console.error('[handoff] save location', e)
      setSaveError(true)
    }
  }

  function choose(r: AddressResult) {
    const approx = approximate(r.lat, r.lng)
    setChosen({ streetAddress: r.streetAddress, lat: r.lat, lng: r.lng })
    setResults([])
    update({
      approxLat: approx.lat,
      approxLng: approx.lng,
      distanceToCampusMi: distanceToCampusMi(r.lat, r.lng),
      neighborhood: draft.neighborhood || r.neighborhood || 'Fort Collins',
    })
    void persist(r.streetAddress, r.lat, r.lng, unit)
  }

  return (
    <div className="form-stack">
      {chosen ? (
        <div className="card address-card">
          <MapPin size={20} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="card-title">{chosen.streetAddress}</p>
            <p className="caption muted">{draft.distanceToCampusMi?.toFixed(1)} mi to campus</p>
          </div>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setChosen(null)
              setQ('')
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="addr" className="label">
            Address
          </label>
          <div className="input-icon">
            <Search size={18} strokeWidth={1.5} aria-hidden="true" />
            <input
              id="addr"
              className="input"
              placeholder="1234 Elizabeth St"
              autoComplete="street-address"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-autocomplete="list"
              aria-controls="addr-results"
            />
          </div>
          {searching && <p className="helper">Searching…</p>}
          {searchError && (
            <p className="field-msg" role="alert">
              Address search isn't working right now. Try again in a minute.
            </p>
          )}
          {results.length > 0 && (
            <ul id="addr-results" className="results-list">
              {results.map((r) => (
                <li key={r.label}>
                  <button type="button" onClick={() => choose(r)}>
                    <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && !searchError && q.trim().length >= 6 && results.length === 0 && (
            <p className="helper">No matches yet. Try the street number and name.</p>
          )}
        </div>
      )}

      {chosen && (
        <>
          <Field label="Unit (optional)" htmlFor="unit">
            <input
              id="unit"
              className="input"
              placeholder="Apt 2"
              maxLength={30}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              onBlur={() => void persist(chosen.streetAddress, chosen.lat, chosen.lng, unit)}
            />
          </Field>
          <Field label="Neighborhood" htmlFor="hood" helper="Shown publicly. Use the area, not the street.">
            <input
              id="hood"
              className="input"
              maxLength={60}
              placeholder="Campus West"
              value={draft.neighborhood ?? ''}
              onChange={(e) => update({ neighborhood: e.target.value })}
            />
          </Field>
          {draft.approxLat !== undefined && draft.approxLng !== undefined && (
            <LazyMap
              className="map-detail"
              label="The general area seekers will see"
              circle={{ lat: draft.approxLat, lng: draft.approxLng, radiusM: AREA_RADIUS_M }}
              zoom={14}
            />
          )}
        </>
      )}

      {saveError && (
        <p className="form-error" role="alert">
          Couldn't save the address. Check your connection and pick it again.
        </p>
      )}
      <p className="notice caption">Your exact address stays private. Seekers only see the general area.</p>
    </div>
  )
}

// ---- Step 6: Check your lease ----
const LANDLORD: [LandlordStatus, string][] = [
  ['allowed', 'My landlord allows subleasing'],
  ['needsApproval', 'I need my landlord’s approval'],
  ['notSure', 'I’m not sure yet'],
]
const LANDLORD_ICON = { allowed: CircleCheck, needsApproval: Clock, notSure: CircleHelp }

export function StepLease({ draft, update }: StepProps) {
  const [why, setWhy] = useState(false)
  return (
    <div className="form-stack">
      <div className="choice-list" role="radiogroup" aria-label="Landlord status">
        {LANDLORD.map(([value, label]) => {
          const Icon = LANDLORD_ICON[value]
          const on = draft.landlordStatus === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? 'choice choice-sm choice-on' : 'choice choice-sm'}
              onClick={() => update({ landlordStatus: value })}
            >
              <Icon size={22} strokeWidth={1.5} aria-hidden="true" className="choice-inline-icon" />
              <span className="choice-text">{label}</span>
              <span className="choice-check" aria-hidden="true">
                {on && <Check size={16} strokeWidth={2.5} />}
              </span>
            </button>
          )
        })}
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={!!draft.leaseAcked}
          onChange={(e) => update({ leaseAcked: e.target.checked })}
        />
        <span>I’ve checked my lease, and I’ll get my landlord’s OK before handing off if needed.</span>
      </label>

      <button type="button" className="link-btn helper-link" onClick={() => setWhy((w) => !w)} aria-expanded={why}>
        Why we ask
      </button>
      {why && (
        <p className="notice caption">
          Many leases ban subleasing without written approval. If yours does and you hand off anyway, you can lose
          your deposit or still owe rent. Handoff shows your answer on the listing so seekers know where things stand.
        </p>
      )}
    </div>
  )
}

// ---- Small shared controls ----
function Field({
  label,
  htmlFor,
  helper,
  error,
  children,
}: {
  label: string
  htmlFor: string
  helper?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className={error ? 'field field-error' : 'field'}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <p className="field-msg" role="alert">
          {error}
        </p>
      ) : (
        helper && <p className="helper">{helper}</p>
      )}
    </div>
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

function ChipGroup({ label, helper, children }: { label: string; helper?: string; children: ReactNode }) {
  return (
    <fieldset className="field chip-field">
      <legend className="label">{label}</legend>
      <div className="chips-wrap">{children}</div>
      {helper && <p className="helper">{helper}</p>}
    </fieldset>
  )
}

function SelectChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={on ? 'chip chip-on' : 'chip'} aria-pressed={on} onClick={onClick}>
      {on && <Check size={14} strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  )
}
