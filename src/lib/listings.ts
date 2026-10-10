import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { DocumentData, DocumentSnapshot } from 'firebase/firestore'
import { db } from './firebase'

// ---- Model ----
// Field names follow the listings collection in the MVP Product Spec.
// Money is integer cents; dates are Firestore timestamps in the database and
// ISO yyyy-mm-dd strings in the UI.

export type ListingType = 'room' | 'takeover'
export type RoomType = 'private' | 'shared' | 'whole'
export type LandlordStatus = 'allowed' | 'needsApproval' | 'notSure'
export type ListingStatus = 'draft' | 'active' | 'filled' | 'expired' | 'hidden' | 'removed'

export interface Photo {
  id: string
  path: string
  url: string
  thumbUrl: string
  width: number
  height: number
}

export interface Lister {
  firstName: string
  photoUrl?: string
  year?: string
  since: string // e.g. "Oct 2026"
}

export interface Listing {
  id: string
  ownerId: string
  status: ListingStatus
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
  availableFrom: string
  availableTo: string
  datesFlexible: boolean
  neighborhood: string
  approxLat?: number
  approxLng?: number
  distanceToCampusMi: number
  amenities: string[]
  title: string
  description: string
  photos: Photo[]
  landlordStatus: LandlordStatus
  boosted: boolean
  lister: Lister
  postedAt: string
  updatedAt: string
}

// What the wizard edits. Everything is optional until Publish.
export interface ListingDraft {
  listingType?: ListingType
  roomType?: RoomType
  bedrooms?: number
  bathrooms?: number
  privateBath?: boolean
  roommateCount?: number
  furnished?: boolean
  rentCents?: number
  utilitiesIncluded?: boolean
  utilitiesEstimateCents?: number | null
  depositNote?: string
  availableFrom?: string
  availableTo?: string
  datesFlexible?: boolean
  neighborhood?: string
  approxLat?: number
  approxLng?: number
  distanceToCampusMi?: number
  amenities?: string[]
  title?: string
  description?: string
  photos?: Photo[]
  landlordStatus?: LandlordStatus
  leaseAcked?: boolean
}

export interface PrivateLocation {
  streetAddress: string
  unit?: string
  exactLat: number
  exactLng: number
}

export const AMENITIES = ['Parking', 'In-unit laundry', 'A/C', 'Dishwasher', 'Pets OK', 'Bike storage', 'Yard', 'Gym']

export const LIMITS = {
  rentMin: 100,
  rentMax: 5000,
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 1000,
  photosMax: 8,
  depositNoteMax: 120,
}

// ---- Dates ----

const sinceFmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

function isoToTimestamp(iso: string) {
  return Timestamp.fromDate(new Date(`${iso}T00:00:00Z`))
}

function timestampToIso(t: unknown) {
  return t instanceof Timestamp ? t.toDate().toISOString().slice(0, 10) : ''
}

export function listerSince(date = new Date()) {
  return sinceFmt.format(date)
}

// A listing expires on its move-out date or 30 days after its last update, whichever is sooner.
export function computeExpiry(availableToIso: string, now = new Date()) {
  const thirty = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const moveOut = new Date(`${availableToIso}T23:59:59Z`)
  return Timestamp.fromDate(moveOut < thirty ? moveOut : thirty)
}

// ---- Firestore <-> model ----

// Wizard fields -> Firestore fields (dates become timestamps).
export function draftToFirestore(d: ListingDraft): DocumentData {
  const out: DocumentData = {}
  for (const [key, value] of Object.entries(d)) {
    if (value === undefined || key === 'leaseAcked') continue
    if ((key === 'availableFrom' || key === 'availableTo') && typeof value === 'string') {
      if (value) out[key] = isoToTimestamp(value)
      continue
    }
    out[key] = value
  }
  if (d.leaseAcked === true) out.leaseAckAt = serverTimestamp()
  if (d.leaseAcked === false) out.leaseAckAt = null
  return out
}

export function firestoreToDraft(data: DocumentData): ListingDraft {
  const d: ListingDraft = {}
  const copy = [
    'listingType', 'roomType', 'bedrooms', 'bathrooms', 'privateBath', 'roommateCount', 'furnished',
    'rentCents', 'utilitiesIncluded', 'utilitiesEstimateCents', 'depositNote', 'datesFlexible',
    'neighborhood', 'approxLat', 'approxLng', 'distanceToCampusMi', 'amenities', 'title',
    'description', 'photos', 'landlordStatus',
  ] as const
  for (const key of copy) if (data[key] !== undefined) (d as Record<string, unknown>)[key] = data[key]
  if (data.availableFrom) d.availableFrom = timestampToIso(data.availableFrom)
  if (data.availableTo) d.availableTo = timestampToIso(data.availableTo)
  d.leaseAcked = data.leaseAckAt instanceof Timestamp
  return d
}

