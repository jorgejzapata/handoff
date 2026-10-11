import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Link } from 'react-router'
import { Check, House, List, Map as MapIcon, SearchX, SlidersHorizontal } from 'lucide-react'
import { Sheet } from '../components/Sheet'
import { FilterPanel } from '../components/FilterPanel'
import { EMPTY, activeCount, matches, priceLabel, readFilters, writeFilters } from '../lib/browseFilters'
import type { Filters } from '../lib/browseFilters'
import { LazyMap } from '../components/map/LazyMap'
import type { MapPin } from '../components/map/MapView'
import { formatRent } from '../lib/format'
import { ListingCard } from '../components/ListingCard'
import type { Listing } from '../lib/listings'
import { formatDates } from '../lib/format'
import { useActiveListings } from '../lib/useListings'
import { saveLastSearch } from '../lib/lastSearch'
import { GROUPS, useMyGroup } from '../lib/gender'
import { track } from '../lib/track'

type Sort = 'recommended' | 'newest' | 'price-asc' | 'price-desc'

const SORTS: [Sort, string][] = [
  ['recommended', 'Recommended'],
  ['newest', 'Newest'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
]

function overlapNote(l: Listing, from?: string, to?: string) {
  if (!from || !to) return undefined
  const start = from > l.availableFrom ? from : l.availableFrom
  const end = to < l.availableTo ? to : l.availableTo
  if (start === from && end === to) return undefined
  return `Covers ${formatDates(start, end)} of your dates`
}

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const { from, to, max, type, furnished } = filters
  const forGroup = filters.type === 'whole' ? undefined : filters.for
  const [sheetOpen, setSheetOpen] = useState(false)
  const myGroup = useMyGroup()
  const sort = (params.get('sort') as Sort) ?? 'recommended'
  const mapView = params.get('view') === 'map'
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const { listings, loading, error } = useActiveListings()

  // Remember the dates for Say hi and the next visit to Home.
  useEffect(() => {
    if (from || to || max) saveLastSearch({ from, to, max: max ? String(max) : undefined, type })
  }, [from, to, max, type])

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
    if (key !== 'view' && key !== 'sort') track('filter_applied', filterParams(readFilters(next)))
  }

  function apply(f: Filters) {
    setParams(writeFilters(params, f), { replace: true })
    track('filter_applied', filterParams(f))
  }

  function clearAll() {
    setParams(writeFilters(params, EMPTY), { replace: true })
  }

  const results = useMemo(() => {
    const list = (listings ?? []).filter((l) => matches(l, filters))
    const sorted = [...list]
    if (sort === 'newest') sorted.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    if (sort === 'price-asc') sorted.sort((a, b) => a.rentCents - b.rentCents)
    if (sort === 'price-desc') sorted.sort((a, b) => b.rentCents - a.rentCents)
    if (sort === 'recommended')
      sorted.sort((a, b) => Number(b.boosted) - Number(a.boosted) || b.postedAt.localeCompare(a.postedAt))
    return sorted
  }, [listings, filters, sort])

  const typeLabel = type === 'room' ? 'Room' : type === 'whole' ? 'Whole place' : 'Type'
  const count = activeCount(filters)
  const anyFilter = count > 0
  const price = priceLabel(filters)

  // With a gender on their profile, one tap: "Open to me". Otherwise the chip
  // cycles through the groups.
  const forLabel = !forGroup
    ? myGroup
      ? 'Open to me'
      : 'Open to'
    : forGroup === myGroup
      ? 'Open to me'
      : `Open to ${GROUPS.find(([g]) => g === forGroup)![1].toLowerCase()}`
  function cycleFor() {
    if (myGroup) return update('for', forGroup ? null : myGroup)
    const i = GROUPS.findIndex(([g]) => g === forGroup)
    update('for', i === GROUPS.length - 1 ? null : GROUPS[i + 1][0])
  }

  return (
    <div className="page browse">
      <div className="browse-layout">
      <aside className="filter-rail" aria-label="Filters">
        <div className="filter-rail-head">
          <p className="heading">Filters</p>
          {anyFilter && (
            <button type="button" className="link-btn" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
        <FilterPanel value={filters} onChange={apply} myGroup={myGroup} />
      </aside>
      <div className="browse-main">
      <div className="chip-row" role="toolbar" aria-label="Filters">
        <Chip
          on={count > 0}
          label={count > 0 ? `Filters · ${count}` : 'Filters'}
          icon={<SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />}
          onClick={() => setSheetOpen(true)}
        />
        <Chip on={!!(from && to)} label={from && to ? formatDates(from, to) : 'Dates'} onClick={() => setSheetOpen(true)} />
        <Chip on={!!price} label={price ?? 'Price'} onClick={() => setSheetOpen(true)} />
        <Chip
          on={type !== 'any'}
          label={typeLabel}
          onClick={() => update('type', type === 'any' ? 'room' : type === 'room' ? 'whole' : null)}
        />
        <Chip on={furnished} label="Furnished" onClick={() => update('furnished', furnished ? null : '1')} />
        {type !== 'whole' && <Chip on={!!forGroup} label={forLabel} onClick={cycleFor} />}
      </div>

      <div className="results-head">
        <p className="label" aria-live="polite">
          {loading ? 'Loading places' : `${results.length} ${results.length === 1 ? 'place' : 'places'}`}
        </p>
        <label className="sort">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => update('sort', e.target.value === 'recommended' ? null : e.target.value)}>
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={!mapView} className={!mapView ? 'seg seg-on' : 'seg'} onClick={() => update('view', null)}>
            <List size={16} strokeWidth={1.5} aria-hidden="true" />
            List
          </button>
          <button type="button" aria-pressed={mapView} className={mapView ? 'seg seg-on' : 'seg'} onClick={() => update('view', 'map')}>
            <MapIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            Map
          </button>
        </div>
      </div>

      {mapView && !loading && !error && (listings?.length ?? 0) > 0 && (
        <BrowseMap results={results} selected={selectedPin} onSelect={setSelectedPin} />
      )}

      {mapView && !loading && !error && (listings?.length ?? 0) > 0 ? null : loading ? (
        <div className="results-grid" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : error ? (
        <div className="empty">
          <p className="heading">Something broke on our end.</p>
          <p className="muted">Try again in a minute.</p>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : listings?.length === 0 ? (
        <div className="empty">
          <House size={48} strokeWidth={1.5} aria-hidden="true" />
          <p className="heading">No places yet. Be one of the first to post.</p>
          <p className="muted">Posting is free and takes about 5 minutes.</p>
          <Link to="/post" className="btn btn-accent">
            Post your place
          </Link>
        </div>
      ) : results.length === 0 ? (
        <div className="empty">
          <SearchX size={48} strokeWidth={1.5} aria-hidden="true" />
          <p className="heading">No places match all of that yet.</p>
          <p className="muted">Try wider dates, or check back soon. New places go up every week.</p>
          <button type="button" className="btn btn-secondary" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="results-grid">
            {results.map((l) => (
              <ListingCard key={l.id} listing={l} note={overlapNote(l, from, to)} />
            ))}
          </div>
          <p className="end-line muted">That's everything for now. New places go up every week.</p>
        </>
      )}
      {anyFilter && results.length > 0 && (
        <button type="button" className="link-btn center-block" onClick={clearAll}>
          Clear all filters
        </button>
      )}
      </div>
      </div>
      {sheetOpen && (
        <FilterSheet
          initial={filters}
          myGroup={myGroup}
          countFor={(f) => (listings ?? []).filter((l) => matches(l, f)).length}
          onApply={(f) => {
            apply(f)
            setSheetOpen(false)
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}

// Mobile filter sheet: edits a draft, and the button shows the live count.
function FilterSheet({
  initial,
  myGroup,
  countFor,
  onApply,
  onClose,
}: {
  initial: Filters
  myGroup?: ReturnType<typeof useMyGroup>
  countFor: (f: Filters) => number
  onApply: (f: Filters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const n = countFor(draft)
  return (
    <Sheet title="Filters" onClose={onClose}>
      <FilterPanel value={draft} onChange={setDraft} myGroup={myGroup} />
      <div className="filter-foot">
        <button type="button" className="link-btn" onClick={() => setDraft(EMPTY)} disabled={activeCount(draft) === 0}>
          Clear all
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onApply(draft)}>
          {n === 0 ? 'No matches yet' : `Show ${n} ${n === 1 ? 'place' : 'places'}`}
        </button>
      </div>
    </Sheet>
  )
}

// Which filters are on, never the dates themselves.
function filterParams(f: Filters) {
  return {
    filters: activeCount(f),
    dates: !!(f.from || f.to),
    max_usd: f.max,
    type: f.type,
    beds: f.beds,
    furnished: f.furnished,
    distance_mi: f.dist,
  }
}

function Chip({ on, label, icon, onClick }: { on: boolean; label: string; icon?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={on ? 'chip chip-on' : 'chip'} aria-pressed={on} onClick={onClick}>
      {icon ?? (on && <Check size={14} strokeWidth={2} aria-hidden="true" />)}
      {label}
    </button>
  )
}

// Map view: price pins at each listing's approximate area (never the exact
// address). Tapping a pin shows its card under the map.
function BrowseMap({
  results,
  selected,
  onSelect,
}: {
  results: Listing[]
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const pins = useMemo<MapPin[]>(
    () =>
      results
        .filter((l) => l.approxLat !== undefined && l.approxLng !== undefined)
        .map((l) => ({ id: l.id, lat: l.approxLat!, lng: l.approxLng!, label: formatRent(l.rentCents) })),
    [results],
  )
  const picked = results.find((l) => l.id === selected)

  return (
    <div className="browse-map">
      <LazyMap
        className="map-browse"
        label={`Map of ${pins.length} places near campus`}
        pins={pins}
        activePinId={selected}
        onPinClick={onSelect}
        onMapClick={() => onSelect(null)}
      />
      <p className="caption muted map-note">Pins show the general area, not the exact address.</p>
      {picked && (
        <div className="map-card">
          <ListingCard listing={picked} />
        </div>
      )}
    </div>
  )
}
