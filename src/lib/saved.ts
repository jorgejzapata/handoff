import {
  Timestamp,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { fetchListing } from './listings'
import type { Listing } from './listings'

// Saving a place writes two docs in one batch:
//   users/{uid}/saved/{listingId}   the student's list, with a small snapshot
//                                   so a filled or expired place still shows
//   listings/{id}/saves/{uid}       so the lister can see "6 saves"
// No Cloud Function needed.

export interface SavedEntry {
  listingId: string
  savedAt: string
  title: string
  rentCents: number
  thumbUrl?: string
  availableFrom: string
  availableTo: string
  neighborhood: string
}

function snapshotOf(l: Listing) {
  return {
    savedAt: serverTimestamp(),
    title: l.title.slice(0, 60),
    rentCents: l.rentCents,
    thumbUrl: l.photos[0]?.thumbUrl ?? null,
    availableFrom: l.availableFrom,
    availableTo: l.availableTo,
    neighborhood: l.neighborhood.slice(0, 60),
  }
}

export function subscribeSaved(uid: string, onData: (list: SavedEntry[]) => void, onError: (e: Error) => void) {
  const q = query(collection(db, 'users', uid, 'saved'), orderBy('savedAt', 'desc'))
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const x = d.data()
          return {
            listingId: d.id,
            // A just-written doc has no server time yet; treat it as now.
            savedAt: x.savedAt instanceof Timestamp ? x.savedAt.toDate().toISOString() : new Date().toISOString(),
            title: x.title ?? '',
            rentCents: x.rentCents ?? 0,
            thumbUrl: x.thumbUrl || undefined,
            availableFrom: x.availableFrom ?? '',
            availableTo: x.availableTo ?? '',
            neighborhood: x.neighborhood ?? '',
          }
        }),
      ),
    onError,
  )
}

export async function saveListing(uid: string, l: Listing) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid, 'saved', l.id), snapshotOf(l))
  batch.set(doc(db, 'listings', l.id, 'saves', uid), { at: serverTimestamp() })
  await batch.commit()
}

export async function unsaveListing(uid: string, listingId: string) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', uid, 'saved', listingId))
  batch.delete(doc(db, 'listings', listingId, 'saves', uid))
  await batch.commit()
}

// After sign-up and verification: save the place they tapped the heart on.
export async function savePendingListing(uid: string, listingId: string) {
  const l = await fetchListing(listingId)
  if (!l || l.status !== 'active') return false
  await saveListing(uid, l)
  return true
}

// Account deletion: clear the list and the counts on other people's listings.
export async function deleteAllSaved(uid: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'saved'))
  for (let i = 0; i < snap.docs.length; i += 200) {
    const batch = writeBatch(db)
    for (const d of snap.docs.slice(i, i + 200)) {
      batch.delete(d.ref)
      batch.delete(doc(db, 'listings', d.id, 'saves', uid))
    }
    await batch.commit()
  }
}

// For the lister, on My listings.
export async function fetchSaveCount(listingId: string) {
  const snap = await getCountFromServer(collection(db, 'listings', listingId, 'saves'))
  return snap.data().count
}
