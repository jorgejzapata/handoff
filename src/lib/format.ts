import type { LandlordStatus, Listing } from './listings'

// Display helpers shared by cards, detail and preview.

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const yearFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function formatRent(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

export function formatDates(from: string, to: string, withYear = false) {
  if (!from || !to) return 'Dates to come'
  const f = withYear ? yearFmt : monthFmt
  return `${monthFmt.format(new Date(from))} – ${f.format(new Date(to))}`
}

export function formatShortDate(iso: string) {
  return iso ? monthFmt.format(new Date(iso)) : ''
}

export function bedsLabel(bedrooms: number) {
  return bedrooms === 0 ? 'Studio' : `${bedrooms} bed`
}

export function typeLine(l: Listing) {
  const beds = l.bedrooms === 0 ? 'Studio' : `${l.bedrooms} bed apt`
  return l.listingType === 'room' ? `Private room · ${beds}` : `Whole place · ${beds}`
}

export function eyebrowLabel(l: Listing) {
  return l.listingType === 'room'
    ? l.roomType === 'shared'
      ? 'Shared room'
      : 'Private room'
    : 'Whole place · lease takeover'
}

export const landlordLine: Record<LandlordStatus, string> = {
  allowed: 'Landlord allows subleasing',
  needsApproval: 'Needs landlord approval',
  notSure: "Lister isn't sure yet",
}

export function distanceLabel(mi: number) {
  return mi < 0.1 ? 'On campus' : `${mi.toFixed(1)} mi to campus`
}
