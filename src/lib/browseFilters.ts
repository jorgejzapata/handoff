import type { Listing } from './listings'
import { GROUPS, openToGroup } from './gender'
import type { Group } from './gender'

// Every Browse filter lives in the URL, so a filtered search can be shared or
// bookmarked. This file is the one place that reads, writes and applies them.

export type PlaceType = 'any' | 'room' | 'whole'

export type Filters = {
  from?: string // yyyy-mm-dd
  to?: string
  min?: number // USD per month
  max?: number
  type: PlaceType
  beds?: number // 0 = studio, 4 = 4 or more
  baths?: number // minimum: 1, 1.5 or 2
  privateBath: boolean
  furnished: boolean
  utilities: boolean
  dist?: number // miles to campus, maximum
  for?: Group
}

export const BEDS: [number, string][] = [
  [0, 'Studio'],
  [1, '1'],
  [2, '2'],
  [3, '3'],
  [4, '4+'],
]
export const BATHS: [number, string][] = [
  [1, '1+'],
  [1.5, '1.5+'],
  [2, '2+'],
]
export const DISTANCES: [number | undefined, string][] = [
  [undefined, 'Any'],
  [0.5, 'Under 0.5 mi'],
  [1, 'Under 1 mi'],
  [2, 'Under 2 mi'],
]

// Keys this file owns. Sort and view stay with Browse.
const KEYS = ['from', 'to', 'min', 'max', 'type', 'beds', 'baths', 'pbath', 'furnished', 'utilities', 'dist', 'for']

function num(v: string | null) {
  if (v === null || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)

export function readFilters(params: URLSearchParams): Filters {
  const type = params.get('type')
  const group = params.get('for')
  return {
    from: isDate(params.get('from')),
    to: isDate(params.get('to')),
    min: num(params.get('min')),
    max: num(params.get('max')),
    type: type === 'room' || type === 'whole' ? type : 'any',
    beds: num(params.get('beds')),
    baths: num(params.get('baths')),
    privateBath: params.get('pbath') === '1',
    furnished: params.get('furnished') === '1',
    utilities: params.get('utilities') === '1',
    dist: num(params.get('dist')),
    for: GROUPS.some(([g]) => g === group) ? (group as Group) : undefined,
  }
}

// Returns new params with the filters written in and everything else (sort,
// view) kept.
export function writeFilters(params: URLSearchParams, f: Filters) {
  const next = new URLSearchParams(params)
  KEYS.forEach((k) => next.delete(k))
  const set = (k: string, v: string | number | undefined | false) => {
    if (v !== undefined && v !== false && v !== '') next.set(k, String(v))
  }
  set('from', f.from)
  set('to', f.to)
  set('min', f.min)
  set('max', f.max)
  set('type', f.type !== 'any' && f.type)
  set('beds', f.beds)
  set('baths', f.baths)
  set('pbath', f.privateBath && f.type !== 'whole' && '1')
  set('furnished', f.furnished && '1')
  set('utilities', f.utilities && '1')
  set('dist', f.dist)
  set('for', f.type !== 'whole' && f.for)
  return next
}

export const EMPTY: Filters = { type: 'any', privateBath: false, furnished: false, utilities: false }

export function matches(l: Listing, f: Filters) {
  const rent = l.rentCents / 100
  if (f.min !== undefined && rent < f.min) return false
  if (f.max !== undefined && rent > f.max) return false
  if (f.type === 'room' && l.listingType !== 'room') return false
  if (f.type === 'whole' && l.listingType !== 'takeover') return false
  if (f.beds !== undefined && (f.beds === 4 ? l.bedrooms < 4 : l.bedrooms !== f.beds)) return false
  if (f.baths !== undefined && l.bathrooms < f.baths) return false
  if (f.privateBath && f.type !== 'whole' && l.listingType === 'room' && !l.privateBath) return false
  if (f.furnished && !l.furnished) return false
  if (f.utilities && !l.utilitiesIncluded) return false
  if (f.dist !== undefined && !(l.distanceToCampusMi <= f.dist)) return false
  if (f.for && f.type !== 'whole' && !openToGroup(l.openTo, f.for)) return false
  // Any overlap with the seeker's dates counts; partial matches get a note.
  if (f.from && l.availableTo && l.availableTo < f.from) return false
  if (f.to && l.availableFrom && l.availableFrom > f.to) return false
  return true
}

// How many filters are on, for the "Filters (3)" chip.
export function activeCount(f: Filters) {
  return [
    f.from || f.to,
    f.min !== undefined || f.max !== undefined,
    f.type !== 'any',
    f.beds !== undefined,
    f.baths !== undefined,
    f.privateBath && f.type !== 'whole',
    f.furnished,
    f.utilities,
    f.dist !== undefined,
    f.for && f.type !== 'whole',
  ].filter(Boolean).length
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

export function priceLabel(f: Filters) {
  if (f.min !== undefined && f.max !== undefined) return `${usd(f.min)}–${f.max.toLocaleString('en-US')}`
  if (f.max !== undefined) return `Up to ${usd(f.max)}`
  if (f.min !== undefined) return `${usd(f.min)}+`
  return undefined
}