export function snapshotToListing(snap: DocumentSnapshot): Listing | null {
  const d = snap.data()
  if (!d) return null
  const boostedUntil = d.boostedUntil instanceof Timestamp ? d.boostedUntil.toDate() : null
  return {
    id: snap.id,
    ownerId: d.ownerId,
    status: d.status,
    listingType: d.listingType ?? 'room',
    roomType: d.roomType ?? (d.listingType === 'takeover' ? 'whole' : 'private'),
    bedrooms: d.bedrooms ?? 0,
    bathrooms: d.bathrooms ?? 1,
    privateBath: !!d.privateBath,
    roommateCount: d.roommateCount ?? 0,
    furnished: !!d.furnished,
    rentCents: d.rentCents ?? 0,
    utilitiesIncluded: !!d.utilitiesIncluded,
    utilitiesEstimateCents: d.utilitiesEstimateCents ?? undefined,
    depositNote: d.depositNote || undefined,
    availableFrom: timestampToIso(d.availableFrom),
    availableTo: timestampToIso(d.availableTo),
    datesFlexible: !!d.datesFlexible,
    neighborhood: d.neighborhood ?? 'Fort Collins',
    approxLat: d.approxLat,
    approxLng: d.approxLng,
    distanceToCampusMi: d.distanceToCampusMi ?? 0,
    amenities: d.amenities ?? [],
    title: d.title ?? '',
    description: d.description ?? '',
    photos: d.photos ?? [],
    landlordStatus: d.landlordStatus ?? 'notSure',
    boosted: !!boostedUntil && boostedUntil > new Date(),
    lister: {
      firstName: d.listerFirstName ?? 'A Ram',
      photoUrl: d.listerPhotoUrl || undefined,
      year: d.listerYear || undefined,
      since: d.listerSince ?? '',
    },
    postedAt: d.publishedAt instanceof Timestamp ? d.publishedAt.toDate().toISOString() : '',
    updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate().toISOString() : '',
  }
}

