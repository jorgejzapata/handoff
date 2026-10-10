// Sample listings for building the UI before Firestore is wired up.
// Shapes follow the listings collection in the MVP Product Spec.

export type ListingType = 'room' | 'takeover'
export type RoomType = 'private' | 'shared' | 'whole'
export type LandlordStatus = 'allowed' | 'needsApproval' | 'notSure'

export interface Listing {
  id: string
  title: string
  listingType: ListingType
  roomType: RoomType
  bedrooms: number
  bathrooms: number
  privateBath: boolean
  roommateCount: number
  furnished: boolean
  rentCents: number
  utilitiesIncluded: boolean
  utilitiesEstimateCents?: number
  depositNote?: string
  availableFrom: string // ISO date
  availableTo: string
  datesFlexible: boolean
  neighborhood: string
  distanceToCampusMi: number
  amenities: string[]
  description: string
  landlordStatus: LandlordStatus
  boosted: boolean
  photoCount: number
  photoTone: string // placeholder tint until real photos exist
  lister: { firstName: string; year: string; since: string }
  postedAt: string
  updatedAt: string
}

export const sampleListings: Listing[] = [
  {
    id: 'sunny-room-old-town',
    title: 'Sunny room near Old Town',
    listingType: 'room',
    roomType: 'private',
    bedrooms: 3,
    bathrooms: 2,
    privateBath: false,
    roommateCount: 2,
    furnished: true,
    rentCents: 65000,
    utilitiesIncluded: false,
    utilitiesEstimateCents: 6000,
    depositNote: '$500, paid to the landlord',
    availableFrom: '2027-01-06',
    availableTo: '2027-05-15',
    datesFlexible: true,
    neighborhood: 'Campus West',
    distanceToCampusMi: 0.8,
    amenities: ['Parking', 'In-unit laundry', 'Dishwasher'],
    description:
      "Big south-facing window, so it's bright all afternoon. I'm studying abroad in Spain this spring, so the room is open for the whole semester. My two roommates are juniors (one in ag business, one in CS); both are quiet during the week and fun on weekends. It's a 15-minute walk to the Lory Student Center, or a 5-minute bike ride, and the MAX stop is right on the corner. Desk, bed frame and dresser stay. We split utilities three ways, which usually comes to about $60 a month each.",
    landlordStatus: 'allowed',
    boosted: true,
    photoCount: 8,
    photoTone: '#DCE4CF',
    lister: { firstName: 'Maya', year: 'Junior', since: 'Oct 2026' },
    postedAt: '2026-10-03',
    updatedAt: '2026-10-08',
  },
  {
    id: 'two-bed-spring-creek',
    title: 'Whole 2-bed by Spring Creek Trail',
    listingType: 'takeover',
    roomType: 'whole',
    bedrooms: 2,
    bathrooms: 1,
    privateBath: false,
    roommateCount: 0,
    furnished: false,
    rentCents: 124000,
    utilitiesIncluded: false,
    utilitiesEstimateCents: 11000,
    availableFrom: '2026-12-15',
    availableTo: '2027-07-31',
    datesFlexible: false,
    neighborhood: 'Spring Creek',
    distanceToCampusMi: 1.6,
    amenities: ['Parking', 'A/C', 'Pets OK'],
    description:
      'Taking a job in Denver, so the whole unit is up for a lease takeover. Ground floor, a small patio and the trail out the back door.',
    landlordStatus: 'needsApproval',
    boosted: false,
    photoCount: 6,
    photoTone: '#E6E1D3',
    lister: { firstName: 'Jake', year: 'Senior', since: 'Oct 2026' },
    postedAt: '2026-10-07',
    updatedAt: '2026-10-07',
  },
  {
    id: 'room-elizabeth-st',
    title: 'Room in a 4-bed on Elizabeth St',
    listingType: 'room',
    roomType: 'private',
    bedrooms: 4,
    bathrooms: 2,
    privateBath: true,
    roommateCount: 3,
    furnished: true,
    rentCents: 57500,
    utilitiesIncluded: true,
    availableFrom: '2027-01-10',
    availableTo: '2027-04-30',
    datesFlexible: false,
    neighborhood: 'Elizabeth St',
    distanceToCampusMi: 0.4,
    amenities: ['In-unit laundry', 'A/C'],
    description: 'Private bath, utilities included, and a 5-minute walk to campus.',
    landlordStatus: 'allowed',
    boosted: false,
    photoCount: 5,
    photoTone: '#D7E2D9',
    lister: { firstName: 'Priya', year: 'Sophomore', since: 'Oct 2026' },
    postedAt: '2026-10-09',
    updatedAt: '2026-10-09',
  },
  {
    id: 'studio-campus-west',
    title: 'Studio near Campus West',
    listingType: 'takeover',
    roomType: 'whole',
    bedrooms: 0,
    bathrooms: 1,
    privateBath: true,
    roommateCount: 0,
    furnished: true,
    rentCents: 89000,
    utilitiesIncluded: false,
    utilitiesEstimateCents: 5000,
    availableFrom: '2027-01-01',
    availableTo: '2027-08-15',
    datesFlexible: true,
    neighborhood: 'Campus West',
    distanceToCampusMi: 0.6,
    amenities: ['Dishwasher', 'A/C'],
    description: 'Small but bright studio, fully furnished. Lease runs through mid-August.',
    landlordStatus: 'notSure',
    boosted: false,
    photoCount: 4,
    photoTone: '#E3E6DC',
    lister: { firstName: 'Sam', year: 'Grad', since: 'Oct 2026' },
    postedAt: '2026-10-10',
    updatedAt: '2026-10-10',
  },
]

export function getListing(id: string) {
  return sampleListings.find((l) => l.id === id)
}

// ---- Display helpers ----

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const yearFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function formatRent(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

export function formatDates(from: string, to: string, withYear = false) {
  const f = withYear ? yearFmt : monthFmt
  return `${monthFmt.format(new Date(from))} – ${f.format(new Date(to))}`
}

export function formatShortDate(iso: string) {
  return monthFmt.format(new Date(iso))
}

export function typeLine(l: Listing) {
  const beds = l.bedrooms === 0 ? 'Studio' : `${l.bedrooms} bed`
  if (l.listingType === 'room') return `Private room · ${beds} ${l.bedrooms === 0 ? '' : 'apt'}`.trim()
  return `Whole place · ${beds}${l.bedrooms === 0 ? '' : ' apt'}`
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