// Builds a display Listing from a draft, for the wizard's preview.
export function draftToPreview(d: ListingDraft, lister: Lister, id = 'preview'): Listing {
  const isRoom = d.listingType !== 'takeover'
  return {
    id,
    ownerId: '',
    status: 'draft',
    listingType: d.listingType ?? 'room',
    roomType: isRoom ? 'private' : 'whole',
    bedrooms: d.bedrooms ?? 1,
    bathrooms: d.bathrooms ?? 1,
    privateBath: !!d.privateBath,
    roommateCount: d.roommateCount ?? 0,
    furnished: !!d.furnished,
    rentCents: d.rentCents ?? 0,
    utilitiesIncluded: !!d.utilitiesIncluded,
    utilitiesEstimateCents: d.utilitiesEstimateCents ?? undefined,
    depositNote: d.depositNote || undefined,
    availableFrom: d.availableFrom ?? '',
    availableTo: d.availableTo ?? '',
    datesFlexible: !!d.datesFlexible,
    neighborhood: d.neighborhood || 'Fort Collins',
    approxLat: d.approxLat,
    approxLng: d.approxLng,
    distanceToCampusMi: d.distanceToCampusMi ?? 0,
    amenities: d.amenities ?? [],
    title: d.title ?? '',
    description: d.description ?? '',
    photos: d.photos ?? [],
    landlordStatus: d.landlordStatus ?? 'notSure',
    boosted: false,
    lister,
    postedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ---- Reads ----

export async function fetchActiveListings(max = 100): Promise<Listing[]> {
  const q = query(
    collection(db, 'listings'),
    where('status', '==', 'active'),
    where('schoolId', '==', 'csu'),
    orderBy('publishedAt', 'desc'),
    limit(max),
  )
  const snap = await getDocs(q)
  const now = new Date()
  return snap.docs
    .map(snapshotToListing)
    .filter((l): l is Listing => !!l)
    // Hide listings past their move-out date until the expiry job exists.
    .filter((l) => !l.availableTo || new Date(`${l.availableTo}T23:59:59Z`) >= now)
}

export async function fetchListing(id: string) {
  try {
    return snapshotToListing(await getDoc(doc(db, 'listings', id)))
  } catch {
    return null // not found, or not readable (hidden, removed, someone else's draft)
  }
}

export async function fetchDraft(id: string, uid: string) {
  try {
    const snap = await getDoc(doc(db, 'listings', id))
    const data = snap.data()
    if (!data || data.ownerId !== uid || data.status !== 'draft') return null
    return firestoreToDraft(data)
  } catch {
    return null
  }
}

export async function fetchPrivateLocation(listingId: string): Promise<PrivateLocation | null> {
  try {
    const snap = await getDoc(doc(db, 'listings', listingId, 'private', 'location'))
    return (snap.data() as PrivateLocation | undefined) ?? null
  } catch {
    return null
  }
}

// ---- Writes ----

export async function createDraft(uid: string, draft: ListingDraft) {
  const ref = await addDoc(collection(db, 'listings'), {
    ...draftToFirestore(draft),
    ownerId: uid,
    schoolId: 'csu',
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function saveDraft(id: string, changes: ListingDraft) {
  await updateDoc(doc(db, 'listings', id), { ...draftToFirestore(changes), updatedAt: serverTimestamp() })
}

export async function savePrivateLocation(listingId: string, loc: PrivateLocation) {
  await setDoc(doc(db, 'listings', listingId, 'private', 'location'), {
    streetAddress: loc.streetAddress,
    unit: loc.unit ?? '',
    exactLat: loc.exactLat,
    exactLng: loc.exactLng,
  })
}

export async function deleteDraft(id: string) {
  await deleteDoc(doc(db, 'listings', id))
}

// Goes live. The rules require a verified CSU email and every required field.
export async function publishListing(id: string, draft: ListingDraft, lister: Lister) {
  if (!draft.availableTo) throw new Error('Missing move-out date')
  await updateDoc(doc(db, 'listings', id), {
    status: 'active',
    publishedAt: serverTimestamp(),
    expiresAt: computeExpiry(draft.availableTo),
    updatedAt: serverTimestamp(),
    listerFirstName: lister.firstName,
    listerPhotoUrl: lister.photoUrl ?? null,
    listerYear: lister.year ?? null,
    listerSince: lister.since,
  })
}

// Keeps the lister card on every listing in sync after a profile edit.
export async function updateListerOnListings(uid: string, lister: Partial<Lister>) {
  const snap = await getDocs(query(collection(db, 'listings'), where('ownerId', '==', uid)))
  const patch: DocumentData = { updatedAt: serverTimestamp() }
  if (lister.firstName !== undefined) patch.listerFirstName = lister.firstName
  if (lister.photoUrl !== undefined) patch.listerPhotoUrl = lister.photoUrl
  if (lister.year !== undefined) patch.listerYear = lister.year
  await Promise.all(
    snap.docs
      .filter((d) => ['draft', 'active'].includes(d.data().status))
      .map((d) => updateDoc(d.ref, patch)),
  )
}

// ---- What still blocks Publish ----

export function missingForPublish(d: ListingDraft): { step: number; label: string }[] {
  const out: { step: number; label: string }[] = []
  if (!d.listingType) out.push({ step: 0, label: 'What you are offering' })
  if (!d.rentCents) out.push({ step: 1, label: 'Monthly rent' })
  if (!d.availableFrom || !d.availableTo || d.availableTo <= d.availableFrom) out.push({ step: 1, label: 'Dates' })
  if (!d.title?.trim()) out.push({ step: 2, label: 'A title' })
  if ((d.description?.trim().length ?? 0) < LIMITS.descriptionMin) out.push({ step: 2, label: 'A description' })
  if (!d.photos?.length) out.push({ step: 3, label: 'At least one photo' })
  if (d.approxLat === undefined || d.approxLng === undefined) out.push({ step: 4, label: 'The address' })
  if (!d.landlordStatus || !d.leaseAcked) out.push({ step: 5, label: 'The lease check' })
  return out
}

// Publishes the draft with this id, if it's complete. Returns false if
// something is still missing, so the caller can send the lister back to finish.
export async function publishDraftById(id: string, uid: string, lister: Lister) {
  const draft = await fetchDraft(id, uid)
  if (!draft || missingForPublish(draft).length) return false
  await publishListing(id, draft, lister)
  return true
}
